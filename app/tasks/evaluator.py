import asyncio
import json
import logging
import time
from celery import Celery
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.config import settings
from app.database import sync_engine
from app.models import EvaluationRun, EvaluationItem, MetricDefinition, Score
from app.services.groq_client import GroqClient
from app.services.prompt_builder import PromptBuilder

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("celery.evaluator")

celery_app = Celery(
    "rag_eval",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
celery_app.conf.task_serializer = 'json'
celery_app.conf.accept_content = ['json']

SessionLocal = sessionmaker(bind=sync_engine)

@celery_app.task(bind=True, max_retries=3)
def run_evaluation(self, run_id: str):
    logger.info(f"[RUN:{run_id}] 🚀 Task started | attempt={self.request.retries + 1}")
    
    db = SessionLocal()
    try:
        # 1. Fetch run and update status
        logger.info(f"[RUN:{run_id}] 📥 Fetching evaluation run from database...")
        run = db.execute(select(EvaluationRun).where(EvaluationRun.id == run_id)).scalar_one()
        
        run.status = "processing"
        db.commit()
        logger.info(f"[RUN:{run_id}] 🔄 Status updated to 'processing'")

        # 2. Fetch items and metrics
        items = db.execute(
            select(EvaluationItem).where(EvaluationItem.run_id == run_id)
        ).scalars().all()
        
        metrics = db.execute(
            select(MetricDefinition).where(MetricDefinition.tenant_id == run.tenant_id)
        ).scalars().all()
        
        requested_metrics = run.metadata_.get("requested_metrics", list({m.name for m in metrics}))
        
        logger.info(
            f"[RUN:{run_id}] 📊 Loaded {len(items)} items | "
            f"{len(metrics)} metrics available | "
            f"requested: {requested_metrics}"
        )

        # 3. Build lookup maps
        metric_map = {m.name: m for m in metrics}
        client = GroqClient(api_key=settings.GROQ_API_KEY)
        builder = PromptBuilder()
        semaphore = asyncio.Semaphore(5)

        # 4. Define async worker per item-metric
        async def process_item(item, metric_name):
            metric = metric_map.get(metric_name)
            if not metric:
                logger.warning(f"[RUN:{run_id}] ⚠️  Metric '{metric_name}' not found, skipping")
                return None

            # Skip correctness if no ground_truth is provided
            if metric_name == "correctness" and not item.ground_truth:
                logger.info(f"[RUN:{run_id}] ⏭️  Item {item.id} | correctness skipped (no ground_truth)")
                return None

            async with semaphore:
                logger.info(
                    f"[RUN:{run_id}] 🤖 Processing | item={item.id} | metric={metric_name} | "
                    f"model={metric.config.get('model', 'llama-3.1-8b-instant')}"
                )
                
                prompt = builder.build(
                    metric=metric,
                    query=item.query,
                    response=item.response,
                    contexts=item.contexts,
                    ground_truth=item.ground_truth
                )

                try:
                    result = await client.evaluate(
                        prompt,
                        metric.config.get("model", "llama-3.1-8b-instant"),
                        metric.config.get("temperature", 0.0)
                    )
                    
                    score_value = result.get("score")
                    logger.info(
                        f"[RUN:{run_id}] ✅ Success | item={item.id} | metric={metric_name} | "
                        f"score={score_value} | tokens={result.get('token_usage', {})}"
                    )
                    
                    return {
                        "item_id": item.id,
                        "metric_id": metric.id,
                        "value": score_value,
                        "details": result
                    }

                except Exception as e:
                    error_msg = str(e)
                    if "rate_limit" in error_msg.lower() or "429" in error_msg:
                        logger.warning(
                            f"[RUN:{run_id}] ⏳ Rate limited | item={item.id} | metric={metric_name} | "
                            f"retrying in {60 * (self.request.retries + 1)}s"
                        )
                        await asyncio.sleep(2 ** self.request.retries)
                        raise self.retry(exc=e, countdown=60)
                    
                    logger.error(
                        f"[RUN:{run_id}] ❌ Failed | item={item.id} | metric={metric_name} | "
                        f"error={error_msg}"
                    )
                    return {
                        "item_id": item.id,
                        "metric_id": metric.id,
                        "value": None,
                        "details": {"error": error_msg, "prompt_length": len(prompt)}
                    }

        # 5. Execute all evaluations asynchronously
        async def process_all():
            tasks = []
            for idx, item in enumerate(items, 1):
                for metric_name in requested_metrics:
                    tasks.append(process_item(item, metric_name))
            
            total_tasks = len(tasks)
            logger.info(f"[RUN:{run_id}] 🏃 Starting {total_tasks} total evaluations (max 5 parallel)")
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Log summary
            success = sum(1 for r in results if isinstance(r, dict) and r.get("value") is not None)
            failed = sum(1 for r in results if isinstance(r, dict) and r.get("value") is None)
            errors = sum(1 for r in results if isinstance(r, Exception))
            
            logger.info(
                f"[RUN:{run_id}] 📈 Batch complete | success={success} | failed={failed} | errors={errors}"
            )
            return results

        results = asyncio.run(process_all())

        # 6. Save all scores to the database
        logger.info(f"[RUN:{run_id}] 💾 Saving scores to database...")
        saved_count = 0
        for res in results:
            if isinstance(res, dict):
                score = Score(
                    item_id=res["item_id"],
                    metric_id=res["metric_id"],
                    value=res["value"],
                    details=res["details"]
                )
                db.add(score)
                saved_count += 1
        
        db.commit()
        logger.info(f"[RUN:{run_id}] 💾 Saved {saved_count} scores")

        # 7. Update status to completed
        run.status = "completed"
        run.metadata_["processed_at"] = str(time.time())
        db.commit()
        
        logger.info(f"[RUN:{run_id}] 🎉 Task COMPLETED successfully")

    except Exception as exc:
        db.rollback()
        logger.exception(f"[RUN:{run_id}] 🔥 Fatal error: {exc}")
        
        run = db.execute(select(EvaluationRun).where(EvaluationRun.id == run_id)).scalar_one_or_none()
        if run:
            run.status = "failed"
            run.metadata_["error"] = str(exc)
            db.commit()
            logger.info(f"[RUN:{run_id}] 📝 Status updated to 'failed'")
        
        raise self.retry(exc=exc, countdown=60)
    
    finally:
        db.close()
        logger.info(f"[RUN:{run_id}] 🔒 Database connection closed")