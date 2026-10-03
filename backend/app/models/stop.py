import uuid
from datetime import time
from typing import Any

from geoalchemy2 import Geography
from sqlalchemy import (
    CheckConstraint,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamps, UUIDPk
from app.models.enums import StopCategory, TimePrecision, TransportMode
from app.models.trip import TripDay


def _enum(cls: type, name: str) -> Enum:
    return Enum(
        cls, native_enum=False, length=20, name=name, create_constraint=True, validate_strings=True
    )


class Stop(UUIDPk, Timestamps, Base):
    __tablename__ = "stops"
    __table_args__ = (
        # Deferrable: il riordino riscrive tutte le posizioni nella stessa transazione.
        UniqueConstraint(
            "day_id",
            "position",
            name="uq_stops_day_id_position",
            deferrable=True,
            initially="DEFERRED",
        ),
        CheckConstraint("position >= 0", name="position_non_negative"),
        CheckConstraint("planned_duration_min >= 0", name="planned_duration_non_negative"),
        CheckConstraint("actual_duration_min >= 0", name="actual_duration_non_negative"),
    )

    day_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trip_days.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Nullable: in ricostruzione una tappa può esistere prima di essere geolocalizzata.
    location: Mapped[Any | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True)
    )
    address: Mapped[str | None] = mapped_column(Text)
    category: Mapped[StopCategory] = mapped_column(
        _enum(StopCategory, "stop_category"), nullable=False, default=StopCategory.attraction
    )
    custom_category: Mapped[str | None] = mapped_column(String(50))

    # Planned e actual restano sempre separati: actual non sovrascrive mai planned.
    planned_arrival: Mapped[time | None] = mapped_column(Time)
    planned_departure: Mapped[time | None] = mapped_column(Time)
    planned_duration_min: Mapped[int | None] = mapped_column(Integer)
    planned_time_precision: Mapped[TimePrecision] = mapped_column(
        _enum(TimePrecision, "planned_time_precision"),
        nullable=False,
        default=TimePrecision.unknown,
    )
    actual_arrival: Mapped[time | None] = mapped_column(Time)
    actual_departure: Mapped[time | None] = mapped_column(Time)
    actual_duration_min: Mapped[int | None] = mapped_column(Integer)
    actual_time_precision: Mapped[TimePrecision] = mapped_column(
        _enum(TimePrecision, "actual_time_precision"),
        nullable=False,
        default=TimePrecision.unknown,
    )

    notes: Mapped[str | None] = mapped_column(Text)
    # Riferimento al luogo del geocoder (es. "osm:N:123"): riconosce i luoghi già usati.
    external_ref: Mapped[str | None] = mapped_column(String(100))

    day: Mapped[TripDay] = relationship(back_populates="stops")


class Segment(UUIDPk, Timestamps, Base):
    """Spostamento tra due tappe consecutive dello stesso giorno, gestito dal server."""

    __tablename__ = "segments"
    __table_args__ = (
        CheckConstraint("from_stop_id <> to_stop_id", name="distinct_stops"),
        CheckConstraint("planned_duration_min >= 0", name="planned_duration_non_negative"),
        CheckConstraint("actual_duration_min >= 0", name="actual_duration_non_negative"),
        CheckConstraint("distance_m >= 0", name="distance_non_negative"),
    )

    day_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trip_days.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_stop_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stops.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    to_stop_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("stops.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    transport_mode: Mapped[TransportMode] = mapped_column(
        _enum(TransportMode, "transport_mode"), nullable=False, default=TransportMode.unknown
    )
    planned_duration_min: Mapped[int | None] = mapped_column(Integer)
    actual_duration_min: Mapped[int | None] = mapped_column(Integer)
    distance_m: Mapped[int | None] = mapped_column(Integer)
    # Percorso pianificato (futuro routing OSRM/Valhalla). Le tracce GPS reali andranno altrove.
    geometry: Mapped[Any | None] = mapped_column(
        Geography(geometry_type="LINESTRING", srid=4326, spatial_index=False)
    )
    notes: Mapped[str | None] = mapped_column(Text)

    day: Mapped[TripDay] = relationship(back_populates="segments")
