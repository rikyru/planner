"""Condivisione in sola lettura tramite link non indovinabile.

Il token (192 bit casuali) è l'unica credenziale: disattivare la condivisione lo cancella,
rigenerarlo invalida il link precedente. La vista pubblica espone solo il diario: niente
EXIF, niente coordinate delle foto, niente file originali, niente foto non assegnate.
"""

import logging
import secrets
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import NotFound
from app.models import Idea, Photo, Stop, Trip, User
from app.models.enums import TimePrecision, TripKind, Visibility
from app.schemas.share import (
    SharedDay,
    SharedIdea,
    SharedPhoto,
    SharedSegment,
    SharedStop,
    SharedTrip,
    ShareInfo,
)
from app.services.geo import lat_lon
from app.services.photos import photo_order
from app.services.trips import get_trip

logger = logging.getLogger(__name__)

TOKEN_BYTES = 24


def new_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def share_info(trip: Trip) -> ShareInfo:
    if trip.visibility != Visibility.unlisted or not trip.share_token:
        return ShareInfo(visibility=Visibility.private, token=None, path=None, url=None)
    path = f"/share/{trip.share_token}"
    base = get_settings().public_base_url.rstrip("/")
    return ShareInfo(
        visibility=trip.visibility,
        token=trip.share_token,
        path=path,
        url=f"{base}{path}" if base else None,
    )


def enable(session: Session, user: User, trip_id: uuid.UUID) -> Trip:
    trip = get_trip(session, user, trip_id)
    if not trip.share_token:
        trip.share_token = new_token()
    trip.visibility = Visibility.unlisted
    session.commit()
    logger.info("Condivisione attivata per il viaggio %s", trip.id)
    return trip


def rotate(session: Session, user: User, trip_id: uuid.UUID) -> Trip:
    trip = get_trip(session, user, trip_id)
    trip.share_token = new_token()
    trip.visibility = Visibility.unlisted
    session.commit()
    logger.info("Link di condivisione rigenerato per il viaggio %s", trip.id)
    return trip


def disable(session: Session, user: User, trip_id: uuid.UUID) -> Trip:
    trip = get_trip(session, user, trip_id)
    trip.visibility = Visibility.private
    trip.share_token = None
    session.commit()
    logger.info("Condivisione disattivata per il viaggio %s", trip.id)
    return trip


def trip_by_token(session: Session, token: str) -> Trip:
    # Lunghezza fuori scala: inutile interrogare il database.
    if not token or len(token) > 64:
        raise NotFound("Pagina non trovata")
    trip = session.scalar(
        select(Trip).where(Trip.share_token == token, Trip.visibility == Visibility.unlisted)
    )
    if trip is None:
        raise NotFound("Pagina non trovata")
    return trip


def shared_photo(session: Session, token: str, photo_id: uuid.UUID) -> Photo:
    trip = trip_by_token(session, token)
    photo = session.get(Photo, photo_id)
    if photo is None or photo.trip_id != trip.id or photo.day_id is None:
        raise NotFound("Foto non trovata")
    return photo


# --- Vista pubblica -----------------------------------------------------------------------


def _has_info(arrival: Any, duration: int | None, precision: TimePrecision) -> bool:
    return arrival is not None or duration is not None or precision != TimePrecision.unknown


def _shown_side(stop: Stop, kind: TripKind) -> tuple[Any, TimePrecision, int | None]:
    """Stessa regola della timeline: il lato principale del viaggio, altrimenti l'altro."""
    planned = (stop.planned_arrival, stop.planned_time_precision, stop.planned_duration_min)
    actual = (stop.actual_arrival, stop.actual_time_precision, stop.actual_duration_min)
    first, second = (actual, planned) if kind == TripKind.reconstruct else (planned, actual)
    return first if _has_info(first[0], first[2], first[1]) else second


def _prefer(kind: TripKind, planned: int | None, actual: int | None) -> int | None:
    first, second = (actual, planned) if kind == TripKind.reconstruct else (planned, actual)
    return first if first is not None else second


def _shared_stop(stop: Stop, kind: TripKind) -> SharedStop:
    coords = lat_lon(stop.location)
    shown_time, precision, duration = _shown_side(stop, kind)
    return SharedStop(
        id=stop.id,
        name=stop.name,
        lat=coords[0] if coords else None,
        lon=coords[1] if coords else None,
        category=stop.category,
        custom_category=stop.custom_category,
        time=shown_time,
        time_precision=precision,
        duration_min=duration,
        notes=stop.notes,
    )


def _shared_photo(token: str, photo: Photo) -> SharedPhoto:
    base = f"/api/share/{token}/photos/{photo.id}"
    return SharedPhoto(
        id=photo.id,
        stop_id=photo.stop_id,
        caption=photo.caption,
        width=photo.width,
        height=photo.height,
        taken_time=photo.taken_at.time() if photo.taken_at else None,
        thumb_url=f"{base}?size=thumb",
        display_url=f"{base}?size=display",
    )


def shared_trip(session: Session, trip: Trip) -> SharedTrip:
    token = trip.share_token or ""
    photos = list(
        session.scalars(
            select(Photo)
            .where(Photo.trip_id == trip.id, Photo.day_id.is_not(None))
            .order_by(*photo_order())
        )
    )
    by_day: dict[uuid.UUID, list[Photo]] = {}
    for photo in photos:
        assert photo.day_id is not None
        by_day.setdefault(photo.day_id, []).append(photo)

    kind = trip.kind
    days = []
    for day in trip.days:
        by_from = {s.from_stop_id: s for s in day.segments}
        segments = [by_from[st.id] for st in day.stops if st.id in by_from]
        days.append(
            SharedDay(
                day_number=(day.date - trip.start_date).days + 1,
                date=day.date,
                title=day.title,
                notes=day.notes,
                stops=[_shared_stop(s, kind) for s in day.stops],
                segments=[
                    SharedSegment(
                        from_stop_id=s.from_stop_id,
                        to_stop_id=s.to_stop_id,
                        transport_mode=s.transport_mode,
                        duration_min=_prefer(kind, s.planned_duration_min, s.actual_duration_min),
                    )
                    for s in segments
                ],
                photos=[_shared_photo(token, p) for p in by_day.get(day.id, [])],
            )
        )

    ideas = []
    for idea in session.scalars(
        select(Idea).where(Idea.trip_id == trip.id).order_by(Idea.created_at, Idea.id)
    ):
        coords = lat_lon(idea.location)
        ideas.append(
            SharedIdea(
                name=idea.name,
                lat=coords[0] if coords else None,
                lon=coords[1] if coords else None,
                category=idea.category,
                custom_category=idea.custom_category,
                notes=idea.notes,
            )
        )

    cover_id = trip.cover_photo_id if any(p.id == trip.cover_photo_id for p in photos) else None
    if cover_id is None and photos:
        cover_id = photos[0].id
    return SharedTrip(
        title=trip.title,
        description=trip.description,
        start_date=trip.start_date,
        end_date=trip.end_date,
        kind=trip.kind,
        cover_url=f"/api/share/{token}/photos/{cover_id}?size=display" if cover_id else None,
        stop_count=sum(len(d.stops) for d in days),
        photo_count=len(photos),
        days=days,
        ideas=ideas,
    )
