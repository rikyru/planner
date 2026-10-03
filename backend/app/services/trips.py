"""Logica dei viaggi: creazione con generazione dei giorni e sincronizzazione delle date."""

import logging
import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import Conflict, DomainValidation, NotFound
from app.models import Photo, Stop, Trip, TripDay, User
from app.schemas.trips import MAX_TRIP_DAYS, TripCreate, TripUpdate
from app.services import storage

logger = logging.getLogger(__name__)


def date_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def get_trip(session: Session, user: User, trip_id: uuid.UUID) -> Trip:
    trip = session.get(Trip, trip_id)
    if trip is None or trip.user_id != user.id:
        raise NotFound("Viaggio non trovato")
    return trip


def create_trip(session: Session, user: User, data: TripCreate) -> Trip:
    trip = Trip(
        user_id=user.id,
        title=data.title.strip(),
        description=data.description,
        start_date=data.start_date,
        end_date=data.end_date,
        kind=data.kind,
        timezone=data.timezone,
    )
    trip.days = [TripDay(date=d) for d in date_range(data.start_date, data.end_date)]
    session.add(trip)
    session.commit()
    logger.info("Creato viaggio %s con %d giorni", trip.id, len(trip.days))
    return trip


def update_trip(
    session: Session,
    user: User,
    trip_id: uuid.UUID,
    data: TripUpdate,
    confirm_delete_days: bool = False,
) -> Trip:
    trip = get_trip(session, user, trip_id)
    fields = data.model_dump(exclude_unset=True)

    for name in ("title", "description", "kind", "timezone"):
        if name in fields:
            value = fields[name]
            if name == "title":
                if value is None:
                    raise DomainValidation("Il titolo è obbligatorio")
                value = value.strip()
            if name == "kind" and value is None:
                raise DomainValidation("Il tipo di viaggio è obbligatorio")
            setattr(trip, name, value)

    if "cover_photo_id" in fields:
        cover_id = fields["cover_photo_id"]
        if cover_id is not None:
            photo = session.get(Photo, cover_id)
            if photo is None or photo.trip_id != trip.id:
                raise DomainValidation("La copertina deve essere una foto di questo viaggio")
        trip.cover_photo_id = cover_id

    new_start = fields.get("start_date") or trip.start_date
    new_end = fields.get("end_date") or trip.end_date
    if (new_start, new_end) != (trip.start_date, trip.end_date):
        _sync_days(session, trip, new_start, new_end, confirm_delete_days)

    session.commit()
    return trip


def _sync_days(
    session: Session, trip: Trip, start: date, end: date, confirm_delete_days: bool
) -> None:
    """I giorni si abbinano per data: le date nuove creano giorni, quelli fuori range vengono
    eliminati. Se un giorno da eliminare ha tappe serve una conferma esplicita."""
    if end < start:
        raise DomainValidation("La data di fine precede la data di inizio")
    if (end - start).days + 1 > MAX_TRIP_DAYS:
        raise DomainValidation(f"Un viaggio può durare al massimo {MAX_TRIP_DAYS} giorni")

    wanted = set(date_range(start, end))
    existing = {day.date: day for day in trip.days}
    to_remove = [day for d, day in existing.items() if d not in wanted]

    non_empty = [day for day in to_remove if _stop_count(session, day.id) > 0]
    if non_empty and not confirm_delete_days:
        raise Conflict(
            "Alcuni giorni che verrebbero rimossi contengono tappe",
            details={"days": sorted(day.date.isoformat() for day in non_empty)},
        )

    for day in to_remove:
        trip.days.remove(day)
    for d in sorted(wanted - existing.keys()):
        trip.days.append(TripDay(date=d))
    trip.start_date, trip.end_date = start, end
    session.flush()
    logger.info("Viaggio %s: date %s..%s, giorni rimossi %d", trip.id, start, end, len(to_remove))


def _stop_count(session: Session, day_id: uuid.UUID) -> int:
    return session.scalar(select(func.count(Stop.id)).where(Stop.day_id == day_id)) or 0


def delete_trip(session: Session, user: User, trip_id: uuid.UUID) -> None:
    trip = get_trip(session, user, trip_id)
    session.delete(trip)
    session.commit()
    # Le righe delle foto spariscono in cascata; i file solo dopo il commit riuscito.
    storage.delete_trip_files(trip_id)
    logger.info("Eliminato viaggio %s", trip_id)
