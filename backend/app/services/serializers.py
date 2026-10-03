"""Costruzione dei DTO di risposta a partire dai modelli."""

import uuid

from app.models import Photo, Segment, Stop, Trip, TripDay
from app.repositories.trips import TripCounts
from app.schemas.photos import PhotoOut
from app.schemas.stops import SegmentOut, StopOut
from app.schemas.trips import DayOut, TripDetail, TripSummary
from app.services.geo import lat_lon, line_coords
from app.services.photos import photo_urls


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


def photo_out(photo: Photo) -> PhotoOut:
    coords = lat_lon(photo.location)
    return PhotoOut(
        id=photo.id,
        trip_id=photo.trip_id,
        day_id=photo.day_id,
        stop_id=photo.stop_id,
        original_filename=photo.original_filename,
        mime_type=photo.mime_type,
        width=photo.width,
        height=photo.height,
        size_bytes=photo.size_bytes,
        taken_at=photo.taken_at,
        taken_at_offset=photo.taken_at_offset,
        lat=coords[0] if coords else None,
        lon=coords[1] if coords else None,
        caption=photo.caption,
        created_at=photo.created_at,
        **photo_urls(photo.id),
    )


def cover_url(photo_id: uuid.UUID | None) -> str | None:
    return photo_urls(photo_id)["display_url"] if photo_id else None


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
        cover_photo_id=trip.cover_photo_id,
        cover_url=cover_url(trip.cover_photo_id or counts.first_photo_id),
        day_count=counts.day_count,
        stop_count=counts.stop_count,
        photo_count=counts.photo_count,
        updated_at=trip.updated_at,
    )


def trip_detail(trip: Trip, counts: TripCounts) -> TripDetail:
    summary = trip_summary(trip, counts)
    return TripDetail(
        **summary.model_dump(),
        share_token=trip.share_token,
        days=[day_out(d) for d in trip.days],
    )
