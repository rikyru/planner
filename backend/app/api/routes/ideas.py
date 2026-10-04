import uuid

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.ideas import IdeaCreate, IdeaOut, IdeaUpdate, ScheduleIdea, StopToIdeaResult
from app.schemas.trips import DayOut
from app.services import ideas, serializers

router = APIRouter(tags=["ideas"])


@router.get("/trips/{trip_id}/ideas", response_model=list[IdeaOut])
def list_ideas(trip_id: uuid.UUID, session: DbSession, user: CurrentUser) -> list[IdeaOut]:
    return [serializers.idea_out(i) for i in ideas.list_ideas(session, user, trip_id)]


@router.post("/trips/{trip_id}/ideas", response_model=IdeaOut, status_code=status.HTTP_201_CREATED)
def create_idea(
    trip_id: uuid.UUID, data: IdeaCreate, session: DbSession, user: CurrentUser
) -> IdeaOut:
    return serializers.idea_out(ideas.create_idea(session, user, trip_id, data))


@router.patch("/ideas/{idea_id}", response_model=IdeaOut)
def update_idea(
    idea_id: uuid.UUID, data: IdeaUpdate, session: DbSession, user: CurrentUser
) -> IdeaOut:
    return serializers.idea_out(ideas.update_idea(session, user, idea_id, data))


@router.delete("/ideas/{idea_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_idea(idea_id: uuid.UUID, session: DbSession, user: CurrentUser) -> Response:
    ideas.delete_idea(session, user, idea_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/ideas/{idea_id}/schedule", response_model=DayOut)
def schedule_idea(
    idea_id: uuid.UUID, data: ScheduleIdea, session: DbSession, user: CurrentUser
) -> DayOut:
    """Mette l'idea in un giorno come tappa; restituisce il giorno aggiornato."""
    return serializers.day_out(ideas.schedule_idea(session, user, idea_id, data))


@router.post("/stops/{stop_id}/to-idea", response_model=StopToIdeaResult)
def stop_to_idea(stop_id: uuid.UUID, session: DbSession, user: CurrentUser) -> StopToIdeaResult:
    """Toglie la tappa dal giorno e la rimette tra le idee (orari e segmenti si perdono)."""
    day, idea = ideas.stop_to_idea(session, user, stop_id)
    return StopToIdeaResult(day=serializers.day_out(day), idea=serializers.idea_out(idea))
