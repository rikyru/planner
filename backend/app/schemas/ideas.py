import uuid
from datetime import datetime

from pydantic import Field, model_validator

from app.models.enums import StopCategory
from app.schemas.common import ApiModel
from app.schemas.trips import DayOut


class IdeaFields(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    address: str | None = None
    category: StopCategory | None = None
    custom_category: str | None = Field(default=None, max_length=50)
    notes: str | None = None
    external_ref: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def _coordinates_together(self) -> "IdeaFields":
        sent = self.model_fields_set
        if ("lat" in sent) != ("lon" in sent) or (self.lat is None) != (self.lon is None):
            raise ValueError("Latitudine e longitudine vanno indicate insieme")
        return self


class IdeaCreate(IdeaFields):
    name: str = Field(min_length=1, max_length=200)


class IdeaUpdate(IdeaFields):
    pass


class IdeaOut(ApiModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    name: str
    lat: float | None
    lon: float | None
    address: str | None
    category: StopCategory
    custom_category: str | None
    notes: str | None
    external_ref: str | None
    created_at: datetime


class ScheduleIdea(ApiModel):
    """Trasforma l'idea in una tappa del giorno indicato (in coda se manca la posizione)."""

    day_id: uuid.UUID
    position: int | None = Field(default=None, ge=0)


class StopToIdeaResult(ApiModel):
    day: DayOut
    idea: IdeaOut
