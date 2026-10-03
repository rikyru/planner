import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, Query, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, DbSession
from app.schemas.photos import (
    AssignByDateResult,
    PhotoOut,
    PhotoUpdate,
    PhotoUploadResult,
    UploadError,
)
from app.services import photos, serializers
from app.services.storage import Variant

router = APIRouter(tags=["photos"])

# Gli URL dei file contengono l'id della foto e il contenuto non cambia mai.
IMMUTABLE_CACHE = "private, max-age=31536000, immutable"


@router.post("/trips/{trip_id}/photos", response_model=PhotoUploadResult)
def upload_photos(
    trip_id: uuid.UUID,
    session: DbSession,
    user: CurrentUser,
    files: Annotated[list[UploadFile], File(description="Una o più immagini")],
    day_id: Annotated[uuid.UUID | None, Form()] = None,
    stop_id: Annotated[uuid.UUID | None, Form()] = None,
) -> PhotoUploadResult:
    incoming = [
        photos.IncomingFile(filename=f.filename or "foto", data=f.file.read()) for f in files
    ]
    outcome = photos.upload_photos(session, user, trip_id, incoming, day_id, stop_id)
    return PhotoUploadResult(
        created=[serializers.photo_out(p) for p in outcome.created],
        duplicates=[serializers.photo_out(p) for p in outcome.duplicates],
        errors=[
            UploadError(filename=e.filename, code=e.code, message=e.message) for e in outcome.errors
        ],
    )


@router.get("/trips/{trip_id}/photos", response_model=list[PhotoOut])
def list_photos(
    trip_id: uuid.UUID,
    session: DbSession,
    user: CurrentUser,
    day_id: uuid.UUID | None = None,
    stop_id: uuid.UUID | None = None,
    unassigned: bool = Query(default=False, description="Solo foto senza giorno"),
) -> list[PhotoOut]:
    items = photos.list_photos(session, user, trip_id, day_id, stop_id, unassigned)
    return [serializers.photo_out(p) for p in items]


@router.post("/trips/{trip_id}/photos/assign-by-date", response_model=AssignByDateResult)
def assign_by_date(trip_id: uuid.UUID, session: DbSession, user: CurrentUser) -> AssignByDateResult:
    return AssignByDateResult(assigned=photos.assign_by_date(session, user, trip_id))


@router.patch("/photos/{photo_id}", response_model=PhotoOut)
def update_photo(
    photo_id: uuid.UUID, data: PhotoUpdate, session: DbSession, user: CurrentUser
) -> PhotoOut:
    return serializers.photo_out(photos.update_photo(session, user, photo_id, data))


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(photo_id: uuid.UUID, session: DbSession, user: CurrentUser) -> Response:
    photos.delete_photo(session, user, photo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/photos/{photo_id}/file", response_class=FileResponse)
def photo_file(
    photo_id: uuid.UUID,
    session: DbSession,
    user: CurrentUser,
    size: Variant = Variant.display,
) -> FileResponse:
    photo = photos.get_photo(session, user, photo_id)
    path, media_type = photos.file_path(photo, size)
    headers = {"Cache-Control": IMMUTABLE_CACHE}
    if size == Variant.original:
        return FileResponse(
            path,
            media_type=media_type,
            filename=photo.original_filename,
            content_disposition_type="inline",
            headers=headers,
        )
    return FileResponse(path, media_type=media_type, headers=headers)
