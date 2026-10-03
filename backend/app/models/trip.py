import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Date, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps, UUIDPk
from app.models.enums import TripKind, Visibility

if TYPE_CHECKING:
    from app.models.stop import Segment, Stop


def _enum(cls: type, name: str) -> Enum:
    return Enum(
        cls, native_enum=False, length=20, name=name, create_constraint=True, validate_strings=True
    )


class Trip(UUIDPk, Timestamps, Base):
    __tablename__ = "trips"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="dates_ordered"),
        CheckConstraint(
            "visibility = 'private' OR share_token IS NOT NULL", name="unlisted_has_token"
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    kind: Mapped[TripKind] = mapped_column(
        _enum(TripKind, "trip_kind"), nullable=False, default=TripKind.plan
    )
    timezone: Mapped[str | None] = mapped_column(String(64))
    visibility: Mapped[Visibility] = mapped_column(
        _enum(Visibility, "visibility"), nullable=False, default=Visibility.private
    )
    share_token: Mapped[str | None] = mapped_column(String(64), unique=True)

    days: Mapped[list["TripDay"]] = relationship(
        back_populates="trip",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TripDay.date",
    )


class TripDay(UUIDPk, Timestamps, Base):
    __tablename__ = "trip_days"
    __table_args__ = (UniqueConstraint("trip_id", "date", name="uq_trip_days_trip_id_date"),)

    trip_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)

    trip: Mapped[Trip] = relationship(back_populates="days")
    stops: Mapped[list["Stop"]] = relationship(
        back_populates="day",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Stop.position",
    )
    segments: Mapped[list["Segment"]] = relationship(
        back_populates="day", cascade="all, delete-orphan", passive_deletes=True
    )
