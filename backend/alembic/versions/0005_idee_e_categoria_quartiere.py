"""idee e categoria quartiere

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from geoalchemy2 import Geography

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = "'attraction', 'food', 'hotel', 'transport', 'parking', 'nature', 'shopping', 'nightlife', 'custom'"
NEW = (
    "'attraction', 'food', 'hotel', 'transport', 'parking', 'nature', 'shopping', 'nightlife', "
    "'neighborhood', 'custom'"
)


def upgrade() -> None:
    op.drop_constraint(op.f("ck_stops_stop_category"), "stops", type_="check")
    op.create_check_constraint(op.f("ck_stops_stop_category"), "stops", f"category IN ({NEW})")

    op.create_geospatial_table(
        "ideas",
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "location",
            Geography(
                geometry_type="POINT",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeogFromText",
                name="geography",
            ),
            nullable=True,
        ),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=20), nullable=False),
        sa.Column("custom_category", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("external_ref", sa.String(length=100), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint(f"category IN ({NEW})", name=op.f("ck_ideas_idea_category")),
        sa.ForeignKeyConstraint(
            ["trip_id"], ["trips.id"], name=op.f("fk_ideas_trip_id_trips"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ideas")),
    )
    op.create_index(op.f("ix_ideas_trip_id"), "ideas", ["trip_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ideas_trip_id"), table_name="ideas")
    op.drop_geospatial_table("ideas")
    op.execute("UPDATE stops SET category = 'custom' WHERE category = 'neighborhood'")
    op.drop_constraint(op.f("ck_stops_stop_category"), "stops", type_="check")
    op.create_check_constraint(op.f("ck_stops_stop_category"), "stops", f"category IN ({OLD})")
