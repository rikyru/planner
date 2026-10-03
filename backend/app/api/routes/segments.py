import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.stops import SegmentOut, SegmentUpdate
from app.services import segments, serializers

router = APIRouter(prefix="/segments", tags=["segments"])


@router.patch("/{segment_id}", response_model=SegmentOut)
def update_segment(
    segment_id: uuid.UUID, data: SegmentUpdate, session: DbSession, user: CurrentUser
) -> SegmentOut:
    return serializers.segment_out(segments.update_segment(session, user, segment_id, data))
