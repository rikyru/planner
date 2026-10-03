from fastapi.testclient import TestClient


def make_trip(client: TestClient, start: str = "2025-05-01", end: str = "2025-05-07", **extra):
    body = {"title": "New York", "start_date": start, "end_date": end, **extra}
    response = client.post("/api/trips", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_trip_generates_one_day_per_date(client: TestClient) -> None:
    trip = make_trip(client, kind="reconstruct", timezone="America/New_York")

    assert trip["title"] == "New York"
    assert trip["kind"] == "reconstruct"
    assert trip["visibility"] == "private"
    assert trip["day_count"] == 7
    dates = [d["date"] for d in trip["days"]]
    assert dates == [f"2025-05-0{i}" for i in range(1, 8)]
    assert [d["day_number"] for d in trip["days"]] == list(range(1, 8))


def test_single_day_trip(client: TestClient) -> None:
    trip = make_trip(client, start="2025-06-10", end="2025-06-10")
    assert trip["day_count"] == 1


def test_rejects_end_before_start(client: TestClient) -> None:
    response = client.post(
        "/api/trips", json={"title": "X", "start_date": "2025-05-07", "end_date": "2025-05-01"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_rejects_invalid_timezone(client: TestClient) -> None:
    response = client.post(
        "/api/trips",
        json={
            "title": "X",
            "start_date": "2025-05-01",
            "end_date": "2025-05-02",
            "timezone": "Mars",
        },
    )
    assert response.status_code == 422


def test_list_trips_with_counts(client: TestClient) -> None:
    trip = make_trip(client)
    client.post(f"/api/days/{trip['days'][0]['id']}/stops", json={"name": "Hotel"})

    items = client.get("/api/trips").json()
    assert len(items) == 1
    assert items[0]["day_count"] == 7
    assert items[0]["stop_count"] == 1


def test_extending_dates_adds_days_and_keeps_existing(client: TestClient) -> None:
    trip = make_trip(client)
    first_day = trip["days"][0]
    client.patch(f"/api/days/{first_day['id']}", json={"title": "Arrivo"})

    updated = client.patch(
        f"/api/trips/{trip['id']}", json={"start_date": "2025-04-30", "end_date": "2025-05-08"}
    ).json()

    assert updated["day_count"] == 9
    kept = next(d for d in updated["days"] if d["date"] == "2025-05-01")
    assert kept["id"] == first_day["id"]
    assert kept["title"] == "Arrivo"
    assert kept["day_number"] == 2


def test_shrinking_removes_empty_days_without_confirmation(client: TestClient) -> None:
    trip = make_trip(client)
    updated = client.patch(f"/api/trips/{trip['id']}", json={"end_date": "2025-05-05"})
    assert updated.status_code == 200
    assert updated.json()["day_count"] == 5


def test_shrinking_days_with_stops_requires_confirmation(client: TestClient) -> None:
    trip = make_trip(client)
    last_day = trip["days"][-1]
    client.post(f"/api/days/{last_day['id']}/stops", json={"name": "JFK"})

    refused = client.patch(f"/api/trips/{trip['id']}", json={"end_date": "2025-05-05"})
    assert refused.status_code == 409
    assert refused.json()["error"]["details"]["days"] == ["2025-05-07"]

    confirmed = client.patch(
        f"/api/trips/{trip['id']}?confirm_delete_days=true", json={"end_date": "2025-05-05"}
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["stop_count"] == 0


def test_update_title_and_day(client: TestClient) -> None:
    trip = make_trip(client)
    response = client.patch(f"/api/trips/{trip['id']}", json={"title": "  NYC  "})
    assert response.json()["title"] == "NYC"

    day = client.patch(
        f"/api/days/{trip['days'][2]['id']}", json={"title": "Brooklyn", "notes": "Ponte"}
    ).json()
    assert day["title"] == "Brooklyn"
    assert day["notes"] == "Ponte"


def test_delete_trip(client: TestClient) -> None:
    trip = make_trip(client)
    assert client.delete(f"/api/trips/{trip['id']}").status_code == 204
    assert client.get(f"/api/trips/{trip['id']}").status_code == 404
    assert client.get("/api/trips").json() == []


def test_unknown_trip_returns_error_body(client: TestClient) -> None:
    response = client.get("/api/trips/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "not_found", "message": "Viaggio non trovato", "details": None}
    }
