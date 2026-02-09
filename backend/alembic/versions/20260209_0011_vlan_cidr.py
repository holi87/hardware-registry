"""replace vlan mask/range fields with cidr

Revision ID: 20260209_0011
Revises: 20260209_0010
Create Date: 2026-02-09 20:25:00
"""

from typing import Sequence, Union
import ipaddress

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260209_0011"
down_revision: Union[str, None] = "20260209_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _to_cidr(ip_range_start: str | None, subnet_mask: str | None) -> str:
    if not ip_range_start or not subnet_mask:
        return "0.0.0.0/0"
    try:
        network = ipaddress.ip_network(f"{ip_range_start}/{subnet_mask}", strict=False)
    except ValueError:
        return "0.0.0.0/0"
    return str(network)


def upgrade() -> None:
    op.add_column("vlans", sa.Column("cidr", sa.String(length=64), nullable=True))

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, ip_range_start, subnet_mask FROM vlans")).mappings().all()
    for row in rows:
        cidr = _to_cidr(row["ip_range_start"], row["subnet_mask"])
        connection.execute(sa.text("UPDATE vlans SET cidr = :cidr WHERE id = :id"), {"cidr": cidr, "id": row["id"]})

    op.execute("UPDATE vlans SET cidr = '0.0.0.0/0' WHERE cidr IS NULL")
    op.alter_column("vlans", "cidr", nullable=False)

    op.drop_column("vlans", "ip_range_end")
    op.drop_column("vlans", "ip_range_start")
    op.drop_column("vlans", "subnet_mask")


def downgrade() -> None:
    op.add_column("vlans", sa.Column("subnet_mask", sa.String(length=64), nullable=True))
    op.add_column("vlans", sa.Column("ip_range_start", sa.String(length=64), nullable=True))
    op.add_column("vlans", sa.Column("ip_range_end", sa.String(length=64), nullable=True))

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, cidr FROM vlans")).mappings().all()
    for row in rows:
        subnet_mask = "255.255.255.0"
        range_start = "0.0.0.0"
        range_end = "0.0.0.0"
        try:
            network = ipaddress.ip_network(row["cidr"], strict=False)
            if isinstance(network, ipaddress.IPv4Network):
                subnet_mask = str(network.netmask)
                range_start = str(network.network_address)
                range_end = str(network.broadcast_address)
        except ValueError:
            pass

        connection.execute(
            sa.text(
                "UPDATE vlans "
                "SET subnet_mask = :subnet_mask, ip_range_start = :ip_range_start, ip_range_end = :ip_range_end "
                "WHERE id = :id"
            ),
            {
                "subnet_mask": subnet_mask,
                "ip_range_start": range_start,
                "ip_range_end": range_end,
                "id": row["id"],
            },
        )

    op.execute("UPDATE vlans SET subnet_mask = '255.255.255.0' WHERE subnet_mask IS NULL")
    op.execute("UPDATE vlans SET ip_range_start = '0.0.0.0' WHERE ip_range_start IS NULL")
    op.execute("UPDATE vlans SET ip_range_end = '0.0.0.0' WHERE ip_range_end IS NULL")

    op.alter_column("vlans", "subnet_mask", nullable=False)
    op.alter_column("vlans", "ip_range_start", nullable=False)
    op.alter_column("vlans", "ip_range_end", nullable=False)

    op.drop_column("vlans", "cidr")
