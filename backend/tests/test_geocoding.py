from fastapi.testclient import TestClient

from app.models.enums import StopCategory
from app.services.geocoding import GeocodingService, get_geocoding_service
from app.services.geocoding.base import Place, category_from_osm
from app.services.geocoding.photon import _to_place


class FakeProvider:
    name = "fake"

    def __init__(self) -> None:
        self.calls = 0

    def search(
        self, query: str, *, lat: float | None, lon: float | None, limit: int
    ) -> list[Place]:
        self.calls += 1
        return [
            Place("Katz's Delicatessen", "New York", 40.7223, -73.9874, StopCategory.food, None)
        ]


def test_category_from_osm() -> None:
    assert category_from_osm("amenity", "restaurant") == StopCategory.food
    assert category_from_osm("tourism", "museum") == StopCategory.attraction
    assert category_from_osm("tourism", "hotel") == StopCategory.hotel
    assert category_from_osm("shop", "books") == StopCategory.shopping
    assert category_from_osm("place", "city") is None


def test_photon_feature_parsing() -> None:
    place = _to_place(
        {
            "geometry": {"coordinates": [-73.9969, 40.7061]},
            "properties": {
                "name": "Brooklyn Bridge",
                "city": "New York",
                "country": "United States",
                "osm_type": "W",
                "osm_id": 375157262,
                "osm_key": "man_made",
                "osm_value": "bridge",
            },
        }
    )
    assert place is not None
    assert place.name == "Brooklyn Bridge"
    assert (place.lat, place.lon) == (40.7061, -73.9969)
    assert place.external_ref == "osm:W:375157262"
    assert place.address == "New York, United States"


def test_service_caches_results() -> None:
    provider = FakeProvider()
    service = GeocodingService(provider)
    service.search("katz", 40.71, -73.99)
    service.search("  Katz ", 40.72, -73.98)
    assert provider.calls == 1


def test_geocode_endpoint_uses_provider(client: TestClient) -> None:
    from app.main import app

    app.dependency_overrides[get_geocoding_service] = lambda: GeocodingService(FakeProvider())
    response = client.get("/api/geocode/search", params={"q": "katz", "lat": 40.7, "lon": -74})
    assert response.status_code == 200
    assert response.json()[0]["category"] == "food"
    assert client.get("/api/geocode/search", params={"q": "k"}).status_code == 422
