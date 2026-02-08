import io
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.api.deps import require_user
from app.api.root_access import ensure_root_exists, require_root_access
from app.db.session import get_db
from app.models.connection import Connection
from app.models.device import Device
from app.models.interface import Interface
from app.models.user import User

router = APIRouter(prefix="/topology", tags=["topology"])


@router.get("/png")
def topology_png(
    root_id: UUID = Query(...),
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> Response:
    require_root_access(db, current_user, root_id)
    ensure_root_exists(db, root_id)

    devices = db.scalars(select(Device).where(Device.root_id == root_id).order_by(Device.name.asc())).all()

    from_interface = aliased(Interface)
    to_interface = aliased(Interface)
    rows = db.execute(
        select(
            Connection,
            from_interface.device_id.label("from_device_id"),
            to_interface.device_id.label("to_device_id"),
            from_interface.name.label("from_interface_name"),
            to_interface.name.label("to_interface_name"),
        )
        .join(from_interface, Connection.from_interface_id == from_interface.id)
        .join(to_interface, Connection.to_interface_id == to_interface.id)
        .where(Connection.root_id == root_id)
        .order_by(Connection.created_at.asc())
    ).all()

    width = 1500
    max_rows = max(len(devices), len(rows), 1)
    height = 160 + max_rows * 32

    image = Image.new("RGB", (width, height), color="#f8fafc")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()

    draw.rectangle((20, 20, width - 20, 60), fill="#0f172a")
    draw.text((30, 34), f"Hardware Registry Topology (root: {root_id})", fill="#ffffff", font=font)

    draw.text((30, 80), "Devices", fill="#0f172a", font=font)
    draw.text((760, 80), "Connections", fill="#0f172a", font=font)

    device_name_by_id = {device.id: device.name for device in devices}

    y = 110
    for index, device in enumerate(devices, start=1):
        capabilities = []
        if device.is_receiver:
            if device.supports_zigbee:
                capabilities.append("Zigbee")
            if device.supports_matter_thread:
                capabilities.append("MatterThread")
            if device.supports_bluetooth:
                capabilities.append("Bluetooth")
            if device.supports_ble:
                capabilities.append("BLE")
            if device.supports_wifi:
                capabilities.append("WiFi")
            if device.supports_ethernet:
                capabilities.append("Eth")

        receiver_suffix = ""
        if device.is_receiver:
            receiver_suffix = f" [receiver: {', '.join(capabilities) if capabilities else 'yes'}]"

        line = f"{index:02d}. {device.name} ({device.type}){receiver_suffix}"
        draw.text((30, y), line, fill="#1e293b", font=font)
        y += 30

    y = 110
    for index, row in enumerate(rows, start=1):
        connection = row[0]
        from_device = device_name_by_id.get(row[1], str(row[1]))
        to_device = device_name_by_id.get(row[2], str(row[2]))
        receiver = device_name_by_id.get(connection.receiver_id, "-") if connection.receiver_id else "-"
        vlan = connection.vlan_id if connection.vlan_id else "-"
        line = (
            f"{index:02d}. {from_device}:{row[3]} -> {to_device}:{row[4]} | "
            f"{connection.technology.value} | VLAN: {vlan} | RX: {receiver}"
        )
        draw.text((760, y), line, fill="#1e293b", font=font)
        y += 30

    output = io.BytesIO()
    image.save(output, format="PNG")
    output.seek(0)
    return Response(content=output.read(), media_type="image/png")
