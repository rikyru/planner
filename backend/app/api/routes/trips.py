import uuid

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.models import Trip
from app.repositories.trips import counts_by_trip, list_trips_for_user
from app.schemas.trips import DayOut, TripCreate, TripDetail, TripSummary, TripUpdate
from app.services import serializers, trips

router = APIRouter(prefix="/trips", tags=["trips"])


def _detail(session: DbSession, trip: Trip) -> TripDetail:
    return serializers.trip_detail(trip, counts_by_trip(session, [trip.id])[trip.id])


@router.get("", response_model=list[TripSummary])
def list_trips(session: DbSession, user: CurrentUser) -> list[TripSummary]:
    items = list_trips_for_user(session, user.id)
    counts = counts_by_trip(session, [t.id for t in items])
    return [serializers.trip_summary(t, counts[t.id]) for t in items]


@router.post("", response_model=TripDetail, status_code=status.HTTP_201_CREATED)
def create_trip(data: TripCreate, session: DbSession, user: CurrentUser) -> TripDetail:
    return _detail(session, trips.create_trip(session, user, data))


@router.get("/{trip_id}", response_model=TripDetail)
def get_trip(trip_id: uuid.UUID, session: DbSession, user: CurrentUser) -> TripDetail:
    return _detail(session, trips.get_trip(session, user, trip_id))


@router.patch("/{trip_id}", response_model=TripDetail)
def update_trip(
    trip_id: uuid.UUID,
    data: TripUpdate,
    session: DbSession,
    user: CurrentUser,
    confirm_delete_days: bool = Query(
        default=False, description="Conferma l'eliminazione di giorni che contengono tappe"
    ),
) -> TripDetail:
    trip = trips.update_trip(session, user, trip_id, data, confirm_delete_days)
    return _detail(session, trip)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(trip_id: uuid.UUID, session: DbSession, user: CurrentUser) -> Response:
    trips.delete_trip(session, user, trip_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{trip_id}/days", response_model=list[DayOut])
def list_days(trip_id: uuid.UUID, session: DbSession, user: CurrentUser) -> list[DayOut]:
    trip = trips.get_trip(session, user, trip_id)
    return [serializers.day_out(d) for d in trip.days]
