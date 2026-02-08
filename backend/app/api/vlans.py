from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_user
from app.api.root_access import ensure_root_exists, require_root_access
from app.db.session import get_db
from app.models.user import User
from app.models.vlan import Vlan

router = APIRouter(prefix="/vlans", tags=["vlans"])


class VlanResponse(BaseModel):
    id: UUID
    root_id: UUID
    vlan_id: int
    name: str
    notes: str | None
    created_at: datetime


class CreateVlanRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    root_id: UUID
    vlan_id: int = Field(ge=1, le=4094)
    name: str = Field(min_length=1, max_length=255)
    notes: str | None = None


class UpdateVlanRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    vlan_id: int | None = Field(default=None, ge=1, le=4094)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    notes: str | None = None


@router.get("", response_model=list[VlanResponse])
def list_vlans(
    root_id: UUID = Query(...),
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> list[VlanResponse]:
    require_root_access(db, current_user, root_id)
    ensure_root_exists(db, root_id)

    vlans = db.scalars(select(Vlan).where(Vlan.root_id == root_id).order_by(Vlan.vlan_id.asc(), Vlan.name.asc())).all()
    return [
        VlanResponse(
            id=vlan.id,
            root_id=vlan.root_id,
            vlan_id=vlan.vlan_id,
            name=vlan.name,
            notes=vlan.notes,
            created_at=vlan.created_at,
        )
        for vlan in vlans
    ]


@router.post("", response_model=VlanResponse, status_code=status.HTTP_201_CREATED)
def create_vlan(
    payload: CreateVlanRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> VlanResponse:
    ensure_root_exists(db, payload.root_id)

    vlan = Vlan(
        root_id=payload.root_id,
        vlan_id=payload.vlan_id,
        name=payload.name,
        notes=payload.notes,
    )
    db.add(vlan)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="VLAN already exists in this root") from exc

    db.refresh(vlan)
    return VlanResponse(
        id=vlan.id,
        root_id=vlan.root_id,
        vlan_id=vlan.vlan_id,
        name=vlan.name,
        notes=vlan.notes,
        created_at=vlan.created_at,
    )


@router.patch("/{vlan_id}", response_model=VlanResponse)
def update_vlan(
    vlan_id: UUID,
    payload: UpdateVlanRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> VlanResponse:
    vlan = db.get(Vlan, vlan_id)
    if vlan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VLAN not found")

    if payload.name is not None:
        vlan.name = payload.name
    if payload.vlan_id is not None:
        vlan.vlan_id = payload.vlan_id
    if "notes" in payload.model_fields_set:
        vlan.notes = payload.notes

    db.add(vlan)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="VLAN already exists in this root") from exc

    db.refresh(vlan)
    return VlanResponse(
        id=vlan.id,
        root_id=vlan.root_id,
        vlan_id=vlan.vlan_id,
        name=vlan.name,
        notes=vlan.notes,
        created_at=vlan.created_at,
    )
