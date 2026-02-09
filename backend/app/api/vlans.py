from datetime import datetime
import ipaddress
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_user
from app.api.root_access import ensure_root_exists, require_root_access
from app.models.connection import Connection
from app.db.session import get_db
from app.models.user import User
from app.models.vlan import Vlan
from app.models.wifi_network import WifiNetwork

router = APIRouter(prefix="/vlans", tags=["vlans"])


class VlanResponse(BaseModel):
    id: UUID
    root_id: UUID
    vlan_id: int
    name: str
    cidr: str
    notes: str | None
    created_at: datetime


class CreateVlanRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    root_id: UUID
    vlan_id: int = Field(ge=1, le=4094)
    name: str = Field(min_length=1, max_length=255)
    cidr: str = Field(min_length=1, max_length=64)
    notes: str | None = None


class UpdateVlanRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    vlan_id: int | None = Field(default=None, ge=1, le=4094)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    cidr: str | None = Field(default=None, min_length=1, max_length=64)
    notes: str | None = None


def _normalize_cidr(cidr: str) -> str:
    try:
        network = ipaddress.ip_network(cidr, strict=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid CIDR format") from exc
    return str(network)


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
            cidr=vlan.cidr,
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
    normalized_cidr = _normalize_cidr(payload.cidr)

    vlan = Vlan(
        root_id=payload.root_id,
        vlan_id=payload.vlan_id,
        name=payload.name,
        cidr=normalized_cidr,
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
        cidr=vlan.cidr,
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
    if payload.cidr is not None:
        vlan.cidr = payload.cidr
    if "notes" in payload.model_fields_set:
        vlan.notes = payload.notes

    vlan.cidr = _normalize_cidr(vlan.cidr)

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
        cidr=vlan.cidr,
        notes=vlan.notes,
        created_at=vlan.created_at,
    )


@router.delete("/{vlan_id}")
def delete_vlan(
    vlan_id: UUID,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    vlan = db.get(Vlan, vlan_id)
    if vlan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VLAN not found")

    wifi_dependencies = db.scalar(select(func.count(WifiNetwork.id)).where(WifiNetwork.vlan_id == vlan.id)) or 0
    connection_dependencies = db.scalar(select(func.count(Connection.id)).where(Connection.vlan_id == vlan.id)) or 0
    if wifi_dependencies or connection_dependencies:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot delete VLAN with dependencies. "
                f"Linked Wi-Fi: {wifi_dependencies}, linked connections: {connection_dependencies}. "
                "Remove or edit dependencies first."
            ),
        )

    db.delete(vlan)
    db.commit()
    return {"status": "ok"}
