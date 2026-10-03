"""Conversioni tra colonne PostGIS e coordinate semplici esposte dall'API."""

from typing import Any

from geoalchemy2.elements import WKBElement
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import LineString, Point


def point(lat: float, lon: float) -> WKBElement:
    return from_shape(Point(lon, lat), srid=4326)


def lat_lon(value: Any | None) -> tuple[float, float] | None:
    if value is None:
        return None
    shape = to_shape(value)
    return (shape.y, shape.x)


def line_coords(value: Any | None) -> list[tuple[float, float]] | None:
    if value is None:
        return None
    shape = to_shape(value)
    if not isinstance(shape, LineString):
        return None
    return [(float(x), float(y)) for x, y, *_ in shape.coords]
