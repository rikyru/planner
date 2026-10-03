"""Costruzione dei DTO di risposta a partire dai modelli."""

from app.models import Segment, Stop, Trip, TripDay
from app.repositories.trips import TripCounts
from app.schemas.stops import SegmentOut, StopOut
from app.schemas.trips import DayOut, TripDetail, TripSummary
from app.services.geo import lat_lon, line_coords


def stop_out(stop: Stop) -> StopOut:
    coords = lat_lon(stop.location)
    return StopOut.model_validate(
        {
            **{c: getattr(stop, c) for c in StopOut.model_fields if hasattr(stop, c)},
            "lat": coords[0] if coords else None,
            "lon": coords[1] if coords else None,
        }
    )


def segment_out(segment: Segment) -> SegmentOut:
    return SegmentOut(
        id=segment.id,
        day_id=segment.day_id,
        from_stop_id=segment.from_stop_id,
        to_stop_id=segment.to_stop_id,
        transport_mode=segment.transport_mode,
        planned_duration_min=segment.planned_duration_min,
        actual_duration_min=segment.actual_duration_min,
        distance_m=segment.distance_m,
        geometry=line_coords(segment.geometry),
        notes=segment.notes,
    )


def day_out(day: TripDay) -> DayOut:
    start = day.trip.start_date
    by_from = {s.from_stop_id: s for s in day.segments}
    ordered_segments = [by_from[st.id] for st in day.stops if st.id in by_from]
    return DayOut(
        id=day.id,
        trip_id=day.trip_id,
        date=day.date,
        day_number=(day.date - start).days + 1,
        title=day.title,
        notes=day.notes,
        stops=[stop_out(s) for s in day.stops],
        segments=[segment_out(s) for s in ordered_segments],
    )


def trip_summary(trip: Trip, counts: TripCounts) -> TripSummary:
    return TripSummary(
        id=trip.id,
        title=trip.title,
        description=trip.description,
        start_date=trip.start_date,
        end_date=trip.end_date,
        kind=trip.kind,
        visibility=trip.visibility,
        timezone=trip.timezone,
        cover_url=None,
        day_count=counts.day_count,
        stop_count=counts.stop_count,
        updated_at=trip.updated_at,
    )


def trip_detail(trip: Trip) -> TripDetail:
    stop_count = sum(len(d.stops) for d in trip.days)
    summary = trip_summary(trip, TripCounts(day_count=len(trip.days), stop_count=stop_count))
    return TripDetail(
        **summary.model_dump(),
        share_token=trip.share_token,
        days=[day_out(d) for d in trip.days],
    )
