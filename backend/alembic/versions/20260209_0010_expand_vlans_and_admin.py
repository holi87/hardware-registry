"""expand vlan fields and admin operations support

Revision ID: 20260209_0010
Revises: 20260209_0009
Create Date: 2026-02-09 01:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260209_0010"
down_revision: Union[str, None] = "20260209_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("vlans", sa.Column("subnet_mask", sa.String(length=64), nullable=True))
    op.add_column("vlans", sa.Column("ip_range_start", sa.String(length=64), nullable=True))
    op.add_column("vlans", sa.Column("ip_range_end", sa.String(length=64), nullable=True))

    op.execute("UPDATE vlans SET subnet_mask = '255.255.255.0' WHERE subnet_mask IS NULL")
    op.execute("UPDATE vlans SET ip_range_start = '0.0.0.0' WHERE ip_range_start IS NULL")
    op.execute("UPDATE vlans SET ip_range_end = '0.0.0.0' WHERE ip_range_end IS NULL")

    op.alter_column("vlans", "subnet_mask", nullable=False)
    op.alter_column("vlans", "ip_range_start", nullable=False)
    op.alter_column("vlans", "ip_range_end", nullable=False)


def downgrade() -> None:
    op.drop_column("vlans", "ip_range_end")
    op.drop_column("vlans", "ip_range_start")
    op.drop_column("vlans", "subnet_mask")
