import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
class TestCreateMetric:
    async def test_create_custom_metric_appends_prompt_suffix(self, auth_client: AsyncClient):
        payload = {
            "name": "conciseness",
            "config": {
                "prompt_template": "Rate conciseness: {response}",
                "output_schema": {"score": "float"}
            }
        }
        response = await auth_client.post("/api/v1/metrics", json=payload)
        assert response.status_code == 201
        data = response.json()
        # Validasi logic di metrics.py: suffix harus ditambahkan
        assert "Provide a score from 0.0 to 1.0" in data["config"]["prompt_template"]

@pytest.mark.asyncio
class TestUpdateDeleteMetric:
    async def test_update_predefined_metric_is_forbidden(self, auth_client: AsyncClient):
        metrics = (await auth_client.get("/api/v1/metrics")).json()
        predefined = next(m for m in metrics if m["type"] == "predefined")
        
        response = await auth_client.put(
            f"/api/v1/metrics/{predefined['id']}", 
            json={"name": "new_name"}
        )
        assert response.status_code == 403

    async def test_delete_predefined_metric_is_forbidden(self, auth_client: AsyncClient):
        metrics = (await auth_client.get("/api/v1/metrics")).json()
        predefined = next(m for m in metrics if m["type"] == "predefined")
        
        response = await auth_client.delete(f"/api/v1/metrics/{predefined['id']}")
        assert response.status_code == 403