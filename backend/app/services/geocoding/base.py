"""Astrazione del geocoding: il provider si sceglie da configurazione e si può sostituire."""

from dataclasses import dataclass
from typing import Protocol

from app.models.enums import StopCategory


@dataclass(frozen=True)
class Place:
    name: str
    address: str | None
    lat: float
    lon: float
    category: StopCategory | None
    # Riferimento stabile al luogo OSM, es. "osm:N:123456".
    external_ref: str | None


class GeocodingProvider(Protocol):
    name: str

    def search(
        self, query: str, *, lat: float | None, lon: float | None, limit: int
    ) -> list[Place]: ...


# Mappa (chiave OSM, valore OSM) → categoria; il valore "*" vale per tutta la chiave.
_OSM_CATEGORIES: dict[tuple[str, str], StopCategory] = {
    ("amenity", "restaurant"): StopCategory.food,
    ("amenity", "cafe"): StopCategory.food,
    ("amenity", "fast_food"): StopCategory.food,
    ("amenity", "food_court"): StopCategory.food,
    ("amenity", "ice_cream"): StopCategory.food,
    ("amenity", "bar"): StopCategory.nightlife,
    ("amenity", "pub"): StopCategory.nightlife,
    ("amenity", "nightclub"): StopCategory.nightlife,
    ("amenity", "theatre"): StopCategory.nightlife,
    ("amenity", "parking"): StopCategory.parking,
    ("amenity", "parking_entrance"): StopCategory.parking,
    ("amenity", "bus_station"): StopCategory.transport,
    ("amenity", "ferry_terminal"): StopCategory.transport,
    ("tourism", "hotel"): StopCategory.hotel,
    ("tourism", "hostel"): StopCategory.hotel,
    ("tourism", "motel"): StopCategory.hotel,
    ("tourism", "guest_house"): StopCategory.hotel,
    ("tourism", "apartment"): StopCategory.hotel,
    ("tourism", "*"): StopCategory.attraction,
    ("historic", "*"): StopCategory.attraction,
    ("leisure", "park"): StopCategory.nature,
    ("leisure", "garden"): StopCategory.nature,
    ("leisure", "nature_reserve"): StopCategory.nature,
    ("natural", "*"): StopCategory.nature,
    ("shop", "*"): StopCategory.shopping,
    ("railway", "*"): StopCategory.transport,
    ("public_transport", "*"): StopCategory.transport,
    ("aeroway", "*"): StopCategory.transport,
}


def category_from_osm(key: str | None, value: str | None) -> StopCategory | None:
    if not key:
        return None
    return _OSM_CATEGORIES.get((key, value or "")) or _OSM_CATEGORIES.get((key, "*"))


def osm_ref(osm_type: str | None, osm_id: int | str | None) -> str | None:
    if not osm_type or osm_id is None:
        return None
    return f"osm:{osm_type[0].upper()}:{osm_id}"
