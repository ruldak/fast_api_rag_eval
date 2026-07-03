import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
class TestHumanReviews:
    async def test_submit_human_review_calculates_agreement_delta(
        self, auth_client: AsyncClient, completed_run_with_scores: dict
    ):
        payload = {
            "item_id": completed_run_with_scores["item_id"],
            "metric_id": completed_run_with_scores["metric_id"],
            "human_score": 0.80,  # LLM score di fixture adalah 0.95
            "human_reason": "Kurang detail",
            "reviewer_id": "user_123"
        }
        response = await auth_client.post("/api/v1/human-reviews", json=payload)
        assert response.status_code == 201
        
        data = response.json()
        assert data["llm_score"] == 0.95
        assert data["human_score"] == 0.80
        # Validasi logic: agreement_delta = human_score - llm_score
        assert data["agreement_delta"] == -0.15 

    async def test_submit_human_review_invalid_item_for_tenant(self, auth_client: AsyncClient):
        import uuid
        payload = {
            "item_id": str(uuid.uuid4()), # Item acak tidak akan ditemukan
            "metric_id": str(uuid.uuid4()),
            "human_score": 0.5,
            "reviewer_id": "user_123"
        }
        response = await auth_client.post("/api/v1/human-reviews", json=payload)
        assert response.status_code == 404