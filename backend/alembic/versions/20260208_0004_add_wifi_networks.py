"""add wifi networks table

Revision ID: 20260208_0004
Revises: 20260208_0003
Create Date: 2026-02-08 22:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260208_0004"
down_revision: Union[str, None] = "20260208_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "wifi_networks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("root_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("space_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ssid", sa.String(length=255), nullable=False),
        sa.Column("password_encrypted", sa.Text(), nullable=False),
        sa.Column("security", sa.String(length=100), nullable=False),
        sa.Column("vlan_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["root_id"], ["locations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["space_id"], ["locations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vlan_id"], ["vlans.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_wifi_networks_root_id", "wifi_networks", ["root_id"], unique=False)
    op.create_index("ix_wifi_networks_space_id", "wifi_networks", ["space_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_wifi_networks_space_id", table_name="wifi_networks")
    op.drop_index("ix_wifi_networks_root_id", table_name="wifi_networks")
    op.drop_table("wifi_networks")
