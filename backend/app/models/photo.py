import uuid
from datetime import datetime
from typing import Any

from geoalchemy2 import Geography
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPk


class Photo(UUIDPk, Timestamps, Base):
    """Foto salvata su filesystem; nel database solo percorso, metadati e associazioni."""

    __tablename__ = "photos"
    __table_args__ = (UniqueConstraint("trip_id", "sha256", name="uq_photos_trip_id_sha256"),)

    trip_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Cancellare un giorno o una tappa non cancella mai le foto.
    day_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("trip_days.id", ondelete="SET NULL"), index=True
    )
    stop_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("stops.id", ondelete="SET NULL"), index=True
    )
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(300), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    # Ora locale di scatto (EXIF DateTimeOriginal), senza fuso; l'offset se presente.
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False))
    taken_at_offset: Mapped[str | None] = mapped_column(String(10))
    location: Mapped[Any | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True)
    )
    caption: Mapped[str | None] = mapped_column(Text)
    exif: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
