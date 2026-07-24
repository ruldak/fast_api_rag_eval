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
import random

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
        logger.info(f"[RUN:{run_id}] 📥 Fetching evaluation run from database...")
        run = db.execute(select(EvaluationRun).where(EvaluationRun.id == run_id)).scalar_one()
        
        run.status = "processing"
        db.commit()
        logger.info(f"[RUN:{run_id}] 🔄 Status updated to 'processing'")
        
        metrics = db.execute(
            select(MetricDefinition).where(MetricDefinition.tenant_id == run.tenant_id)
        ).scalars().all()
        
        requested_metrics = run.metadata_.get("requested_metrics", list({m.name for m in metrics}))

        metric_map = {m.name: m for m in metrics}
        client = GroqClient(api_key=settings.GROQ_API_KEY)
        builder = PromptBuilder()
        
        semaphore = asyncio.Semaphore(2)

        async def process_item(item, metric_name):
            metric = metric_map.get(metric_name)
            if not metric:
                logger.warning(f"[RUN:{run_id}] ⚠️  Metric '{metric_name}' not found, skipping")
                return None

            if metric_name == "correctness" and not item.ground_truth:
                logger.info(f"[RUN:{run_id}] ⏭️  Item {item.id} | correctness skipped (no ground_truth)")
                return None

            async with semaphore:
                prompt = builder.build(
                    metric=metric,
                    query=item.query,
                    response=item.response,
                    contexts=item.contexts,
                    ground_truth=item.ground_truth
                )

                max_local_retries = 7
                for attempt in range(max_local_retries):
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
                        is_rate_limit = "rate_limit" in error_msg.lower() or "429" in error_msg
                        
                        if is_rate_limit and attempt < max_local_retries - 1:
                            # Exponential Backoff: 1s, 2s, 4s, 8s, 16s, 32s, 64s
                            # Ditambah Jitter (angka acak 0-1 detik) agar request tidak menumpuk serentak setelah sleep
                            wait_time = (2 ** attempt) + random.uniform(0, 1)
                            logger.warning(
                                f"[RUN:{run_id}] ⏳ Rate limited | item={item.id} | metric={metric_name} | "
                                f"attempt {attempt + 1}/{max_local_retries} | retrying in {wait_time:.2f}s"
                            )
                            await asyncio.sleep(wait_time)
                            continue
                        
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

        CHUNK_SIZE = 200
        offset = 0

        async def execute_batch(batch_tasks):
            return await asyncio.gather(*batch_tasks, return_exceptions=True)
        
        while True:
            items_chunk = db.execute(
                select(EvaluationItem)
                .where(EvaluationItem.run_id == run_id)
                .where(~EvaluationItem.scores.any())
                .limit(CHUNK_SIZE)
                .offset(offset)
            ).scalars().all()

            if not items_chunk:
                break

            logger.info(f"[RUN:{run_id}] 📦 Processing chunk {offset//CHUNK_SIZE + 1} ({len(items_chunk)} items)")

            tasks = []
            for item in items_chunk:
                for metric_name in requested_metrics:
                    tasks.append(process_item(item, metric_name))
            
            results = asyncio.run(execute_batch(tasks))
            
            for res in results:
                if isinstance(res, dict) and res.get("value") is not None:
                    score = Score(
                        item_id=res["item_id"],
                        metric_id=res["metric_id"],
                        value=res["value"],
                        details=res["details"]
                    )
                    db.add(score)
            
            db.commit()
            offset += CHUNK_SIZE

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