"""add devices and interfaces tables

Revision ID: 20260208_0005
Revises: 20260208_0004
Create Date: 2026-02-08 22:35:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260208_0005"
down_revision: Union[str, None] = "20260208_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("root_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("space_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("vendor", sa.String(length=100), nullable=True),
        sa.Column("model", sa.String(length=100), nullable=True),
        sa.Column("serial", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["root_id"], ["locations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["space_id"], ["locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_devices_root_id", "devices", ["root_id"], unique=False)
    op.create_index("ix_devices_space_id", "devices", ["space_id"], unique=False)

    op.create_table(
        "interfaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("mac", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["devices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_interfaces_device_id", "interfaces", ["device_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_interfaces_device_id", table_name="interfaces")
    op.drop_table("interfaces")
    op.drop_index("ix_devices_space_id", table_name="devices")
    op.drop_index("ix_devices_root_id", table_name="devices")
    op.drop_table("devices")
