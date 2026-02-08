"""add vlans table

Revision ID: 20260208_0003
Revises: 20260208_0002
Create Date: 2026-02-08 21:50:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260208_0003"
down_revision: Union[str, None] = "20260208_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vlans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("root_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vlan_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["root_id"], ["locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("root_id", "vlan_id", name="uq_vlans_root_vlan"),
    )
    op.create_index("ix_vlans_root_id", "vlans", ["root_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_vlans_root_id", table_name="vlans")
    op.drop_table("vlans")
