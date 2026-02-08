from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, aliased

from app.api.deps import require_admin, require_user
from app.api.root_access import ensure_root_exists, require_root_access
from app.db.session import get_db
from app.models.connection import Connection, ConnectionTechnology
from app.models.device import Device
from app.models.interface import Interface
from app.models.user import User
from app.models.vlan import Vlan

router = APIRouter(prefix="/connections", tags=["connections"])

TECHNOLOGY_RECEIVER_CAPABILITY = {
    ConnectionTechnology.ZIGBEE: "supports_zigbee",
    ConnectionTechnology.MATTER_OVER_THREAD: "supports_matter_thread",
    ConnectionTechnology.BLUETOOTH: "supports_bluetooth",
    ConnectionTechnology.BLE: "supports_ble",
}


class ConnectionResponse(BaseModel):
    id: UUID
    root_id: UUID
    from_interface_id: UUID
    to_interface_id: UUID
    from_device_id: UUID
    to_device_id: UUID
    receiver_id: UUID | None
    technology: ConnectionTechnology
    vlan_id: UUID | None
    notes: str | None
    created_at: datetime


class CreateConnectionRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    root_id: UUID
    from_interface_id: UUID
    to_interface_id: UUID
    receiver_id: UUID | None = None
    technology: ConnectionTechnology
    vlan_id: UUID | None = None
    notes: str | None = None


def _get_interface_with_device(db: Session, interface_id: UUID) -> tuple[Interface, Device]:
    row = db.execute(
        select(Interface, Device)
        .join(Device, Interface.device_id == Device.id)
        .where(Interface.id == interface_id)
        .limit(1)
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interface not found")
    return row[0], row[1]


def _validate_vlan(db: Session, root_id: UUID, vlan_id: UUID | None) -> None:
    if vlan_id is None:
        return
    vlan = db.get(Vlan, vlan_id)
    if vlan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="VLAN not found")
    if vlan.root_id != root_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="VLAN must belong to the same root")


def _validate_receiver(db: Session, root_id: UUID, technology: ConnectionTechnology, receiver_id: UUID | None) -> UUID | None:
    required_capability = TECHNOLOGY_RECEIVER_CAPABILITY.get(technology)
    if required_capability is None and receiver_id is None:
        return None

    if receiver_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Receiver is required for {technology.value}",
        )

    receiver = db.get(Device, receiver_id)
    if receiver is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receiver device not found")
    if receiver.root_id != root_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Receiver must belong to the same root")
    if not receiver.is_receiver:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Selected device is not a receiver")

    if required_capability and not bool(getattr(receiver, required_capability)):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Receiver does not support {technology.value}",
        )

    return receiver.id


@router.post("", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
def create_connection(
    payload: CreateConnectionRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ConnectionResponse:
    ensure_root_exists(db, payload.root_id)

    if payload.from_interface_id == payload.to_interface_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Connection endpoints must be different")

    from_interface, from_device = _get_interface_with_device(db, payload.from_interface_id)
    to_interface, to_device = _get_interface_with_device(db, payload.to_interface_id)

    if from_device.root_id != to_device.root_id or from_device.root_id != payload.root_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Both interfaces must belong to devices in the same root",
        )

    if payload.technology == ConnectionTechnology.ETHERNET and payload.vlan_id is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="VLAN is required for ETHERNET")
    if payload.technology != ConnectionTechnology.ETHERNET and payload.vlan_id is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="VLAN can be used only for ETHERNET connections",
        )

    _validate_vlan(db, payload.root_id, payload.vlan_id)
    validated_receiver_id = _validate_receiver(db, payload.root_id, payload.technology, payload.receiver_id)

    connection = Connection(
        root_id=payload.root_id,
        from_interface_id=from_interface.id,
        to_interface_id=to_interface.id,
        receiver_id=validated_receiver_id,
        technology=payload.technology,
        vlan_id=payload.vlan_id,
        notes=payload.notes,
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)

    return ConnectionResponse(
        id=connection.id,
        root_id=connection.root_id,
        from_interface_id=connection.from_interface_id,
        to_interface_id=connection.to_interface_id,
        from_device_id=from_device.id,
        to_device_id=to_device.id,
        receiver_id=connection.receiver_id,
        technology=connection.technology,
        vlan_id=connection.vlan_id,
        notes=connection.notes,
        created_at=connection.created_at,
    )


@router.get("", response_model=list[ConnectionResponse])
def list_connections(
    root_id: UUID = Query(...),
    device_id: UUID | None = Query(default=None),
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> list[ConnectionResponse]:
    require_root_access(db, current_user, root_id)
    ensure_root_exists(db, root_id)

    from_interface = aliased(Interface)
    to_interface = aliased(Interface)

    query = (
        select(Connection, from_interface.device_id.label("from_device_id"), to_interface.device_id.label("to_device_id"))
        .join(from_interface, Connection.from_interface_id == from_interface.id)
        .join(to_interface, Connection.to_interface_id == to_interface.id)
        .where(Connection.root_id == root_id)
    )

    if device_id is not None:
        query = query.where(or_(from_interface.device_id == device_id, to_interface.device_id == device_id))

    rows = db.execute(query.order_by(Connection.created_at.desc())).all()
    return [
        ConnectionResponse(
            id=row[0].id,
            root_id=row[0].root_id,
            from_interface_id=row[0].from_interface_id,
            to_interface_id=row[0].to_interface_id,
            from_device_id=row[1],
            to_device_id=row[2],
            receiver_id=row[0].receiver_id,
            technology=row[0].technology,
            vlan_id=row[0].vlan_id,
            notes=row[0].notes,
            created_at=row[0].created_at,
        )
        for row in rows
    ]
