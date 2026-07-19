import pytest
from httpx import AsyncClient

SAMPLE_EVALUATE_REQUEST = {
    "metadata": {"env": "test"},
    "metrics": ["faithfulness"],
    "items": [{"query": "Q", "response": "R", "contexts": ["C"]}]
}

@pytest.mark.asyncio
class TestBatchEvaluate:
    async def test_evaluate_returns_202_and_triggers_celery(self, auth_client: AsyncClient):
        response = await auth_client.post("/api/v1/evaluate", json=SAMPLE_EVALUATE_REQUEST)
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "pending"
        
        # Karena Celery di-mock di conftest, status tetap pending di DB
        list_resp = await auth_client.get("/api/v1/evaluations")
        assert list_resp.json()["items"][0]["status"] == "pending"

@pytest.mark.asyncio
class TestGetEvaluationDetail:
    async def test_get_completed_run_detail(self, auth_client: AsyncClient, completed_run_with_scores: dict):
        run_id = completed_run_with_scores["run_id"]
        response = await auth_client.get(f"/api/v1/evaluations/{run_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["summary"]["faithfulness"] == 0.95
        assert len(data["items"]) == 1