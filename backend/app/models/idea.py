import uuid
from typing import Any

from geoalchemy2 import Geography
from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, Timestamps, UUIDPk
from app.models.enums import StopCategory


class Idea(UUIDPk, Timestamps, Base):
    """Luogo legato al viaggio ma senza giorno: da visitare (PLAN) o non fatto (MEMORIES).

    Tabella separata dalle tappe: le tappe hanno sempre un giorno, una posizione e dei
    segmenti; un'idea diventa tappa solo quando la si mette in un giorno.
    """

    __tablename__ = "ideas"

    trip_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location: Mapped[Any | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False)
    )
    address: Mapped[str | None] = mapped_column(Text)
    category: Mapped[StopCategory] = mapped_column(
        Enum(
            StopCategory,
            native_enum=False,
            length=20,
            name="idea_category",
            create_constraint=True,
            validate_strings=True,
        ),
        nullable=False,
        default=StopCategory.attraction,
    )
    custom_category: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)
    external_ref: Mapped[str | None] = mapped_column(String(100))
