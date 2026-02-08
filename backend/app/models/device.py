import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    root_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    space_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    vendor: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    serial: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_receiver: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    supports_wifi: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    supports_ethernet: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    supports_zigbee: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    supports_matter_thread: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    supports_bluetooth: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    supports_ble: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
