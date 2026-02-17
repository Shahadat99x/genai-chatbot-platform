"""
Smoke tests for the Healthcare Assistant AI API.
Run: pytest tests/ -v  (from apps/api/)
"""
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


def test_health_returns_200():
    """GET /health should return 200 with expected keys."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "service" in data
    assert data["status"] == "ok"
    assert data["service"] == "api"


def test_health_has_subsystem_keys():
    """Health response should report ollama and rag status."""
    resp = client.get("/health")
    data = resp.json()
    assert "ollama_connected" in data
    assert "rag_index_loaded" in data


def test_docs_returns_200():
    """GET /docs should return the Swagger UI page."""
    resp = client.get("/docs")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]


def test_chat_rejects_empty_body():
    """POST /chat with no body should return 422 (validation error)."""
    resp = client.post("/chat")
    assert resp.status_code == 422


def test_ready_returns_json():
    """GET /ready should return valid JSON with expected structure."""
    resp = client.get("/ready")
    assert resp.status_code in (200, 503)
    data = resp.json()
    assert data["status"] in ("ready", "not_ready")
    assert "checks" in data

# ── Async Intake Smoke Tests ──

def test_get_job_returns_queued(client):
    """Test GET /intake/jobs/{id} mocking Redis."""
    # We need to mock redis_client.get_job or the redis client itself
    # Since we can't easily mock the module import inside the route without a fixture,
    # we'll rely on the fact that without Redis running, it might fail or we mock it.
    # Actually, we can just test that the route exists and tries to connect.
    # Better: Mock the service method on the module.
    
    import services.redis_client as rc
    from unittest.mock import MagicMock
    
    original_get = rc.get_job
    rc.get_job = MagicMock(return_value={"id": "job-123", "status": "queued"})
    
    try:
        resp = client.get("/intake/jobs/job-123")
        assert resp.status_code == 200
        assert resp.json()["status"] == "queued"
    finally:
        rc.get_job = original_get

def test_get_job_not_found(client):
    import services.redis_client as rc
    from unittest.mock import MagicMock
    
    original_get = rc.get_job
    rc.get_job = MagicMock(return_value=None)
    
    try:
        resp = client.get("/intake/jobs/nonexistent")
        assert resp.status_code == 404
    finally:
        rc.get_job = original_get
