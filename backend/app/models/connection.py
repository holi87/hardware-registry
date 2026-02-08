import enum
import uuid

from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ConnectionTechnology(str, enum.Enum):
    ETHERNET = "ETHERNET"
    FIBER = "FIBER"
    WIFI = "WIFI"
    ZIGBEE = "ZIGBEE"
    MATTER_OVER_THREAD = "MATTER_OVER_THREAD"
    BLUETOOTH = "BLUETOOTH"
    BLE = "BLE"
    SERIAL = "SERIAL"
    OTHER = "OTHER"


class Connection(Base):
    __tablename__ = "connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    root_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_interface_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interfaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    to_interface_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interfaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    receiver_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    technology: Mapped[ConnectionTechnology] = mapped_column(
        Enum(ConnectionTechnology, name="connection_technology"),
        nullable=False,
    )
    vlan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vlans.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
