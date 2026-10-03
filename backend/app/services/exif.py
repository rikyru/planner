"""Lettura dei metadati EXIF: data di scatto, GPS e pochi campi utili."""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from PIL import ExifTags, Image

logger = logging.getLogger(__name__)


@dataclass
class ExifData:
    taken_at: datetime | None = None
    taken_at_offset: str | None = None
    lat: float | None = None
    lon: float | None = None
    extra: dict[str, Any] = field(default_factory=dict)


def _ratio(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        num, den = value
        return float(num) / float(den)


def _dms_to_degrees(dms: Any, ref: str | None) -> float | None:
    try:
        degrees = _ratio(dms[0]) + _ratio(dms[1]) / 60 + _ratio(dms[2]) / 3600
    except (TypeError, ValueError, IndexError, ZeroDivisionError):
        return None
    if ref in ("S", "W"):
        degrees = -degrees
    return round(degrees, 7)


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    value = value.strip().replace("\x00", "")
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value[:19], fmt)
        except ValueError:
            continue
    return None


def read_exif(image: Image.Image) -> ExifData:
    data = ExifData()
    try:
        exif = image.getexif()
    except Exception as exc:  # EXIF corrotti non devono bloccare l'upload
        logger.info("EXIF illeggibili: %s", exc)
        return data
    if not exif:
        return data

    ifd = exif.get_ifd(ExifTags.IFD.Exif)
    data.taken_at = _parse_datetime(ifd.get(ExifTags.Base.DateTimeOriginal)) or _parse_datetime(
        exif.get(ExifTags.Base.DateTime)
    )
    offset = ifd.get(ExifTags.Base.OffsetTimeOriginal)
    if isinstance(offset, str) and offset.strip():
        data.taken_at_offset = offset.strip()[:10]

    gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
    if gps:
        lat = _dms_to_degrees(
            gps.get(ExifTags.GPS.GPSLatitude), gps.get(ExifTags.GPS.GPSLatitudeRef)
        )
        lon = _dms_to_degrees(
            gps.get(ExifTags.GPS.GPSLongitude), gps.get(ExifTags.GPS.GPSLongitudeRef)
        )
        if lat is not None and lon is not None and abs(lat) <= 90 and abs(lon) <= 180:
            if not (lat == 0 and lon == 0):
                data.lat, data.lon = lat, lon

    for key, tag in (
        ("make", ExifTags.Base.Make),
        ("model", ExifTags.Base.Model),
        ("orientation", ExifTags.Base.Orientation),
    ):
        value = exif.get(tag)
        if value is not None:
            data.extra[key] = value if isinstance(value, int) else str(value).strip("\x00 ")
    lens = ifd.get(ExifTags.Base.LensModel)
    if lens:
        data.extra["lens"] = str(lens).strip("\x00 ")
    return data
