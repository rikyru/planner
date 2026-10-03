import uuid
from datetime import date, datetime
from zoneinfo import available_timezones

from pydantic import Field, field_validator, model_validator

from app.models.enums import TripKind, Visibility
from app.schemas.common import ApiModel
from app.schemas.stops import SegmentOut, StopOut

MAX_TRIP_DAYS = 366


def _check_timezone(value: str | None) -> str | None:
    if value is not None and value not in available_timezones():
        raise ValueError("Fuso orario IANA non valido (es. America/New_York)")
    return value


class TripCreate(ApiModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    start_date: date
    end_date: date
    kind: TripKind = TripKind.plan
    timezone: str | None = None

    _tz = field_validator("timezone")(_check_timezone)

    @model_validator(mode="after")
    def _dates(self) -> "TripCreate":
        if self.end_date < self.start_date:
            raise ValueError("La data di fine precede la data di inizio")
        if (self.end_date - self.start_date).days + 1 > MAX_TRIP_DAYS:
            raise ValueError(f"Un viaggio può durare al massimo {MAX_TRIP_DAYS} giorni")
        return self


class TripUpdate(ApiModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    kind: TripKind | None = None
    timezone: str | None = None
    cover_photo_id: uuid.UUID | None = None

    _tz = field_validator("timezone")(_check_timezone)


class TripSummary(ApiModel):
    id: uuid.UUID
    title: str
    description: str | None
    start_date: date
    end_date: date
    kind: TripKind
    visibility: Visibility
    timezone: str | None
    cover_photo_id: uuid.UUID | None = None
    cover_url: str | None = Field(
        default=None, description="Copertina scelta oppure, in mancanza, la prima foto"
    )
    photo_count: int = 0
    day_count: int
    stop_count: int
    updated_at: datetime


class DayUpdate(ApiModel):
    title: str | None = Field(default=None, max_length=200)
    notes: str | None = None


class DayOut(ApiModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    date: date
    day_number: int
    title: str | None
    notes: str | None
    stops: list[StopOut]
    segments: list[SegmentOut]


class TripDetail(TripSummary):
    share_token: str | None
    days: list[DayOut]
