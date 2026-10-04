"""Carica il viaggio demo "New York, 7 giorni" o un altro viaggio nello stesso formato JSON.

Uso:  python -m seed.load                    (salta se esiste già un viaggio con lo stesso titolo)
      python -m seed.load --replace          (lo ricrea)
      python -m seed.load mio-viaggio.json   (carica un file nello stesso formato)
"""

import argparse
import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import Trip
from app.schemas.ideas import IdeaCreate
from app.schemas.stops import SegmentUpdate, StopCreate
from app.schemas.trips import DayUpdate, TripCreate
from app.services import days, ideas, segments, stops, trips
from app.services.users import get_or_create_local_user

logger = logging.getLogger("seed")
SEED_FILE = Path(__file__).with_name("new_york.json")


def load(data: dict[str, Any], replace: bool = False) -> Trip | None:
    with SessionLocal() as session:
        user = get_or_create_local_user(session, get_settings().local_username)
        existing = session.scalar(
            select(Trip).where(Trip.user_id == user.id, Trip.title == data["title"])
        )
        if existing and not replace:
            logger.info("Il viaggio %r esiste già: nessuna modifica", data["title"])
            return None
        if existing:
            trips.delete_trip(session, user, existing.id)

        trip = trips.create_trip(
            session,
            user,
            TripCreate(
                **{
                    k: data[k]
                    for k in ("title", "description", "start_date", "end_date", "kind", "timezone")
                }
            ),
        )
        for day, day_data in zip(trip.days, data["days"], strict=True):
            days.update_day(
                session,
                user,
                day.id,
                DayUpdate(title=day_data.get("title"), notes=day_data.get("notes")),
            )
            for stop_data in day_data["stops"]:
                stops.create_stop(session, user, day.id, StopCreate(**stop_data))
            session.refresh(day)
            by_from = {s.from_stop_id: s for s in day.segments}
            for stop, (mode, minutes) in zip(day.stops, day_data.get("segments", []), strict=False):
                segment = by_from[stop.id]
                segments.update_segment(
                    session,
                    user,
                    segment.id,
                    SegmentUpdate(transport_mode=mode, actual_duration_min=minutes),
                )
        for idea_data in data.get("ideas", []):
            ideas.create_idea(session, user, trip.id, IdeaCreate(**idea_data))
        logger.info("Creato viaggio %r (%s)", trip.title, trip.id)
        return trip


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "file", nargs="?", type=Path, default=SEED_FILE, help="JSON del viaggio (default: demo)"
    )
    parser.add_argument("--replace", action="store_true", help="ricrea il viaggio se esiste")
    args = parser.parse_args()
    load(json.loads(args.file.read_text(encoding="utf-8")), replace=args.replace)


if __name__ == "__main__":
    main()
