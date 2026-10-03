"""Query di lettura riusate dai servizi (riepiloghi con conteggi)."""

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Photo, Stop, Trip, TripDay


@dataclass(frozen=True)
class TripCounts:
    day_count: int
    stop_count: int
    photo_count: int = 0
    first_photo_id: uuid.UUID | None = None


def counts_by_trip(session: Session, trip_ids: list[uuid.UUID]) -> dict[uuid.UUID, TripCounts]:
    if not trip_ids:
        return {}
    day_counts = dict(
        session.execute(
            select(TripDay.trip_id, func.count(TripDay.id))
            .where(TripDay.trip_id.in_(trip_ids))
            .group_by(TripDay.trip_id)
        ).all()
    )
    stop_counts = _stop_counts(session, trip_ids)
    photo_counts = dict(
        session.execute(
            select(Photo.trip_id, func.count(Photo.id))
            .where(Photo.trip_id.in_(trip_ids))
            .group_by(Photo.trip_id)
        ).all()
    )
    first_photos = _first_photos(session, trip_ids)
    return {
        tid: TripCounts(
            day_count=day_counts.get(tid, 0),
            stop_count=stop_counts.get(tid, 0),
            photo_count=photo_counts.get(tid, 0),
            first_photo_id=first_photos.get(tid),
        )
        for tid in trip_ids
    }


def _first_photos(session: Session, trip_ids: list[uuid.UUID]) -> dict[uuid.UUID, uuid.UUID]:
    """Copertina di ripiego: la prima foto scattata di ogni viaggio."""
    rows = session.execute(
        select(Photo.trip_id, Photo.id)
        .where(Photo.trip_id.in_(trip_ids))
        .distinct(Photo.trip_id)
        .order_by(Photo.trip_id, Photo.taken_at.asc().nulls_last(), Photo.created_at.asc())
    ).all()
    return {tid: pid for tid, pid in rows}


def _stop_counts(session: Session, trip_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    rows = session.execute(
        select(TripDay.trip_id, func.count(Stop.id))
        .join(Stop, Stop.day_id == TripDay.id)
        .where(TripDay.trip_id.in_(trip_ids))
        .group_by(TripDay.trip_id)
    ).all()
    return {tid: n for tid, n in rows}


def list_trips_for_user(session: Session, user_id: uuid.UUID) -> list[Trip]:
    return list(
        session.scalars(
            select(Trip)
            .where(Trip.user_id == user_id)
            .order_by(Trip.start_date.desc(), Trip.created_at.desc())
        )
    )
