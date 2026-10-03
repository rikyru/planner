from fastapi.testclient import TestClient


def setup_day(client: TestClient, names: list[str]) -> dict:
    trip = client.post(
        "/api/trips",
        json={"title": "NYC", "start_date": "2025-05-01", "end_date": "2025-05-02"},
    ).json()
    day = trip["days"][0]
    for name in names:
        day = client.post(f"/api/days/{day['id']}/stops", json={"name": name}).json()
    return {"trip": trip, "day": day}


def pairs(day: dict) -> list[tuple[str, str]]:
    names = {s["id"]: s["name"] for s in day["stops"]}
    return [(names[s["from_stop_id"]], names[s["to_stop_id"]]) for s in day["segments"]]


def test_create_stop_with_minimal_data(client: TestClient) -> None:
    day = setup_day(client, ["Hotel"])["day"]
    stop = day["stops"][0]
    assert stop["name"] == "Hotel"
    assert stop["position"] == 0
    assert stop["lat"] is None and stop["lon"] is None
    assert stop["planned_time_precision"] == "unknown"
    assert stop["actual_time_precision"] == "unknown"
    assert day["segments"] == []


def test_create_stop_with_full_data(client: TestClient) -> None:
    day = setup_day(client, [])["day"]
    day = client.post(
        f"/api/days/{day['id']}/stops",
        json={
            "name": "Brooklyn Bridge",
            "lat": 40.7061,
            "lon": -73.9969,
            "category": "attraction",
            "planned_arrival": "09:45",
            "planned_duration_min": 60,
            "notes": "Attraversare a piedi",
        },
    ).json()
    stop = day["stops"][0]
    assert abs(stop["lat"] - 40.7061) < 1e-6
    assert abs(stop["lon"] + 73.9969) < 1e-6
    assert stop["planned_arrival"] == "09:45:00"
    # Un orario senza precisione esplicita è esatto; actual resta intatto.
    assert stop["planned_time_precision"] == "exact"
    assert stop["actual_arrival"] is None


def test_approximate_time_for_reconstruction(client: TestClient) -> None:
    day = setup_day(client, [])["day"]
    day = client.post(
        f"/api/days/{day['id']}/stops",
        json={"name": "DUMBO", "actual_time_precision": "afternoon"},
    ).json()
    stop = day["stops"][0]
    assert stop["actual_arrival"] is None
    assert stop["actual_time_precision"] == "afternoon"


def test_coordinates_must_come_together(client: TestClient) -> None:
    day = setup_day(client, [])["day"]
    response = client.post(f"/api/days/{day['id']}/stops", json={"name": "X", "lat": 40.0})
    assert response.status_code == 422


def test_consecutive_stops_get_segments(client: TestClient) -> None:
    day = setup_day(client, ["Hotel", "Bridge", "DUMBO"])["day"]
    assert [s["position"] for s in day["stops"]] == [0, 1, 2]
    assert pairs(day) == [("Hotel", "Bridge"), ("Bridge", "DUMBO")]
    assert all(s["transport_mode"] == "unknown" for s in day["segments"])


def test_insert_at_position(client: TestClient) -> None:
    day = setup_day(client, ["Hotel", "DUMBO"])["day"]
    day = client.post(f"/api/days/{day['id']}/stops", json={"name": "Bridge", "position": 1}).json()
    assert [s["name"] for s in day["stops"]] == ["Hotel", "Bridge", "DUMBO"]
    assert pairs(day) == [("Hotel", "Bridge"), ("Bridge", "DUMBO")]


def test_reorder_keeps_segments_that_still_exist(client: TestClient) -> None:
    day = setup_day(client, ["A", "B", "C", "D"])["day"]
    seg_ab = day["segments"][0]
    client.patch(f"/api/segments/{seg_ab['id']}", json={"transport_mode": "subway"})
    ids = {s["name"]: s["id"] for s in day["stops"]}

    day = client.post(
        f"/api/days/{day['id']}/reorder-stops",
        json={"stop_ids": [ids["A"], ids["B"], ids["D"], ids["C"]]},
    ).json()

    assert [s["name"] for s in day["stops"]] == ["A", "B", "D", "C"]
    assert [s["position"] for s in day["stops"]] == [0, 1, 2, 3]
    assert pairs(day) == [("A", "B"), ("B", "D"), ("D", "C")]
    kept = day["segments"][0]
    assert kept["id"] == seg_ab["id"]
    assert kept["transport_mode"] == "subway"
    assert day["segments"][1]["transport_mode"] == "unknown"


def test_reorder_rejects_wrong_set(client: TestClient) -> None:
    day = setup_day(client, ["A", "B"])["day"]
    response = client.post(
        f"/api/days/{day['id']}/reorder-stops", json={"stop_ids": [day["stops"][0]["id"]]}
    )
    assert response.status_code == 409


def test_delete_stop_renumbers_and_relinks(client: TestClient) -> None:
    day = setup_day(client, ["A", "B", "C"])["day"]
    b = day["stops"][1]
    day = client.delete(f"/api/stops/{b['id']}").json()
    assert [(s["name"], s["position"]) for s in day["stops"]] == [("A", 0), ("C", 1)]
    assert pairs(day) == [("A", "C")]


def test_move_stop_to_another_day(client: TestClient) -> None:
    ctx = setup_day(client, ["A", "B", "C"])
    day1 = ctx["day"]
    day2_id = ctx["trip"]["days"][1]["id"]
    b = day1["stops"][1]

    source, target = client.post(f"/api/stops/{b['id']}/move", json={"day_id": day2_id}).json()
    assert [s["name"] for s in source["stops"]] == ["A", "C"]
    assert pairs(source) == [("A", "C")]
    assert [s["name"] for s in target["stops"]] == ["B"]
    assert target["segments"] == []


def test_update_stop_keeps_planned_when_setting_actual(client: TestClient) -> None:
    day = setup_day(client, [])["day"]
    day = client.post(
        f"/api/days/{day['id']}/stops", json={"name": "MoMA", "planned_arrival": "10:00"}
    ).json()
    stop_id = day["stops"][0]["id"]
    stop = client.patch(
        f"/api/stops/{stop_id}",
        json={"actual_arrival": "11:30", "actual_time_precision": "approximate"},
    ).json()
    assert stop["planned_arrival"] == "10:00:00"
    assert stop["planned_time_precision"] == "exact"
    assert stop["actual_arrival"] == "11:30:00"
    assert stop["actual_time_precision"] == "approximate"


def test_clear_location(client: TestClient) -> None:
    day = setup_day(client, [])["day"]
    day = client.post(
        f"/api/days/{day['id']}/stops", json={"name": "X", "lat": 40.7, "lon": -74.0}
    ).json()
    stop = client.patch(
        f"/api/stops/{day['stops'][0]['id']}", json={"lat": None, "lon": None}
    ).json()
    assert stop["lat"] is None
