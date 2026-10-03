import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.stops import MoveStop, StopOut, StopUpdate
from app.schemas.trips import DayOut
from app.services import serializers, stops

router = APIRouter(prefix="/stops", tags=["stops"])


@router.patch("/{stop_id}", response_model=StopOut)
def update_stop(
    stop_id: uuid.UUID, data: StopUpdate, session: DbSession, user: CurrentUser
) -> StopOut:
    return serializers.stop_out(stops.update_stop(session, user, stop_id, data))


@router.delete("/{stop_id}", response_model=DayOut)
def delete_stop(stop_id: uuid.UUID, session: DbSession, user: CurrentUser) -> DayOut:
    """Elimina la tappa e restituisce il giorno con posizioni e segmenti riallineati."""
    return serializers.day_out(stops.delete_stop(session, user, stop_id))


@router.post("/{stop_id}/move", response_model=list[DayOut])
def move_stop(
    stop_id: uuid.UUID, data: MoveStop, session: DbSession, user: CurrentUser
) -> list[DayOut]:
    """Sposta la tappa in un altro giorno; restituisce i giorni coinvolti."""
    source, target = stops.move_stop(session, user, stop_id, data)
    days = [source] if source is target else [source, target]
    return [serializers.day_out(d) for d in days]
