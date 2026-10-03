import uuid

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.stops import ReorderStops, StopCreate
from app.schemas.trips import DayOut, DayUpdate
from app.services import days, serializers, stops

router = APIRouter(prefix="/days", tags=["days"])


@router.patch("/{day_id}", response_model=DayOut)
def update_day(day_id: uuid.UUID, data: DayUpdate, session: DbSession, user: CurrentUser) -> DayOut:
    return serializers.day_out(days.update_day(session, user, day_id, data))


@router.post("/{day_id}/stops", response_model=DayOut, status_code=status.HTTP_201_CREATED)
def create_stop(
    day_id: uuid.UUID, data: StopCreate, session: DbSession, user: CurrentUser
) -> DayOut:
    """Crea una tappa e restituisce il giorno aggiornato (tappe + segmenti riallineati)."""
    return serializers.day_out(stops.create_stop(session, user, day_id, data))


@router.post("/{day_id}/reorder-stops", response_model=DayOut)
def reorder_stops(
    day_id: uuid.UUID, data: ReorderStops, session: DbSession, user: CurrentUser
) -> DayOut:
    return serializers.day_out(stops.reorder_stops(session, user, day_id, data))
