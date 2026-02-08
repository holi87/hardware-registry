"""add receiver capabilities and receiver reference for connections

Revision ID: 20260209_0009
Revises: 20260208_0008
Create Date: 2026-02-09 00:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260209_0009"
down_revision: Union[str, None] = "20260208_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column("is_receiver", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "devices",
        sa.Column("supports_wifi", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "devices",
        sa.Column("supports_ethernet", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "devices",
        sa.Column("supports_zigbee", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "devices",
        sa.Column("supports_matter_thread", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "devices",
        sa.Column("supports_bluetooth", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "devices",
        sa.Column("supports_ble", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.add_column("connections", sa.Column("receiver_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_connections_receiver_id", "connections", ["receiver_id"], unique=False)
    op.create_foreign_key(
        "fk_connections_receiver_id_devices",
        "connections",
        "devices",
        ["receiver_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_connections_receiver_id_devices", "connections", type_="foreignkey")
    op.drop_index("ix_connections_receiver_id", table_name="connections")
    op.drop_column("connections", "receiver_id")

    op.drop_column("devices", "supports_ble")
    op.drop_column("devices", "supports_bluetooth")
    op.drop_column("devices", "supports_matter_thread")
    op.drop_column("devices", "supports_zigbee")
    op.drop_column("devices", "supports_ethernet")
    op.drop_column("devices", "supports_wifi")
    op.drop_column("devices", "is_receiver")
