import datetime as dt
import uuid

from pydantic import Field

from app.models.enums import StopCategory, TimePrecision, TransportMode, TripKind, Visibility
from app.schemas.common import ApiModel


class ShareInfo(ApiModel):
    visibility: Visibility
    token: str | None
    path: str | None = Field(description="Percorso della pagina pubblica, es. /share/{token}")
    url: str | None = Field(description="URL completo se PUBLIC_BASE_URL è configurato")


# --- Vista pubblica: solo ciò che serve al diario, niente EXIF, GPS delle foto o originali.


class SharedPhoto(ApiModel):
    id: uuid.UUID
    stop_id: uuid.UUID | None
    caption: str | None
    width: int | None
    height: int | None
    taken_time: dt.time | None = Field(description="Ora locale di scatto, senza data né fuso")
    thumb_url: str
    display_url: str


class SharedStop(ApiModel):
    id: uuid.UUID
    name: str
    lat: float | None
    lon: float | None
    category: StopCategory
    custom_category: str | None
    time: dt.time | None = Field(
        description="Orario mostrato: effettivo o pianificato secondo il viaggio"
    )
    time_precision: TimePrecision
    duration_min: int | None
    notes: str | None


class SharedSegment(ApiModel):
    from_stop_id: uuid.UUID
    to_stop_id: uuid.UUID
    transport_mode: TransportMode
    duration_min: int | None


class SharedIdea(ApiModel):
    name: str
    lat: float | None
    lon: float | None
    category: StopCategory
    custom_category: str | None
    notes: str | None


class SharedDay(ApiModel):
    day_number: int
    date: dt.date
    title: str | None
    notes: str | None
    stops: list[SharedStop]
    segments: list[SharedSegment]
    photos: list[SharedPhoto]


class SharedTrip(ApiModel):
    title: str
    description: str | None
    start_date: dt.date
    end_date: dt.date
    kind: TripKind
    cover_url: str | None
    stop_count: int
    photo_count: int
    days: list[SharedDay]
    ideas: list[SharedIdea] = Field(description="Luoghi senza giorno: idee o cose non fatte")
