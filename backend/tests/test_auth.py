import uuid
from dataclasses import dataclass

from fastapi.testclient import TestClient

from app.main import app
from app.api import auth as auth_module


@dataclass
class DummyUser:
    id: uuid.UUID
    email: str
    role: type("R", (), {"value": "ADMIN"})
    is_active: bool = True


def test_login_success(monkeypatch):
    user = DummyUser(id=uuid.uuid4(), email="admin@test.local", role=type("Role", (), {"value": "ADMIN"}))

    def fake_authenticate(_db, _email, _password):
        return user

    monkeypatch.setattr(auth_module, "authenticate_credentials", fake_authenticate)

    client = TestClient(app)
    response = client.post("/api/auth/login", json={"email": "admin@test.local", "password": "StrongPass!2026"})

    assert response.status_code == 200
    payload = response.json()
    assert "access_token" in payload
    assert "refresh_token" in payload
    assert payload["token_type"] == "bearer"


def test_login_wrong_password(monkeypatch):
    def fake_authenticate(_db, _email, _password):
        return None

    monkeypatch.setattr(auth_module, "authenticate_credentials", fake_authenticate)

    client = TestClient(app)
    response = client.post("/api/auth/login", json={"email": "admin@test.local", "password": "wrong"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"
