import uuid

from sqlalchemy.orm import Session

from app.core.errors import NotFound
from app.models import TripDay, User
from app.schemas.trips import DayUpdate


def get_day(session: Session, user: User, day_id: uuid.UUID) -> TripDay:
    day = session.get(TripDay, day_id)
    if day is None or day.trip.user_id != user.id:
        raise NotFound("Giorno non trovato")
    return day


def day_number(day: TripDay) -> int:
    return (day.date - day.trip.start_date).days + 1


def update_day(session: Session, user: User, day_id: uuid.UUID, data: DayUpdate) -> TripDay:
    day = get_day(session, user, day_id)
    for name, value in data.model_dump(exclude_unset=True).items():
        if isinstance(value, str):
            value = value.strip() or None
        setattr(day, name, value)
    session.commit()
    return day
