from fastapi.testclient import TestClient
from app.core.config import get_settings


def test_health_check(client: TestClient):
    """Test that /health returns HTTP 200 with status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_settings_load():
    """Test that application settings load correctly with required attributes."""
    settings = get_settings()
    assert settings.PROJECT_NAME == "Lost and Found Management System"
    assert settings.API_V1_STR == "/api/v1"
    assert isinstance(settings.CORS_ORIGINS, list)
    assert len(settings.CORS_ORIGINS) >= 1
