from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_user
from app.api.root_access import ensure_root_exists, require_root_access
from app.core.crypto import decrypt_secret, encrypt_secret
from app.db.session import get_db
from app.models.location import Location
from app.models.user import User, UserRole
from app.models.vlan import Vlan
from app.models.wifi_network import WifiNetwork

router = APIRouter(prefix="/wifi", tags=["wifi"])


class WifiNetworkResponse(BaseModel):
    id: UUID
    root_id: UUID
    space_id: UUID
    ssid: str
    security: str
    vlan_id: UUID | None
    notes: str | None
    created_at: datetime


class CreateWifiRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    root_id: UUID
    space_id: UUID
    ssid: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=4096)
    security: str = Field(min_length=1, max_length=100)
    vlan_id: UUID
    notes: str | None = None


class RevealWifiResponse(BaseModel):
    password: str


def _validate_space(db: Session, root_id: UUID, space_id: UUID) -> None:
    space = db.get(Location, space_id)
    if space is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    if space.root_id != root_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Space must belong to the same root")


def _validate_vlan(db: Session, root_id: UUID, vlan_id: UUID) -> None:
    vlan = db.get(Vlan, vlan_id)
    if vlan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VLAN not found")
    if vlan.root_id != root_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="VLAN must belong to the same root")


@router.get("", response_model=list[WifiNetworkResponse])
def list_wifi(
    root_id: UUID = Query(...),
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> list[WifiNetworkResponse]:
    require_root_access(db, current_user, root_id)
    ensure_root_exists(db, root_id)

    networks = db.scalars(
        select(WifiNetwork)
        .where(WifiNetwork.root_id == root_id)
        .order_by(WifiNetwork.ssid.asc(), WifiNetwork.created_at.asc())
    ).all()

    return [
        WifiNetworkResponse(
            id=network.id,
            root_id=network.root_id,
            space_id=network.space_id,
            ssid=network.ssid,
            security=network.security,
            vlan_id=network.vlan_id,
            notes=network.notes,
            created_at=network.created_at,
        )
        for network in networks
    ]


@router.post("", response_model=WifiNetworkResponse, status_code=status.HTTP_201_CREATED)
def create_wifi(
    payload: CreateWifiRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> WifiNetworkResponse:
    ensure_root_exists(db, payload.root_id)
    _validate_space(db, payload.root_id, payload.space_id)
    _validate_vlan(db, payload.root_id, payload.vlan_id)

    network = WifiNetwork(
        root_id=payload.root_id,
        space_id=payload.space_id,
        ssid=payload.ssid,
        password_encrypted=encrypt_secret(payload.password),
        security=payload.security,
        vlan_id=payload.vlan_id,
        notes=payload.notes,
    )
    db.add(network)
    db.commit()
    db.refresh(network)

    return WifiNetworkResponse(
        id=network.id,
        root_id=network.root_id,
        space_id=network.space_id,
        ssid=network.ssid,
        security=network.security,
        vlan_id=network.vlan_id,
        notes=network.notes,
        created_at=network.created_at,
    )


@router.post("/{wifi_id}/reveal", response_model=RevealWifiResponse)
def reveal_wifi_password(
    wifi_id: UUID,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> RevealWifiResponse:
    network = db.get(WifiNetwork, wifi_id)
    if network is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wi-Fi network not found")

    if current_user.role != UserRole.ADMIN:
        require_root_access(db, current_user, network.root_id)

    return RevealWifiResponse(password=decrypt_secret(network.password_encrypted))
