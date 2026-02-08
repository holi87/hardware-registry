"""add connections table

Revision ID: 20260208_0006
Revises: 20260208_0005
Create Date: 2026-02-08 23:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260208_0006"
down_revision: Union[str, None] = "20260208_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            CREATE TYPE connection_technology AS ENUM ('ETHERNET', 'FIBER', 'WIFI', 'SERIAL', 'OTHER');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    connection_technology = postgresql.ENUM(
        "ETHERNET",
        "FIBER",
        "WIFI",
        "SERIAL",
        "OTHER",
        name="connection_technology",
        create_type=False,
    )

    op.create_table(
        "connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("root_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_interface_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("to_interface_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("technology", connection_technology, nullable=False),
        sa.Column("vlan_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["root_id"], ["locations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_interface_id"], ["interfaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_interface_id"], ["interfaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vlan_id"], ["vlans.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_connections_root_id", "connections", ["root_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_connections_root_id", table_name="connections")
    op.drop_table("connections")
    sa.Enum(name="connection_technology").drop(op.get_bind(), checkfirst=True)
