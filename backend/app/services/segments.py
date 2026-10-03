"""Segmenti: uno per ogni coppia di tappe consecutive dello stesso giorno.

Il server li mantiene coerenti dopo ogni mutazione delle tappe. Un segmento la cui coppia
(from, to) resta consecutiva conserva mezzo, durate e note; gli altri vengono eliminati e
quelli mancanti creati con transport_mode = unknown.
"""

import logging
import uuid

from sqlalchemy.orm import Session

from app.core.errors import NotFound
from app.models import Segment, TripDay, User
from app.schemas.stops import SegmentUpdate

logger = logging.getLogger(__name__)


def rebuild(session: Session, day: TripDay) -> None:
    session.flush()
    session.refresh(day, ["stops", "segments"])
    stops = sorted(day.stops, key=lambda s: s.position)
    wanted = {(a.id, b.id) for a, b in zip(stops, stops[1:], strict=False)}
    existing = {(s.from_stop_id, s.to_stop_id): s for s in day.segments}

    stale = [seg for pair, seg in existing.items() if pair not in wanted]
    for seg in stale:
        day.segments.remove(seg)
    # Flush prima degli insert: from_stop_id/to_stop_id sono unique.
    session.flush()

    for from_id, to_id in sorted(wanted - existing.keys(), key=lambda p: str(p)):
        day.segments.append(Segment(from_stop_id=from_id, to_stop_id=to_id))
    session.flush()
    if stale or wanted - existing.keys():
        logger.debug("Giorno %s: segmenti rimossi %d, totali %d", day.id, len(stale), len(wanted))


def get_segment(session: Session, user: User, segment_id: uuid.UUID) -> Segment:
    segment = session.get(Segment, segment_id)
    if segment is None or segment.day.trip.user_id != user.id:
        raise NotFound("Segmento non trovato")
    return segment


def update_segment(
    session: Session, user: User, segment_id: uuid.UUID, data: SegmentUpdate
) -> Segment:
    segment = get_segment(session, user, segment_id)
    for name, value in data.model_dump(exclude_unset=True).items():
        if name == "transport_mode" and value is None:
            continue
        setattr(segment, name, value)
    session.commit()
    return segment
