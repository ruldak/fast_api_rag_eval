import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
class TestCreateTenant:
    async def test_create_tenant_success_and_seeds_metrics(self, client: AsyncClient):
        response = await client.post("/api/v1/tenants", json={"name": "Acme Corp"})
        assert response.status_code == 201
        data = response.json()
        # Sesuaikan dengan prefix asli dari generate_api_key()
        assert data["api_key"].startswith("rag_") 
        
        # ... sisa kode biarkan sama
        
        # Verifikasi predefined metrics otomatis ter-create
        headers = {"X-API-Key": data["api_key"]}
        metrics_resp = await client.get("/api/v1/metrics", headers=headers)
        metric_names = [m["name"] for m in metrics_resp.json()]
        assert "faithfulness" in metric_names
        assert "answer_relevancy" in metric_names
        assert "correctness" in metric_names

    async def test_create_tenant_duplicate_name(self, client: AsyncClient):
        await client.post("/api/v1/tenants", json={"name": "Duplicate Inc"})
        response = await client.post("/api/v1/tenants", json={"name": "Duplicate Inc"})
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]