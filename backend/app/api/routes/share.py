import uuid

from fastapi import APIRouter, Response
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, DbSession
from app.schemas.share import SharedTrip, ShareInfo
from app.services import photos, sharing, trips
from app.services.storage import Variant

router = APIRouter(tags=["share"])

# Le pagine condivise non vanno indicizzate dai motori di ricerca.
NO_INDEX = {"X-Robots-Tag": "noindex, nofollow"}


@router.get("/trips/{trip_id}/share", response_model=ShareInfo)
def get_share(trip_id: uuid.UUID, session: DbSession, user: CurrentUser) -> ShareInfo:
    return sharing.share_info(trips.get_trip(session, user, trip_id))


@router.post("/trips/{trip_id}/share", response_model=ShareInfo)
def enable_share(trip_id: uuid.UUID, session: DbSession, user: CurrentUser) -> ShareInfo:
    """Attiva il link pubblico; se esiste già lo mantiene."""
    return sharing.share_info(sharing.enable(session, user, trip_id))


@router.post("/trips/{trip_id}/share/rotate", response_model=ShareInfo)
def rotate_share(trip_id: uuid.UUID, session: DbSession, user: CurrentUser) -> ShareInfo:
    """Genera un nuovo link: quello precedente smette di funzionare."""
    return sharing.share_info(sharing.rotate(session, user, trip_id))


@router.delete("/trips/{trip_id}/share", response_model=ShareInfo)
def disable_share(trip_id: uuid.UUID, session: DbSession, user: CurrentUser) -> ShareInfo:
    return sharing.share_info(sharing.disable(session, user, trip_id))


# --- Pubblico, senza utente --------------------------------------------------------------


@router.get("/share/{token}", response_model=SharedTrip)
def shared_trip(token: str, session: DbSession, response: Response) -> SharedTrip:
    response.headers.update(NO_INDEX)
    response.headers["Cache-Control"] = "no-store"
    return sharing.shared_trip(session, sharing.trip_by_token(session, token))


@router.get("/share/{token}/photos/{photo_id}", response_class=FileResponse)
def shared_photo(
    token: str,
    photo_id: uuid.UUID,
    session: DbSession,
    size: Variant = Variant.display,
) -> FileResponse:
    if size == Variant.original:
        size = Variant.display  # gli originali (con EXIF e GPS) non escono mai dal link pubblico
    photo = sharing.shared_photo(session, token, photo_id)
    path, media_type = photos.file_path(photo, size)
    # Cache breve: se il link viene revocato le foto smettono presto di essere servite.
    headers = {**NO_INDEX, "Cache-Control": "public, max-age=3600"}
    return FileResponse(path, media_type=media_type, headers=headers)
