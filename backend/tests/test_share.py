from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.services import storage
from tests.test_photos import make_jpeg, upload


@pytest.fixture(autouse=True)
def photos_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "photos"
    monkeypatch.setattr(storage, "root", lambda: root)
    return root


def make_trip(client: TestClient, kind: str = "reconstruct") -> dict:
    trip = client.post(
        "/api/trips",
        json={"title": "NYC", "start_date": "2025-05-12", "end_date": "2025-05-13", "kind": kind},
    ).json()
    day = trip["days"][0]
    day = client.post(
        f"/api/days/{day['id']}/stops",
        json={
            "name": "Top of the Rock",
            "lat": 40.7593,
            "lon": -73.9794,
            "planned_arrival": "10:00",
            "actual_time_precision": "afternoon",
            "notes": "Vista migliore dell'Empire",
        },
    ).json()
    day = client.post(f"/api/days/{day['id']}/stops", json={"name": "Bryant Park"}).json()
    trip["days"][0] = day
    return trip


def test_share_token_creation(client: TestClient) -> None:
    trip = make_trip(client)
    assert client.get(f"/api/trips/{trip['id']}/share").json()["visibility"] == "private"

    info = client.post(f"/api/trips/{trip['id']}/share").json()
    assert info["visibility"] == "unlisted"
    token = info["token"]
    assert len(token) >= 32 and info["path"] == f"/share/{token}"

    # Riattivare non cambia il link.
    assert client.post(f"/api/trips/{trip['id']}/share").json()["token"] == token
    detail = client.get(f"/api/trips/{trip['id']}").json()
    assert detail["visibility"] == "unlisted" and detail["share_token"] == token

    other = make_trip(client)
    assert client.post(f"/api/trips/{other['id']}/share").json()["token"] != token


def test_rotate_and_disable_invalidate_old_link(client: TestClient) -> None:
    trip = make_trip(client)
    old = client.post(f"/api/trips/{trip['id']}/share").json()["token"]
    assert client.get(f"/api/share/{old}").status_code == 200

    new = client.post(f"/api/trips/{trip['id']}/share/rotate").json()["token"]
    assert new != old
    assert client.get(f"/api/share/{old}").status_code == 404
    assert client.get(f"/api/share/{new}").status_code == 200

    info = client.delete(f"/api/trips/{trip['id']}/share").json()
    assert info == {"visibility": "private", "token": None, "path": None, "url": None}
    assert client.get(f"/api/share/{new}").status_code == 404


def test_unknown_token_is_404(client: TestClient) -> None:
    response = client.get("/api/share/non-esiste")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
    assert client.get("/api/share/" + "x" * 200).status_code == 404


def test_public_view_contents(client: TestClient) -> None:
    trip = make_trip(client)
    day = trip["days"][0]
    stop_id = day["stops"][0]["id"]
    on_stop = upload(client, trip["id"], ("a.jpg", make_jpeg()), stop_id=stop_id)["created"][0]
    loose = upload(client, trip["id"], ("b.jpg", make_jpeg(color=(1, 1, 1))))["created"][0]
    client.patch(f"/api/photos/{on_stop['id']}", json={"caption": "Dall'alto"})
    token = client.post(f"/api/trips/{trip['id']}/share").json()["token"]

    response = client.get(f"/api/share/{token}")
    assert response.headers["x-robots-tag"].startswith("noindex")
    shared = response.json()
    assert shared["title"] == "NYC" and shared["stop_count"] == 2
    assert "id" not in shared and "share_token" not in shared

    first = shared["days"][0]
    stop = first["stops"][0]
    # Viaggio ricostruito: si mostra il lato effettivo (pomeriggio), non l'orario pianificato.
    assert stop["time"] is None and stop["time_precision"] == "afternoon"
    assert stop["notes"] == "Vista migliore dell'Empire"
    assert len(first["segments"]) == 1

    # Solo le foto assegnate, senza coordinate né EXIF.
    assert [p["id"] for p in first["photos"]] == [on_stop["id"]]
    photo = first["photos"][0]
    assert photo["caption"] == "Dall'alto" and photo["taken_time"] == "10:15:00"
    assert not {"lat", "lon", "exif", "original_url", "original_filename"} & photo.keys()
    assert shared["cover_url"] == photo["display_url"]
    assert shared["photo_count"] == 1

    assert client.get(photo["thumb_url"]).headers["content-type"] == "image/webp"
    original = client.get(f"/api/share/{token}/photos/{on_stop['id']}?size=original")
    assert original.headers["content-type"] == "image/webp"  # mai l'originale con GPS
    assert client.get(f"/api/share/{token}/photos/{loose['id']}").status_code == 404


def test_plan_trip_shows_planned_time(client: TestClient) -> None:
    trip = make_trip(client, kind="plan")
    token = client.post(f"/api/trips/{trip['id']}/share").json()["token"]
    stop = client.get(f"/api/share/{token}").json()["days"][0]["stops"][0]
    assert stop["time"] == "10:00:00" and stop["time_precision"] == "exact"


def test_photo_of_another_trip_is_not_served(client: TestClient) -> None:
    shared = make_trip(client)
    token = client.post(f"/api/trips/{shared['id']}/share").json()["token"]
    other = make_trip(client)
    photo = upload(client, other["id"], ("o.jpg", make_jpeg()), day_id=other["days"][0]["id"])[
        "created"
    ][0]
    assert client.get(f"/api/share/{token}/photos/{photo['id']}").status_code == 404
