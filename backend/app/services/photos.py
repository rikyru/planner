"""Foto: upload multiplo con EXIF e miniature, associazione manuale a giorno/tappa.

L'originale viene salvato così com'è; le varianti WebP (thumb, display) sono ruotate secondo
l'orientamento EXIF e non contengono metadati, così la pagina condivisa non espone il GPS.
Il matching automatico foto→tappa non c'è: vedi `photo_matching` per il punto d'estensione.
"""

import hashlib
import io
import logging
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pillow_heif
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import DomainValidation, NotFound
from app.models import Photo, Stop, Trip, TripDay, User
from app.schemas.photos import PhotoUpdate
from app.services import storage
from app.services.exif import read_exif
from app.services.geo import point
from app.services.storage import DERIVED_SIZES, Variant
from app.services.trips import get_trip

logger = logging.getLogger(__name__)

pillow_heif.register_heif_opener()

MAX_FILE_BYTES = 60 * 1024 * 1024
MAX_FILES_PER_UPLOAD = 200

# Formato Pillow -> (estensione dell'originale, MIME)
FORMATS: dict[str, tuple[str, str]] = {
    "JPEG": (".jpg", "image/jpeg"),
    "MPO": (".jpg", "image/jpeg"),  # JPEG multi-immagine (molti smartphone)
    "PNG": (".png", "image/png"),
    "WEBP": (".webp", "image/webp"),
    "HEIF": (".heic", "image/heic"),
    "GIF": (".gif", "image/gif"),
    "TIFF": (".tif", "image/tiff"),
}
WEBP_QUALITY = {Variant.thumb: 72, Variant.display: 82}


@dataclass
class IncomingFile:
    filename: str
    data: bytes


@dataclass
class FileError:
    filename: str
    code: str
    message: str


@dataclass
class UploadOutcome:
    created: list[Photo] = field(default_factory=list)
    duplicates: list[Photo] = field(default_factory=list)
    errors: list[FileError] = field(default_factory=list)


def get_photo(session: Session, user: User, photo_id: uuid.UUID) -> Photo:
    photo = session.get(Photo, photo_id)
    if photo is None:
        raise NotFound("Foto non trovata")
    trip = session.get(Trip, photo.trip_id)
    if trip is None or trip.user_id != user.id:
        raise NotFound("Foto non trovata")
    return photo


def list_photos(
    session: Session,
    user: User,
    trip_id: uuid.UUID,
    day_id: uuid.UUID | None = None,
    stop_id: uuid.UUID | None = None,
    unassigned: bool = False,
) -> list[Photo]:
    get_trip(session, user, trip_id)
    query = select(Photo).where(Photo.trip_id == trip_id)
    if day_id is not None:
        query = query.where(Photo.day_id == day_id)
    if stop_id is not None:
        query = query.where(Photo.stop_id == stop_id)
    if unassigned:
        query = query.where(Photo.day_id.is_(None))
    return list(session.scalars(query.order_by(*photo_order())))


def photo_order() -> tuple[Any, ...]:
    return (Photo.taken_at.asc().nulls_last(), Photo.created_at.asc(), Photo.id.asc())


# --- Associazione -------------------------------------------------------------------------


def _day_in_trip(session: Session, trip_id: uuid.UUID, day_id: uuid.UUID) -> TripDay:
    day = session.get(TripDay, day_id)
    if day is None or day.trip_id != trip_id:
        raise DomainValidation("Il giorno indicato non appartiene a questo viaggio")
    return day


def _stop_in_trip(session: Session, trip_id: uuid.UUID, stop_id: uuid.UUID) -> Stop:
    stop = session.get(Stop, stop_id)
    if stop is None or stop.day.trip_id != trip_id:
        raise DomainValidation("La tappa indicata non appartiene a questo viaggio")
    return stop


def _resolve_target(
    session: Session, trip_id: uuid.UUID, day_id: uuid.UUID | None, stop_id: uuid.UUID | None
) -> tuple[uuid.UUID | None, uuid.UUID | None]:
    """La tappa vince sul giorno: una foto di una tappa sta sempre nel giorno della tappa."""
    if stop_id is not None:
        stop = _stop_in_trip(session, trip_id, stop_id)
        return stop.day_id, stop.id
    if day_id is not None:
        return _day_in_trip(session, trip_id, day_id).id, None
    return None, None


def update_photo(session: Session, user: User, photo_id: uuid.UUID, data: PhotoUpdate) -> Photo:
    photo = get_photo(session, user, photo_id)
    fields = data.model_dump(exclude_unset=True)

    if "caption" in fields:
        caption = fields["caption"]
        photo.caption = (caption.strip() or None) if caption else None

    if fields.get("stop_id") is not None:
        photo.day_id, photo.stop_id = _resolve_target(
            session, photo.trip_id, None, fields["stop_id"]
        )
    elif "day_id" in fields:
        day_id = fields["day_id"]
        if day_id is not None:
            _day_in_trip(session, photo.trip_id, day_id)
        if photo.day_id != day_id:
            photo.stop_id = None  # la tappa non è più coerente col nuovo giorno
        photo.day_id = day_id
    elif "stop_id" in fields:
        photo.stop_id = None  # rimossa dalla tappa, resta nel giorno

    session.commit()
    return photo


def assign_by_date(session: Session, user: User, trip_id: uuid.UUID) -> int:
    """Azione esplicita dell'utente: le foto senza giorno vanno nel giorno della data di
    scatto, se rientra nel viaggio. Non tocca mai foto già associate."""
    trip = get_trip(session, user, trip_id)
    days = {day.date: day.id for day in trip.days}
    assigned = 0
    for photo in session.scalars(
        select(Photo).where(
            Photo.trip_id == trip_id, Photo.day_id.is_(None), Photo.taken_at.is_not(None)
        )
    ):
        assert photo.taken_at is not None
        day_id = days.get(photo.taken_at.date())
        if day_id is not None:
            photo.day_id = day_id
            assigned += 1
    session.commit()
    logger.info("Viaggio %s: %d foto associate per data di scatto", trip_id, assigned)
    return assigned


# --- Upload -------------------------------------------------------------------------------


class _RejectedFile(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def upload_photos(
    session: Session,
    user: User,
    trip_id: uuid.UUID,
    files: list[IncomingFile],
    day_id: uuid.UUID | None = None,
    stop_id: uuid.UUID | None = None,
) -> UploadOutcome:
    trip = get_trip(session, user, trip_id)
    if not files:
        raise DomainValidation("Nessun file ricevuto")
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise DomainValidation(f"Al massimo {MAX_FILES_PER_UPLOAD} foto per caricamento")
    target_day, target_stop = _resolve_target(session, trip.id, day_id, stop_id)

    outcome = UploadOutcome()
    written: list[Photo] = []
    seen: dict[str, Photo] = {}
    try:
        for incoming in files:
            digest = hashlib.sha256(incoming.data).hexdigest()
            existing = seen.get(digest) or session.scalar(
                select(Photo).where(Photo.trip_id == trip.id, Photo.sha256 == digest)
            )
            if existing is not None:
                outcome.duplicates.append(existing)
                continue
            try:
                photo = _store_one(trip.id, incoming, digest)
            except _RejectedFile as exc:
                outcome.errors.append(FileError(incoming.filename, exc.code, exc.message))
                continue
            photo.day_id, photo.stop_id = target_day, target_stop
            session.add(photo)
            written.append(photo)
            seen[digest] = photo
            outcome.created.append(photo)
        session.commit()
    except Exception:
        session.rollback()
        for photo in written:
            storage.delete_photo_files(photo.trip_id, photo.id, photo.storage_key)
        raise

    logger.info(
        "Viaggio %s: %d foto caricate, %d duplicate, %d scartate",
        trip.id,
        len(outcome.created),
        len(outcome.duplicates),
        len(outcome.errors),
    )
    return outcome


def _open_image(data: bytes) -> Image.Image:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise _RejectedFile("unsupported_format", "Formato immagine non riconosciuto") from exc
    except (OSError, ValueError, SyntaxError) as exc:
        raise _RejectedFile("corrupt_image", "Immagine danneggiata o incompleta") from exc
    return image


def _store_one(trip_id: uuid.UUID, incoming: IncomingFile, digest: str) -> Photo:
    filename = Path(incoming.filename or "foto").name[:300] or "foto"
    if len(incoming.data) == 0:
        raise _RejectedFile("empty_file", "File vuoto")
    if len(incoming.data) > MAX_FILE_BYTES:
        raise _RejectedFile("file_too_large", f"File oltre {MAX_FILE_BYTES // (1024 * 1024)} MB")

    image = _open_image(incoming.data)
    fmt = FORMATS.get(image.format or "")
    if fmt is None:
        raise _RejectedFile("unsupported_format", f"Formato {image.format} non supportato")
    ext, mime = fmt
    exif = read_exif(image)
    location = point(exif.lat, exif.lon) if exif.lat is not None and exif.lon is not None else None

    photo_id = uuid.uuid4()
    key = storage.original_key(trip_id, photo_id, ext)
    try:
        storage.write(storage.path_for_key(key), incoming.data)
        width, height = _write_derivatives(trip_id, photo_id, image)
    except OSError as exc:
        storage.delete_photo_files(trip_id, photo_id, key)
        logger.error("Scrittura foto %s fallita: %s", filename, exc)
        raise _RejectedFile("storage_error", "Impossibile salvare il file sul disco") from exc

    return Photo(
        id=photo_id,
        trip_id=trip_id,
        storage_key=key,
        original_filename=filename,
        mime_type=mime,
        width=width,
        height=height,
        size_bytes=len(incoming.data),
        sha256=digest,
        taken_at=exif.taken_at,
        taken_at_offset=exif.taken_at_offset,
        location=location,
        exif=_json_safe(exif.extra) or None,
    )


def _write_derivatives(
    trip_id: uuid.UUID, photo_id: uuid.UUID, image: Image.Image
) -> tuple[int, int]:
    """Genera le varianti WebP; restituisce le dimensioni dell'immagine raddrizzata."""
    upright = ImageOps.exif_transpose(image)
    if upright.mode not in ("RGB", "RGBA"):
        upright = upright.convert("RGBA" if "A" in upright.getbands() else "RGB")
    size = upright.size

    current = upright
    for variant in (Variant.display, Variant.thumb):  # dalla più grande alla più piccola
        edge = DERIVED_SIZES[variant]
        current = current.copy()
        current.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        current.save(buffer, format="WEBP", quality=WEBP_QUALITY[variant], method=4)
        storage.write(storage.derived_path(trip_id, photo_id, variant), buffer.getvalue())
    return size


def _json_safe(values: dict[str, Any]) -> dict[str, Any]:
    return {k: v if isinstance(v, (int, float, str, bool)) else str(v) for k, v in values.items()}


# --- File -------------------------------------------------------------------------------


def file_path(photo: Photo, variant: Variant) -> tuple[Path, str]:
    """Percorso e MIME della variante; le varianti mancanti vengono rigenerate."""
    if variant == Variant.original:
        return storage.path_for_key(photo.storage_key), photo.mime_type
    path = storage.derived_path(photo.trip_id, photo.id, variant)
    if not path.exists():
        original = storage.path_for_key(photo.storage_key)
        if not original.exists():
            raise NotFound("File della foto non trovato")
        logger.warning("Rigenero le varianti mancanti della foto %s", photo.id)
        _write_derivatives(photo.trip_id, photo.id, _open_image(original.read_bytes()))
    return path, "image/webp"


def delete_photo(session: Session, user: User, photo_id: uuid.UUID) -> None:
    photo = get_photo(session, user, photo_id)
    trip_id, key = photo.trip_id, photo.storage_key
    trip = session.get(Trip, trip_id)
    if trip is not None and trip.cover_photo_id == photo.id:
        trip.cover_photo_id = None
        session.flush()
    session.delete(photo)
    session.commit()
    # I file si eliminano solo dopo il commit: un rollback non lascia righe senza file.
    storage.delete_photo_files(trip_id, photo_id, key)
    logger.info("Eliminata foto %s", photo_id)


def photo_urls(photo_id: uuid.UUID) -> dict[str, str]:
    base = f"/api/photos/{photo_id}/file"
    return {
        "thumb_url": f"{base}?size=thumb",
        "display_url": f"{base}?size=display",
        "original_url": f"{base}?size=original",
    }
