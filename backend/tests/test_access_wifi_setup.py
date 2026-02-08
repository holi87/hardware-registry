import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api import connections as connections_module
from app.api import root_access as root_access_module
from app.api import setup as setup_api
from app.api import wifi as wifi_module
from app.core.crypto import encrypt_secret
from app.models.connection import ConnectionTechnology
from app.models.user import UserRole


def test_require_root_access_allows_assigned_root(monkeypatch):
    root_id = uuid.uuid4()
    user = SimpleNamespace(id=uuid.uuid4(), role=UserRole.USER)

    monkeypatch.setattr(root_access_module, "get_accessible_root_ids", lambda _db, _user: {root_id})

    root_access_module.require_root_access(object(), user, root_id)


def test_require_root_access_blocks_unassigned_root(monkeypatch):
    user = SimpleNamespace(id=uuid.uuid4(), role=UserRole.USER)

    monkeypatch.setattr(root_access_module, "get_accessible_root_ids", lambda _db, _user: set())

    with pytest.raises(HTTPException) as exc:
        root_access_module.require_root_access(object(), user, uuid.uuid4())

    assert exc.value.status_code == 403


class FakeDb:
    def __init__(self, network=None, scalar_result=None):
        self._network = network
        self._scalar_result = scalar_result

    def get(self, _model, _id):
        return self._network

    def scalar(self, *_args, **_kwargs):
        return self._scalar_result


def test_wifi_reveal_allows_admin_without_root_check(monkeypatch):
    network = SimpleNamespace(
        id=uuid.uuid4(),
        root_id=uuid.uuid4(),
        password_encrypted=encrypt_secret("Secret!2026"),
    )
    db = FakeDb(network=network)

    # Ensure this is not called for admins.
    monkeypatch.setattr(wifi_module, "require_root_access", lambda *_args, **_kwargs: (_ for _ in ()).throw(Exception()))

    response = wifi_module.reveal_wifi_password(network.id, SimpleNamespace(role=UserRole.ADMIN), db)

    assert response.password == "Secret!2026"


def test_wifi_reveal_blocks_user_without_root_access(monkeypatch):
    network = SimpleNamespace(
        id=uuid.uuid4(),
        root_id=uuid.uuid4(),
        password_encrypted=encrypt_secret("Secret!2026"),
    )
    db = FakeDb(network=network)

    def deny(*_args, **_kwargs):
        raise HTTPException(status_code=403, detail="No access")

    monkeypatch.setattr(wifi_module, "require_root_access", deny)

    with pytest.raises(HTTPException) as exc:
        wifi_module.reveal_wifi_password(network.id, SimpleNamespace(role=UserRole.USER), db)

    assert exc.value.status_code == 403


def test_setup_status_reports_needs_setup_true_without_admin():
    db = FakeDb(scalar_result=None)

    response = setup_api.setup_status(db=db)

    assert response.needs_setup is True


def test_create_first_admin_blocks_when_setup_completed(monkeypatch):
    payload = setup_api.SetupAdminRequest(email="admin@example.com", password="StrongPassword!2026")

    monkeypatch.setattr(setup_api, "_needs_setup", lambda _db: False)

    with pytest.raises(HTTPException) as exc:
        setup_api.create_first_admin(payload, db=FakeDb())

    assert exc.value.status_code == 409


def test_create_first_admin_rejects_weak_password(monkeypatch):
    payload = setup_api.SetupAdminRequest(email="admin@example.com", password="weak")

    monkeypatch.setattr(setup_api, "_needs_setup", lambda _db: True)

    with pytest.raises(HTTPException) as exc:
        setup_api.create_first_admin(payload, db=FakeDb())

    assert exc.value.status_code == 422


def test_wifi_create_request_requires_vlan():
    with pytest.raises(ValidationError):
        wifi_module.CreateWifiRequest(
            root_id=uuid.uuid4(),
            space_id=uuid.uuid4(),
            ssid="Office",
            password="Secret!12345",
            security="WPA2",
        )


class FakeDeviceDb:
    def __init__(self, devices_by_id=None):
        self._devices_by_id = devices_by_id or {}

    def get(self, _model, entity_id):
        return self._devices_by_id.get(entity_id)


def test_connection_receiver_is_required_for_zigbee():
    with pytest.raises(HTTPException) as exc:
        connections_module._validate_receiver(
            object(),
            uuid.uuid4(),
            ConnectionTechnology.ZIGBEE,
            None,
        )

    assert exc.value.status_code == 422
    assert "Receiver is required" in str(exc.value.detail)


def test_connection_receiver_requires_technology_capability():
    root_id = uuid.uuid4()
    receiver_id = uuid.uuid4()
    receiver = SimpleNamespace(
        id=receiver_id,
        root_id=root_id,
        is_receiver=True,
        supports_zigbee=False,
    )
    db = FakeDeviceDb({receiver_id: receiver})

    with pytest.raises(HTTPException) as exc:
        connections_module._validate_receiver(
            db,
            root_id,
            ConnectionTechnology.ZIGBEE,
            receiver_id,
        )

    assert exc.value.status_code == 422
    assert "does not support" in str(exc.value.detail)


def test_connection_receiver_accepts_valid_receiver():
    root_id = uuid.uuid4()
    receiver_id = uuid.uuid4()
    receiver = SimpleNamespace(
        id=receiver_id,
        root_id=root_id,
        is_receiver=True,
        supports_ble=True,
    )
    db = FakeDeviceDb({receiver_id: receiver})

    validated = connections_module._validate_receiver(
        db,
        root_id,
        ConnectionTechnology.BLE,
        receiver_id,
    )

    assert validated == receiver_id
