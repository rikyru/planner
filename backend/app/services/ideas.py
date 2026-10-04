"""Idee: luoghi del viaggio senza giorno. Diventano tappe quando si mettono in un giorno e
una tappa può tornare tra le idee (perdendo orari e segmenti, che senza giorno non hanno senso).
"""

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import DomainValidation, NotFound
from app.models import Idea, Trip, TripDay, User
from app.models.enums import StopCategory
from app.schemas.ideas import IdeaCreate, IdeaUpdate, ScheduleIdea
from app.schemas.stops import StopCreate
from app.services import stops
from app.services.geo import lat_lon, point
from app.services.trips import get_trip

logger = logging.getLogger(__name__)


def get_idea(session: Session, user: User, idea_id: uuid.UUID) -> Idea:
    idea = session.get(Idea, idea_id)
    trip = session.get(Trip, idea.trip_id) if idea else None
    if idea is None or trip is None or trip.user_id != user.id:
        raise NotFound("Idea non trovata")
    return idea


def list_ideas(session: Session, user: User, trip_id: uuid.UUID) -> list[Idea]:
    get_trip(session, user, trip_id)
    return list(
        session.scalars(
            select(Idea).where(Idea.trip_id == trip_id).order_by(Idea.created_at, Idea.id)
        )
    )


def _apply(idea: Idea, fields: dict[str, Any]) -> None:
    if "lat" in fields or "lon" in fields:
        lat, lon = fields.pop("lat", None), fields.pop("lon", None)
        idea.location = point(lat, lon) if lat is not None and lon is not None else None
    if "category" in fields and fields["category"] is None:
        fields["category"] = StopCategory.attraction
    if "name" in fields and fields["name"] is None:
        fields.pop("name")
    for name, value in fields.items():
        if isinstance(value, str):
            value = value.strip() if name == "name" else (value.strip() or None)
        setattr(idea, name, value)
    if idea.category != StopCategory.custom:
        idea.custom_category = None


def create_idea(session: Session, user: User, trip_id: uuid.UUID, data: IdeaCreate) -> Idea:
    trip = get_trip(session, user, trip_id)
    idea = Idea(trip_id=trip.id, category=StopCategory.attraction)
    _apply(idea, data.model_dump(exclude_unset=True))
    session.add(idea)
    session.commit()
    return idea


def update_idea(session: Session, user: User, idea_id: uuid.UUID, data: IdeaUpdate) -> Idea:
    idea = get_idea(session, user, idea_id)
    _apply(idea, data.model_dump(exclude_unset=True))
    session.commit()
    return idea


def delete_idea(session: Session, user: User, idea_id: uuid.UUID) -> None:
    session.delete(get_idea(session, user, idea_id))
    session.commit()


def schedule_idea(session: Session, user: User, idea_id: uuid.UUID, data: ScheduleIdea) -> TripDay:
    idea = get_idea(session, user, idea_id)
    day = session.get(TripDay, data.day_id)
    if day is None or day.trip_id != idea.trip_id:
        raise DomainValidation("Il giorno indicato non appartiene a questo viaggio")
    coords = lat_lon(idea.location)
    payload = StopCreate(
        name=idea.name,
        lat=coords[0] if coords else None,
        lon=coords[1] if coords else None,
        address=idea.address,
        category=idea.category,
        custom_category=idea.custom_category,
        notes=idea.notes,
        external_ref=idea.external_ref,
        position=data.position,
    )
    # La cancellazione dell'idea viene confermata dallo stesso commit che crea la tappa.
    session.delete(idea)
    day = stops.create_stop(session, user, day.id, payload)
    logger.info("Idea %s messa nel giorno %s", idea_id, day.id)
    return day


def stop_to_idea(session: Session, user: User, stop_id: uuid.UUID) -> tuple[TripDay, Idea]:
    stop = stops.get_stop(session, user, stop_id)
    idea = Idea(
        trip_id=stop.day.trip_id,
        name=stop.name,
        location=stop.location,
        address=stop.address,
        category=stop.category,
        custom_category=stop.custom_category,
        notes=stop.notes,
        external_ref=stop.external_ref,
    )
    session.add(idea)
    # delete_stop rinumera, riallinea i segmenti e fa il commit, idea compresa.
    day = stops.delete_stop(session, user, stop_id)
    return day, idea
