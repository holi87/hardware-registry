"""add secrets table

Revision ID: 20260208_0007
Revises: 20260208_0006
Create Date: 2026-02-08 23:25:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260208_0007"
down_revision: Union[str, None] = "20260208_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            CREATE TYPE secret_type AS ENUM ('PASSWORD', 'TOKEN', 'API_KEY', 'OTHER');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
        """
    )
    secret_type = postgresql.ENUM(
        "PASSWORD",
        "TOKEN",
        "API_KEY",
        "OTHER",
        name="secret_type",
        create_type=False,
    )

    op.create_table(
        "secrets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("root_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", secret_type, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("encrypted_value", sa.Text(), nullable=False),
        sa.Column("linked_device_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["root_id"], ["locations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["linked_device_id"], ["devices.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_secrets_root_id", "secrets", ["root_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_secrets_root_id", table_name="secrets")
    op.drop_table("secrets")
    sa.Enum(name="secret_type").drop(op.get_bind(), checkfirst=True)
