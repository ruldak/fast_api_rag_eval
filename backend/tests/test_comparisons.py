"""Tests for /api/v1/evaluations/compare endpoint."""

import uuid
import pytest
from httpx import AsyncClient


SAMPLE_EVALUATE_REQUEST = {
    "metadata": {"environment": "test"},
    "metrics": ["faithfulness"],
    "items": [
        {
            "query": "What is 2+2?",
            "response": "4",
            "contexts": ["Basic arithmetic: 2+2=4"],
        }
    ],
}


@pytest.mark.asyncio
class TestCompareEvaluations:
    async def test_compare_requires_auth(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/evaluations/compare",
            json={"run_ids": [str(uuid.uuid4())]},
        )
        # FastAPI bisa return 401 atau 422 tergantung urutan evaluasi dependency vs Pydantic
        assert response.status_code in (401, 422)

    async def test_compare_with_valid_runs(self, auth_client: AsyncClient):
        # Create two evaluation runs
        r1 = await auth_client.post("/api/v1/evaluate", json=SAMPLE_EVALUATE_REQUEST)
        r2 = await auth_client.post("/api/v1/evaluate", json={
            **SAMPLE_EVALUATE_REQUEST,
            "metadata": {"environment": "staging"},
        })
        run_id_1 = r1.json()["run_id"]
        run_id_2 = r2.json()["run_id"]

        response = await auth_client.post(
            "/api/v1/evaluations/compare",
            json={"run_ids": [run_id_1, run_id_2]},
        )
        assert response.status_code == 200
        data = response.json()
        assert "comparison" in data
        assert run_id_1 in data["comparison"]
        assert run_id_2 in data["comparison"]

    async def test_compare_empty_run_ids(self, auth_client: AsyncClient):
        response = await auth_client.post(
            "/api/v1/evaluations/compare",
            json={"run_ids": []},
        )
        # Could be 422 (validation) or 200 with empty comparison
        assert response.status_code in (200, 422)

    async def test_compare_nonexistent_run(self, auth_client: AsyncClient):
        response = await auth_client.post(
            "/api/v1/evaluations/compare",
            json={"run_ids": [str(uuid.uuid4())]},
        )
        # API secara eksplisit return 400 jika run tidak ditemukan
        assert response.status_code == 400
        assert "not found" in response.json()["detail"]

    async def test_compare_missing_run_ids_field(self, auth_client: AsyncClient):
        response = await auth_client.post(
            "/api/v1/evaluations/compare",
            json={},
        )
        assert response.status_code == 422