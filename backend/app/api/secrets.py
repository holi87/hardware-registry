from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.api.root_access import ensure_root_exists
from app.core.crypto import decrypt_secret, encrypt_secret
from app.db.session import get_db
from app.models.device import Device
from app.models.secret import Secret, SecretType
from app.models.user import User

router = APIRouter(prefix="/secrets", tags=["secrets"])


class SecretResponse(BaseModel):
    id: UUID
    root_id: UUID
    type: SecretType
    name: str
    linked_device_id: UUID | None
    notes: str | None
    created_at: datetime


class CreateSecretRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    root_id: UUID
    type: SecretType
    name: str = Field(min_length=1, max_length=255)
    value: str = Field(min_length=1, max_length=4096)
    linked_device_id: UUID | None = None
    notes: str | None = None


class RevealSecretResponse(BaseModel):
    value: str


def _validate_linked_device(db: Session, root_id: UUID, linked_device_id: UUID | None) -> None:
    if linked_device_id is None:
        return
    device = db.get(Device, linked_device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked device not found")
    if device.root_id != root_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Linked device must belong to root")


@router.get("", response_model=list[SecretResponse])
def list_secrets(
    root_id: UUID = Query(...),
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[SecretResponse]:
    ensure_root_exists(db, root_id)

    secrets = db.scalars(select(Secret).where(Secret.root_id == root_id).order_by(Secret.created_at.desc())).all()
    return [
        SecretResponse(
            id=secret.id,
            root_id=secret.root_id,
            type=secret.type,
            name=secret.name,
            linked_device_id=secret.linked_device_id,
            notes=secret.notes,
            created_at=secret.created_at,
        )
        for secret in secrets
    ]


@router.post("", response_model=SecretResponse, status_code=status.HTTP_201_CREATED)
def create_secret(
    payload: CreateSecretRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> SecretResponse:
    ensure_root_exists(db, payload.root_id)
    _validate_linked_device(db, payload.root_id, payload.linked_device_id)

    secret = Secret(
        root_id=payload.root_id,
        type=payload.type,
        name=payload.name,
        encrypted_value=encrypt_secret(payload.value),
        linked_device_id=payload.linked_device_id,
        notes=payload.notes,
    )
    db.add(secret)
    db.commit()
    db.refresh(secret)

    return SecretResponse(
        id=secret.id,
        root_id=secret.root_id,
        type=secret.type,
        name=secret.name,
        linked_device_id=secret.linked_device_id,
        notes=secret.notes,
        created_at=secret.created_at,
    )


@router.post("/{secret_id}/reveal", response_model=RevealSecretResponse)
def reveal_secret(
    secret_id: UUID,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RevealSecretResponse:
    secret = db.get(Secret, secret_id)
    if secret is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found")

    return RevealSecretResponse(value=decrypt_secret(secret.encrypted_value))
