"""viaggi e giorni

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-03
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> list[sa.Column]:  # type: ignore[type-arg]
    return [
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "trips",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("timezone", sa.String(64)),
        sa.Column("visibility", sa.String(20), nullable=False),
        sa.Column("share_token", sa.String(64)),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_trips"),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], ondelete="CASCADE", name="fk_trips_user_id_users"
        ),
        sa.UniqueConstraint("share_token", name="uq_trips_share_token"),
        sa.CheckConstraint("end_date >= start_date", name="ck_trips_dates_ordered"),
        sa.CheckConstraint(
            "visibility = 'private' OR share_token IS NOT NULL", name="ck_trips_unlisted_has_token"
        ),
        sa.CheckConstraint("kind IN ('plan', 'reconstruct')", name="ck_trips_trip_kind"),
        sa.CheckConstraint("visibility IN ('private', 'unlisted')", name="ck_trips_visibility"),
    )
    op.create_index("ix_trips_user_id", "trips", ["user_id"])

    op.create_table(
        "trip_days",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("trip_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(200)),
        sa.Column("notes", sa.Text()),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name="pk_trip_days"),
        sa.ForeignKeyConstraint(
            ["trip_id"], ["trips.id"], ondelete="CASCADE", name="fk_trip_days_trip_id_trips"
        ),
        sa.UniqueConstraint("trip_id", "date", name="uq_trip_days_trip_id_date"),
    )


def downgrade() -> None:
    op.drop_table("trip_days")
    op.drop_index("ix_trips_user_id", table_name="trips")
    op.drop_table("trips")
