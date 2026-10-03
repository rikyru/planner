"""File delle foto su filesystem (volume Docker), mai nel database.

data/photos/{trip_id}/originals/{photo_id}{ext}
data/photos/{trip_id}/thumbs/{photo_id}.webp    (lato lungo 480 px)
data/photos/{trip_id}/display/{photo_id}.webp   (lato lungo 1920 px)
"""

import logging
import shutil
import uuid
from enum import StrEnum
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class Variant(StrEnum):
    thumb = "thumb"
    display = "display"
    original = "original"


DERIVED_SIZES = {Variant.thumb: 480, Variant.display: 1920}


def root() -> Path:
    return get_settings().photos_dir


def trip_dir(trip_id: uuid.UUID) -> Path:
    return root() / str(trip_id)


def original_key(trip_id: uuid.UUID, photo_id: uuid.UUID, ext: str) -> str:
    return f"{trip_id}/originals/{photo_id}{ext}"


def derived_path(trip_id: uuid.UUID, photo_id: uuid.UUID, variant: Variant) -> Path:
    folder = "thumbs" if variant == Variant.thumb else "display"
    return trip_dir(trip_id) / folder / f"{photo_id}.webp"


def path_for_key(key: str) -> Path:
    path = (root() / key).resolve()
    if root().resolve() not in path.parents:
        raise ValueError("Percorso fuori dalla cartella delle foto")
    return path


def write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(path)


def delete_photo_files(trip_id: uuid.UUID, photo_id: uuid.UUID, storage_key: str) -> None:
    paths = [derived_path(trip_id, photo_id, v) for v in DERIVED_SIZES]
    try:
        paths.append(path_for_key(storage_key))
    except ValueError:
        logger.warning("storage_key non valido ignorato: %s", storage_key)
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError as exc:
            logger.warning("Impossibile eliminare %s: %s", path, exc)


def delete_trip_files(trip_id: uuid.UUID) -> None:
    folder = trip_dir(trip_id)
    if folder.exists():
        try:
            shutil.rmtree(folder)
        except OSError as exc:
            # La cancellazione del viaggio è già confermata: si logga senza annullarla.
            logger.error("Impossibile eliminare la cartella foto %s: %s", folder, exc)
