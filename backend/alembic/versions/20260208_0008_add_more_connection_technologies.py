"""add extra connection technologies

Revision ID: 20260208_0008
Revises: 20260208_0007
Create Date: 2026-02-08 23:55:00
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260208_0008"
down_revision: Union[str, None] = "20260208_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE connection_technology ADD VALUE IF NOT EXISTS 'ZIGBEE'")
    op.execute("ALTER TYPE connection_technology ADD VALUE IF NOT EXISTS 'MATTER_OVER_THREAD'")
    op.execute("ALTER TYPE connection_technology ADD VALUE IF NOT EXISTS 'BLUETOOTH'")
    op.execute("ALTER TYPE connection_technology ADD VALUE IF NOT EXISTS 'BLE'")


def downgrade() -> None:
    # PostgreSQL enum value removals are intentionally skipped.
    pass
