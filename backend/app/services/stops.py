"""Tappe: creazione, modifica, cancellazione, riordino e spostamento tra giorni.

L'ordine della timeline è `position` (0..n-1 senza buchi), non l'orario: una tappa
"mattina" senza ora resta al suo posto. Ogni mutazione riallinea i segmenti nella stessa
transazione.
"""

import logging
import uuid
from typing import Any

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.errors import Conflict, NotFound
from app.models import Photo, Stop, TripDay, User
from app.models.enums import StopCategory, TimePrecision
from app.schemas.stops import MoveStop, ReorderStops, StopCreate, StopUpdate
from app.services import segments
from app.services.days import get_day
from app.services.geo import point

logger = logging.getLogger(__name__)


def get_stop(session: Session, user: User, stop_id: uuid.UUID) -> Stop:
    stop = session.get(Stop, stop_id)
    if stop is None or stop.day.trip.user_id != user.id:
        raise NotFound("Tappa non trovata")
    return stop


def _apply_fields(stop: Stop, fields: dict[str, Any]) -> None:
    if "lat" in fields or "lon" in fields:
        lat, lon = fields.pop("lat", None), fields.pop("lon", None)
        stop.location = point(lat, lon) if lat is not None and lon is not None else None

    for side in ("planned", "actual"):
        precision_key = f"{side}_time_precision"
        arrival_key = f"{side}_arrival"
        # Un orario inserito senza precisione esplicita è un orario esatto.
        if fields.get(arrival_key) is not None and fields.get(precision_key) is None:
            current = getattr(stop, precision_key, None)
            if current in (None, TimePrecision.unknown):
                fields[precision_key] = TimePrecision.exact
        if precision_key in fields and fields[precision_key] is None:
            fields[precision_key] = TimePrecision.unknown

    if "category" in fields and fields["category"] is None:
        fields["category"] = StopCategory.attraction

    for name, value in fields.items():
        if isinstance(value, str) and name != "name":
            value = value.strip() or None
        if name == "name":
            value = value.strip()
        setattr(stop, name, value)

    if stop.category != StopCategory.custom:
        stop.custom_category = None


def _renumber(day: TripDay, ordered: list[Stop]) -> None:
    for index, stop in enumerate(ordered):
        stop.position = index


def create_stop(session: Session, user: User, day_id: uuid.UUID, data: StopCreate) -> TripDay:
    day = get_day(session, user, day_id)
    fields = data.model_dump(exclude_unset=True)
    position = fields.pop("position", None)

    stop = Stop(
        day=day,
        position=len(day.stops),
        category=StopCategory.attraction,
        planned_time_precision=TimePrecision.unknown,
        actual_time_precision=TimePrecision.unknown,
    )
    _apply_fields(stop, fields)
    session.add(stop)

    ordered = [s for s in day.stops if s is not stop]
    index = len(ordered) if position is None else min(position, len(ordered))
    ordered.insert(index, stop)
    _renumber(day, ordered)

    segments.rebuild(session, day)
    session.commit()
    logger.info("Creata tappa %s nel giorno %s (posizione %d)", stop.id, day.id, stop.position)
    return day


def update_stop(session: Session, user: User, stop_id: uuid.UUID, data: StopUpdate) -> Stop:
    stop = get_stop(session, user, stop_id)
    fields = data.model_dump(exclude_unset=True)
    if "name" in fields and fields["name"] is None:
        fields.pop("name")
    _apply_fields(stop, fields)
    session.commit()
    return stop


def delete_stop(session: Session, user: User, stop_id: uuid.UUID) -> TripDay:
    stop = get_stop(session, user, stop_id)
    day = stop.day
    day.stops.remove(stop)
    session.flush()
    _renumber(day, sorted(day.stops, key=lambda s: s.position))
    segments.rebuild(session, day)
    session.commit()
    return day


def reorder_stops(session: Session, user: User, day_id: uuid.UUID, data: ReorderStops) -> TripDay:
    day = get_day(session, user, day_id)
    by_id = {s.id: s for s in day.stops}
    if len(data.stop_ids) != len(by_id) or set(data.stop_ids) != set(by_id):
        raise Conflict(
            "L'elenco non corrisponde alle tappe attuali del giorno",
            details={"expected": [str(i) for i in by_id]},
        )
    _renumber(day, [by_id[i] for i in data.stop_ids])
    segments.rebuild(session, day)
    session.commit()
    return day


def move_stop(
    session: Session, user: User, stop_id: uuid.UUID, data: MoveStop
) -> tuple[TripDay, TripDay]:
    stop = get_stop(session, user, stop_id)
    source = stop.day
    target = get_day(session, user, data.day_id)
    if target.trip_id != source.trip_id:
        raise Conflict("Si può spostare una tappa solo tra giorni dello stesso viaggio")

    remaining = [s for s in sorted(source.stops, key=lambda s: s.position) if s is not stop]
    if target is source:
        index = len(remaining) if data.position is None else min(data.position, len(remaining))
        remaining.insert(index, stop)
        _renumber(source, remaining)
        segments.rebuild(session, source)
        session.commit()
        return source, source

    _renumber(source, remaining)
    stop.day = target  # la relazione sposta la tappa da una collezione all'altra
    target_list = sorted((s for s in target.stops if s is not stop), key=lambda s: s.position)
    index = len(target_list) if data.position is None else min(data.position, len(target_list))
    target_list.insert(index, stop)
    _renumber(target, target_list)
    # Le foto della tappa la seguono nel nuovo giorno.
    session.execute(update(Photo).where(Photo.stop_id == stop.id).values(day_id=target.id))
    # I segmenti che toccavano la tappa nel giorno di origine vengono eliminati qui.
    segments.rebuild(session, source)
    segments.rebuild(session, target)
    session.commit()
    return source, target
