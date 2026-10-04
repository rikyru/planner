from collections.abc import Callable

import httpx
from fastapi.testclient import TestClient

from app.models.enums import StopCategory
from app.services.geocoding import GeocodingService, get_geocoding_service
from app.services.geocoding.base import Place, category_from_osm
from app.services.geocoding.nominatim import NominatimProvider
from app.services.geocoding.photon import PhotonProvider, _to_place


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


def test_service_deep_search_uses_deep_provider() -> None:
    fast, deep = FakeProvider(), FakeProvider()
    deep.name = "deep"
    service = GeocodingService(fast, deep_provider=deep)
    service.search("pechino")
    service.search("pechino", deep=True)
    service.search("pechino", deep=True)
    assert (fast.calls, deep.calls) == (1, 1)


def _mock_client(handler: Callable[[httpx.Request], httpx.Response], base_url: str) -> httpx.Client:
    return httpx.Client(base_url=base_url, transport=httpx.MockTransport(handler))


def test_photon_asks_for_language_and_falls_back_to_english() -> None:
    seen: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        lang = request.url.params.get("lang")
        seen.append(lang)
        if lang == "it":
            return httpx.Response(400, json={"message": "language it is not supported"})
        feature = {
            "geometry": {"coordinates": [116.39, 39.91]},
            "properties": {
                "name": "Beijing",
                "country": "China",
                "osm_type": "R",
                "osm_id": 912940,
            },
        }
        return httpx.Response(200, json={"features": [feature]})

    provider = PhotonProvider("https://photon.test", "test", 5, language="it")
    provider._client = _mock_client(handler, "https://photon.test")
    assert [p.name for p in provider.search("Beijing", lat=None, lon=None, limit=3)] == ["Beijing"]
    # La lingua rifiutata non viene più richiesta.
    provider.search("Shanghai", lat=None, lon=None, limit=3)
    assert seen == ["it", "en", "en"]


def test_nominatim_sends_accept_language() -> None:
    seen: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.params.get("accept-language"))
        item = {
            "lat": "39.9057",
            "lon": "116.3913",
            "name": "Pechino",
            "osm_type": "relation",
            "osm_id": 912940,
        }
        return httpx.Response(200, json=[item])

    provider = NominatimProvider("https://nominatim.test", "test", 5, language="it")
    provider._client = _mock_client(handler, "https://nominatim.test")
    places = provider.search("Pechino", lat=None, lon=None, limit=3)
    assert seen == ["it"]
    assert places[0].name == "Pechino"


def test_geocode_endpoint_deep_flag(client: TestClient) -> None:
    from app.main import app

    fast, deep = FakeProvider(), FakeProvider()
    deep.name = "deep"
    app.dependency_overrides[get_geocoding_service] = lambda: GeocodingService(
        fast, deep_provider=deep
    )
    assert (
        client.get("/api/geocode/search", params={"q": "pechino", "deep": True}).status_code == 200
    )
    assert (fast.calls, deep.calls) == (0, 1)
