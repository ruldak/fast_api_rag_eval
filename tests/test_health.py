"""Tests for /health and /ready endpoints (no auth required)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestHealthCheck:
    async def test_health_returns_200(self, client: AsyncClient):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        assert "version" in data
        assert "environment" in data

    async def test_health_has_correct_content_type(self, client: AsyncClient):
        response = await client.get("/health")
        assert "application/json" in response.headers["content-type"]


@pytest.mark.asyncio
class TestReadinessCheck:
    async def test_ready_returns_200(self, client: AsyncClient):
        response = await client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["ready"] is True

    async def test_ready_without_trailing_slash(self, client: AsyncClient):
        """Ensure the route works without redirect."""
        response = await client.get("/ready")
        assert response.status_code == 200