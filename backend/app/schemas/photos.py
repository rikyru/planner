import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import ApiModel


class PhotoOut(ApiModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    day_id: uuid.UUID | None
    stop_id: uuid.UUID | None
    original_filename: str
    mime_type: str
    width: int | None
    height: int | None
    size_bytes: int
    taken_at: datetime | None = Field(description="Ora locale di scatto (EXIF), senza fuso")
    taken_at_offset: str | None
    lat: float | None
    lon: float | None
    caption: str | None
    thumb_url: str
    display_url: str
    original_url: str
    created_at: datetime


class PhotoUpdate(ApiModel):
    """Associazione manuale. Se si indica una tappa, il giorno diventa quello della tappa."""

    day_id: uuid.UUID | None = None
    stop_id: uuid.UUID | None = None
    caption: str | None = Field(default=None, max_length=2000)


class UploadError(ApiModel):
    filename: str
    code: str
    message: str


class PhotoUploadResult(ApiModel):
    created: list[PhotoOut]
    duplicates: list[PhotoOut] = Field(description="Foto già presenti nel viaggio (stesso file)")
    errors: list[UploadError]


class AssignByDateResult(ApiModel):
    assigned: int
