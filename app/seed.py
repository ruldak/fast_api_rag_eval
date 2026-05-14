import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Tenant, MetricDefinition
from app.utils.security import hash_api_key

PREDEFINED_METRICS = [
    {"name": "faithfulness", "type": "predefined", "config": {}},
    {"name": "answer_relevancy", "type": "predefined", "config": {}},
    {"name": "correctness", "type": "predefined", "config": {}}
]

async def seed():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Tenant).where(Tenant.name == "dev"))
        tenant = result.scalar_one_or_none()
        
        if not tenant:
            api_key = "dev-api-key-12345"
            tenant = Tenant(
                name="dev",
                api_key_hash=hash_api_key(api_key)
            )
            session.add(tenant)
            await session.flush()
            print(f"Created dev tenant with API key: {api_key}")
        
        for metric_data in PREDEFINED_METRICS:
            result = await session.execute(
                select(MetricDefinition).where(
                    MetricDefinition.tenant_id == tenant.id,
                    MetricDefinition.name == metric_data["name"]
                )
            )
            if not result.scalar_one_or_none():
                metric = MetricDefinition(
                    tenant_id=tenant.id,
                    name=metric_data["name"],
                    type=metric_data["type"],
                    config=metric_data["config"]
                )
                session.add(metric)
                print(f"Created predefined metric: {metric_data['name']}")
        
        await session.commit()

if __name__ == "__main__":
    asyncio.run(seed())