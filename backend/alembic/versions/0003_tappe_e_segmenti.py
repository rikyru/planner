"""tappe e segmenti

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from geoalchemy2 import Geography

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_geospatial_table(
        "stops",
        sa.Column("day_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
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
        sa.Column("planned_arrival", sa.Time(), nullable=True),
        sa.Column("planned_departure", sa.Time(), nullable=True),
        sa.Column("planned_duration_min", sa.Integer(), nullable=True),
        sa.Column("planned_time_precision", sa.String(length=20), nullable=False),
        sa.Column("actual_arrival", sa.Time(), nullable=True),
        sa.Column("actual_departure", sa.Time(), nullable=True),
        sa.Column("actual_duration_min", sa.Integer(), nullable=True),
        sa.Column("actual_time_precision", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("external_ref", sa.String(length=100), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "actual_time_precision IN ('exact', 'approximate', 'morning', 'afternoon', 'evening', 'unknown')",
            name=op.f("ck_stops_actual_time_precision"),
        ),
        sa.CheckConstraint(
            "category IN ('attraction', 'food', 'hotel', 'transport', 'parking', 'nature', 'shopping', 'nightlife', 'custom')",
            name=op.f("ck_stops_stop_category"),
        ),
        sa.CheckConstraint(
            "planned_time_precision IN ('exact', 'approximate', 'morning', 'afternoon', 'evening', 'unknown')",
            name=op.f("ck_stops_planned_time_precision"),
        ),
        sa.CheckConstraint(
            "actual_duration_min >= 0", name=op.f("ck_stops_actual_duration_non_negative")
        ),
        sa.CheckConstraint(
            "planned_duration_min >= 0", name=op.f("ck_stops_planned_duration_non_negative")
        ),
        sa.CheckConstraint("position >= 0", name=op.f("ck_stops_position_non_negative")),
        sa.ForeignKeyConstraint(
            ["day_id"], ["trip_days.id"], name=op.f("fk_stops_day_id_trip_days"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_stops")),
        sa.UniqueConstraint(
            "day_id",
            "position",
            deferrable=True,
            initially="DEFERRED",
            name="uq_stops_day_id_position",
        ),
    )
    op.create_geospatial_index(
        "idx_stops_location",
        "stops",
        ["location"],
        unique=False,
        postgresql_using="gist",
        postgresql_ops={},
    )
    op.create_index(op.f("ix_stops_day_id"), "stops", ["day_id"], unique=False)
    op.create_geospatial_table(
        "segments",
        sa.Column("day_id", sa.Uuid(), nullable=False),
        sa.Column("from_stop_id", sa.Uuid(), nullable=False),
        sa.Column("to_stop_id", sa.Uuid(), nullable=False),
        sa.Column("transport_mode", sa.String(length=20), nullable=False),
        sa.Column("planned_duration_min", sa.Integer(), nullable=True),
        sa.Column("actual_duration_min", sa.Integer(), nullable=True),
        sa.Column("distance_m", sa.Integer(), nullable=True),
        sa.Column(
            "geometry",
            Geography(
                geometry_type="LINESTRING",
                srid=4326,
                dimension=2,
                spatial_index=False,
                from_text="ST_GeogFromText",
                name="geography",
            ),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "transport_mode IN ('walking', 'subway', 'train', 'bus', 'car', 'taxi', 'bike', 'ferry', 'plane', 'unknown')",
            name=op.f("ck_segments_transport_mode"),
        ),
        sa.CheckConstraint(
            "actual_duration_min >= 0", name=op.f("ck_segments_actual_duration_non_negative")
        ),
        sa.CheckConstraint("distance_m >= 0", name=op.f("ck_segments_distance_non_negative")),
        sa.CheckConstraint("from_stop_id <> to_stop_id", name=op.f("ck_segments_distinct_stops")),
        sa.CheckConstraint(
            "planned_duration_min >= 0", name=op.f("ck_segments_planned_duration_non_negative")
        ),
        sa.ForeignKeyConstraint(
            ["day_id"],
            ["trip_days.id"],
            name=op.f("fk_segments_day_id_trip_days"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["from_stop_id"],
            ["stops.id"],
            name=op.f("fk_segments_from_stop_id_stops"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["to_stop_id"],
            ["stops.id"],
            name=op.f("fk_segments_to_stop_id_stops"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_segments")),
        sa.UniqueConstraint("from_stop_id", name=op.f("uq_segments_from_stop_id")),
        sa.UniqueConstraint("to_stop_id", name=op.f("uq_segments_to_stop_id")),
    )
    op.create_index(op.f("ix_segments_day_id"), "segments", ["day_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_segments_day_id"), table_name="segments")
    op.drop_geospatial_table("segments")
    op.drop_index(op.f("ix_stops_day_id"), table_name="stops")
    op.drop_geospatial_index(
        "idx_stops_location", table_name="stops", postgresql_using="gist", column_name="location"
    )
    op.drop_geospatial_table("stops")
