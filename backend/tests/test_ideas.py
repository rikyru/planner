from fastapi.testclient import TestClient


def make_trip(client: TestClient) -> dict:
    trip = client.post(
        "/api/trips",
        json={"title": "NYC", "start_date": "2026-05-26", "end_date": "2026-05-27"},
    ).json()
    day = trip["days"][0]
    for name in ("Battery Park", "Chinatown"):
        day = client.post(f"/api/days/{day['id']}/stops", json={"name": name}).json()
    trip["days"][0] = day
    return trip


def test_neighborhood_category(client: TestClient) -> None:
    day = make_trip(client)["days"][0]
    day = client.post(
        f"/api/days/{day['id']}/stops", json={"name": "East Village", "category": "neighborhood"}
    ).json()
    assert day["stops"][-1]["category"] == "neighborhood"


def test_idea_crud(client: TestClient) -> None:
    trip = make_trip(client)
    idea = client.post(
        f"/api/trips/{trip['id']}/ideas",
        json={
            "name": " Summit One Vanderbilt ",
            "lat": 40.753,
            "lon": -73.9787,
            "notes": "Palloncini",
        },
    ).json()
    assert idea["name"] == "Summit One Vanderbilt" and idea["category"] == "attraction"
    assert idea["lat"] == 40.753

    idea = client.patch(f"/api/ideas/{idea['id']}", json={"category": "custom"}).json()
    assert idea["category"] == "custom"
    assert [i["id"] for i in client.get(f"/api/trips/{trip['id']}/ideas").json()] == [idea["id"]]

    assert client.delete(f"/api/ideas/{idea['id']}").status_code == 204
    assert client.get(f"/api/trips/{trip['id']}/ideas").json() == []


def test_schedule_idea_creates_stop_and_segments(client: TestClient) -> None:
    trip = make_trip(client)
    day = trip["days"][0]
    idea = client.post(
        f"/api/trips/{trip['id']}/ideas",
        json={"name": "The Met", "lat": 40.7794, "lon": -73.9632, "category": "attraction"},
    ).json()

    response = client.post(
        f"/api/ideas/{idea['id']}/schedule", json={"day_id": day["id"], "position": 1}
    )
    assert response.status_code == 200
    day = response.json()
    assert [s["name"] for s in day["stops"]] == ["Battery Park", "The Met", "Chinatown"]
    assert day["stops"][1]["lat"] == 40.7794
    assert len(day["segments"]) == 2
    assert client.get(f"/api/trips/{trip['id']}/ideas").json() == []


def test_schedule_into_other_trip_is_rejected(client: TestClient) -> None:
    trip = make_trip(client)
    other = make_trip(client)
    idea = client.post(f"/api/trips/{trip['id']}/ideas", json={"name": "Met"}).json()
    response = client.post(
        f"/api/ideas/{idea['id']}/schedule", json={"day_id": other["days"][0]["id"]}
    )
    assert response.status_code == 422
    assert len(client.get(f"/api/trips/{trip['id']}/ideas").json()) == 1


def test_stop_back_to_ideas(client: TestClient) -> None:
    trip = make_trip(client)
    stop = trip["days"][0]["stops"][0]
    result = client.post(f"/api/stops/{stop['id']}/to-idea").json()
    assert [s["name"] for s in result["day"]["stops"]] == ["Chinatown"]
    assert result["day"]["segments"] == []
    assert result["idea"]["name"] == "Battery Park"
    assert len(client.get(f"/api/trips/{trip['id']}/ideas").json()) == 1


def test_shared_page_lists_ideas(client: TestClient) -> None:
    trip = make_trip(client)
    client.post(f"/api/trips/{trip['id']}/ideas", json={"name": "Messa gospel ad Harlem"})
    token = client.post(f"/api/trips/{trip['id']}/share").json()["token"]
    shared = client.get(f"/api/share/{token}").json()
    assert [i["name"] for i in shared["ideas"]] == ["Messa gospel ad Harlem"]
