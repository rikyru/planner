"""Query di lettura riusate dai servizi (riepiloghi con conteggi)."""

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Stop, Trip, TripDay


@dataclass(frozen=True)
class TripCounts:
    day_count: int
    stop_count: int


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
    return {
        tid: TripCounts(day_count=day_counts.get(tid, 0), stop_count=stop_counts.get(tid, 0))
        for tid in trip_ids
    }


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
