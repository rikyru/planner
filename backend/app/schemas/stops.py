import uuid
from datetime import datetime, time

from pydantic import Field, model_validator

from app.models.enums import StopCategory, TimePrecision, TransportMode
from app.schemas.common import ApiModel

Lat = float
Lon = float


class StopFields(ApiModel):
    """Campi modificabili di una tappa. Solo il nome è obbligatorio alla creazione."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    address: str | None = None
    category: StopCategory | None = None
    custom_category: str | None = Field(default=None, max_length=50)
    planned_arrival: time | None = None
    planned_departure: time | None = None
    planned_duration_min: int | None = Field(default=None, ge=0, le=60 * 24 * 14)
    planned_time_precision: TimePrecision | None = None
    actual_arrival: time | None = None
    actual_departure: time | None = None
    actual_duration_min: int | None = Field(default=None, ge=0, le=60 * 24 * 14)
    actual_time_precision: TimePrecision | None = None
    notes: str | None = None
    external_ref: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def _coordinates_together(self) -> "StopFields":
        sent = self.model_fields_set
        if ("lat" in sent) != ("lon" in sent) or (self.lat is None) != (self.lon is None):
            raise ValueError("Latitudine e longitudine vanno indicate insieme")
        return self


class StopCreate(StopFields):
    name: str = Field(min_length=1, max_length=200)
    position: int | None = Field(default=None, ge=0)


class StopUpdate(StopFields):
    pass


class StopOut(ApiModel):
    id: uuid.UUID
    day_id: uuid.UUID
    position: int
    name: str
    lat: float | None
    lon: float | None
    address: str | None
    category: StopCategory
    custom_category: str | None
    planned_arrival: time | None
    planned_departure: time | None
    planned_duration_min: int | None
    planned_time_precision: TimePrecision
    actual_arrival: time | None
    actual_departure: time | None
    actual_duration_min: int | None
    actual_time_precision: TimePrecision
    notes: str | None
    external_ref: str | None
    created_at: datetime
    updated_at: datetime


class SegmentUpdate(ApiModel):
    transport_mode: TransportMode | None = None
    planned_duration_min: int | None = Field(default=None, ge=0, le=60 * 24 * 7)
    actual_duration_min: int | None = Field(default=None, ge=0, le=60 * 24 * 7)
    distance_m: int | None = Field(default=None, ge=0, le=40_000_000)
    notes: str | None = None


class SegmentOut(ApiModel):
    id: uuid.UUID
    day_id: uuid.UUID
    from_stop_id: uuid.UUID
    to_stop_id: uuid.UUID
    transport_mode: TransportMode
    planned_duration_min: int | None
    actual_duration_min: int | None
    distance_m: int | None
    # GeoJSON LineString coordinates [[lon, lat], ...], vuoto finché non c'è routing.
    geometry: list[tuple[Lon, Lat]] | None
    notes: str | None


class ReorderStops(ApiModel):
    stop_ids: list[uuid.UUID]


class MoveStop(ApiModel):
    day_id: uuid.UUID
    position: int | None = Field(default=None, ge=0)
