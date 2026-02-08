from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.api.deps import require_user
from app.api.root_access import ensure_root_exists, require_root_access
from app.db.session import get_db
from app.models.connection import Connection, ConnectionTechnology
from app.models.device import Device
from app.models.interface import Interface
from app.models.user import User

router = APIRouter(prefix="/graph", tags=["graph"])


class GraphDeviceNode(BaseModel):
    id: UUID
    name: str
    type: str
    space_id: UUID
    vendor: str | None
    model: str | None
    created_at: datetime


class GraphConnectionEdge(BaseModel):
    id: UUID
    from_device_id: UUID
    to_device_id: UUID
    from_interface_id: UUID
    to_interface_id: UUID
    technology: ConnectionTechnology
    vlan_id: UUID | None
    notes: str | None
    created_at: datetime


class GraphResponse(BaseModel):
    devices: list[GraphDeviceNode]
    connections: list[GraphConnectionEdge]


@router.get("", response_model=GraphResponse)
def graph(
    root_id: UUID = Query(...),
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> GraphResponse:
    require_root_access(db, current_user, root_id)
    ensure_root_exists(db, root_id)

    devices = db.scalars(select(Device).where(Device.root_id == root_id).order_by(Device.name.asc())).all()

    from_interface = aliased(Interface)
    to_interface = aliased(Interface)

    rows = db.execute(
        select(Connection, from_interface.device_id.label("from_device_id"), to_interface.device_id.label("to_device_id"))
        .join(from_interface, Connection.from_interface_id == from_interface.id)
        .join(to_interface, Connection.to_interface_id == to_interface.id)
        .where(Connection.root_id == root_id)
        .order_by(Connection.created_at.asc())
    ).all()

    return GraphResponse(
        devices=[
            GraphDeviceNode(
                id=device.id,
                name=device.name,
                type=device.type,
                space_id=device.space_id,
                vendor=device.vendor,
                model=device.model,
                created_at=device.created_at,
            )
            for device in devices
        ],
        connections=[
            GraphConnectionEdge(
                id=row[0].id,
                from_device_id=row[1],
                to_device_id=row[2],
                from_interface_id=row[0].from_interface_id,
                to_interface_id=row[0].to_interface_id,
                technology=row[0].technology,
                vlan_id=row[0].vlan_id,
                notes=row[0].notes,
                created_at=row[0].created_at,
            )
            for row in rows
        ],
    )
