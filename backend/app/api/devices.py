from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_user
from app.api.root_access import ensure_root_exists, require_root_access
from app.db.session import get_db
from app.models.device import Device
from app.models.interface import Interface
from app.models.location import Location
from app.models.user import User

router = APIRouter(prefix="/devices", tags=["devices"])


class InterfaceResponse(BaseModel):
    id: UUID
    device_id: UUID
    name: str
    type: str
    mac: str | None
    notes: str | None
    created_at: datetime


class DeviceSummaryResponse(BaseModel):
    id: UUID
    root_id: UUID
    space_id: UUID
    name: str
    type: str
    vendor: str | None
    model: str | None
    serial: str | None
    notes: str | None
    created_at: datetime


class DeviceDetailResponse(DeviceSummaryResponse):
    interfaces: list[InterfaceResponse]


class CreateDeviceRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    root_id: UUID
    space_id: UUID
    name: str = Field(min_length=1, max_length=255)
    type: str = Field(min_length=1, max_length=100)
    vendor: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    serial: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class UpdateDeviceRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    space_id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    type: str | None = Field(default=None, min_length=1, max_length=100)
    vendor: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    serial: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class CreateInterfaceRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    type: str = Field(min_length=1, max_length=100)
    mac: str | None = Field(default=None, max_length=64)
    notes: str | None = None


def _device_to_summary(device: Device) -> DeviceSummaryResponse:
    return DeviceSummaryResponse(
        id=device.id,
        root_id=device.root_id,
        space_id=device.space_id,
        name=device.name,
        type=device.type,
        vendor=device.vendor,
        model=device.model,
        serial=device.serial,
        notes=device.notes,
        created_at=device.created_at,
    )


def _interface_to_response(interface: Interface) -> InterfaceResponse:
    return InterfaceResponse(
        id=interface.id,
        device_id=interface.device_id,
        name=interface.name,
        type=interface.type,
        mac=interface.mac,
        notes=interface.notes,
        created_at=interface.created_at,
    )


def _validate_space(db: Session, root_id: UUID, space_id: UUID) -> None:
    space = db.get(Location, space_id)
    if space is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    if space.root_id != root_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Space must belong to the same root")


@router.get("", response_model=list[DeviceSummaryResponse])
def list_devices(
    root_id: UUID = Query(...),
    space_id: UUID | None = Query(default=None),
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> list[DeviceSummaryResponse]:
    require_root_access(db, current_user, root_id)
    ensure_root_exists(db, root_id)

    query = select(Device).where(Device.root_id == root_id)
    if space_id is not None:
        _validate_space(db, root_id, space_id)
        query = query.where(Device.space_id == space_id)

    devices = db.scalars(query.order_by(Device.name.asc(), Device.created_at.asc())).all()
    return [_device_to_summary(device) for device in devices]


@router.post("", response_model=DeviceSummaryResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: CreateDeviceRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DeviceSummaryResponse:
    ensure_root_exists(db, payload.root_id)
    _validate_space(db, payload.root_id, payload.space_id)

    device = Device(
        root_id=payload.root_id,
        space_id=payload.space_id,
        name=payload.name,
        type=payload.type,
        vendor=payload.vendor,
        model=payload.model,
        serial=payload.serial,
        notes=payload.notes,
    )
    db.add(device)
    db.commit()
    db.refresh(device)

    return _device_to_summary(device)


@router.get("/{device_id}", response_model=DeviceDetailResponse)
def get_device(
    device_id: UUID,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> DeviceDetailResponse:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    require_root_access(db, current_user, device.root_id)

    interfaces = db.scalars(select(Interface).where(Interface.device_id == device.id).order_by(Interface.name.asc())).all()
    return DeviceDetailResponse(
        **_device_to_summary(device).model_dump(),
        interfaces=[_interface_to_response(interface) for interface in interfaces],
    )


@router.patch("/{device_id}", response_model=DeviceSummaryResponse)
def update_device(
    device_id: UUID,
    payload: UpdateDeviceRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DeviceSummaryResponse:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    if payload.space_id is not None:
        _validate_space(db, device.root_id, payload.space_id)
        device.space_id = payload.space_id
    if payload.name is not None:
        device.name = payload.name
    if payload.type is not None:
        device.type = payload.type
    if "vendor" in payload.model_fields_set:
        device.vendor = payload.vendor
    if "model" in payload.model_fields_set:
        device.model = payload.model
    if "serial" in payload.model_fields_set:
        device.serial = payload.serial
    if "notes" in payload.model_fields_set:
        device.notes = payload.notes

    db.add(device)
    db.commit()
    db.refresh(device)

    return _device_to_summary(device)


@router.post("/{device_id}/interfaces", response_model=InterfaceResponse, status_code=status.HTTP_201_CREATED)
def create_interface(
    device_id: UUID,
    payload: CreateInterfaceRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> InterfaceResponse:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    interface = Interface(
        device_id=device.id,
        name=payload.name,
        type=payload.type,
        mac=payload.mac,
        notes=payload.notes,
    )
    db.add(interface)
    db.commit()
    db.refresh(interface)

    return _interface_to_response(interface)
