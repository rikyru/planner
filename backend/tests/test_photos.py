import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import ExifTags, Image

import app.services.photos  # noqa: F401  registra il decoder HEIC
from app.services import exif as exif_service
from app.services import storage


@pytest.fixture(autouse=True)
def photos_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "photos"
    monkeypatch.setattr(storage, "root", lambda: root)
    return root


def make_jpeg(
    *,
    size: tuple[int, int] = (1200, 800),
    color: tuple[int, int, int] = (200, 80, 40),
    taken_at: str | None = "2025:05:13 10:15:00",
    gps: tuple[float, float] | None = (40.7484, -73.9857),
    orientation: int | None = None,
) -> bytes:
    image = Image.new("RGB", size, color)
    exif = Image.Exif()
    exif[ExifTags.Base.Make] = "TestCam"
    if orientation is not None:
        exif[ExifTags.Base.Orientation] = orientation
    if taken_at:
        exif.get_ifd(ExifTags.IFD.Exif)[ExifTags.Base.DateTimeOriginal] = taken_at
        exif.get_ifd(ExifTags.IFD.Exif)[ExifTags.Base.OffsetTimeOriginal] = "-04:00"
    if gps:
        lat, lon = gps
        info = exif.get_ifd(ExifTags.IFD.GPSInfo)
        info[ExifTags.GPS.GPSLatitudeRef] = "N" if lat >= 0 else "S"
        info[ExifTags.GPS.GPSLatitude] = _dms(abs(lat))
        info[ExifTags.GPS.GPSLongitudeRef] = "E" if lon >= 0 else "W"
        info[ExifTags.GPS.GPSLongitude] = _dms(abs(lon))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif, quality=85)
    return buffer.getvalue()


def _dms(value: float) -> tuple[float, float, float]:
    degrees = int(value)
    minutes = int((value - degrees) * 60)
    seconds = round(((value - degrees) * 60 - minutes) * 60, 4)
    return (float(degrees), float(minutes), seconds)


def make_trip(client: TestClient) -> dict:
    trip = client.post(
        "/api/trips",
        json={"title": "NYC", "start_date": "2025-05-12", "end_date": "2025-05-14"},
    ).json()
    day = client.post(f"/api/days/{trip['days'][1]['id']}/stops", json={"name": "Empire"}).json()
    trip["days"][1] = day
    return trip


def upload(client: TestClient, trip_id: str, *files: tuple[str, bytes], **form: str) -> dict:
    response = client.post(
        f"/api/trips/{trip_id}/photos",
        files=[("files", (name, data, "application/octet-stream")) for name, data in files],
        data=form,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_read_exif_extracts_time_and_gps() -> None:
    data = exif_service.read_exif(Image.open(io.BytesIO(make_jpeg())))
    assert data.taken_at is not None and data.taken_at.isoformat() == "2025-05-13T10:15:00"
    assert data.taken_at_offset == "-04:00"
    assert data.lat == pytest.approx(40.7484, abs=1e-4)
    assert data.lon == pytest.approx(-73.9857, abs=1e-4)
    assert data.extra["make"] == "TestCam"


def test_read_exif_without_metadata() -> None:
    image = Image.new("RGB", (10, 10))
    data = exif_service.read_exif(image)
    assert data.taken_at is None and data.lat is None and data.lon is None


def test_upload_stores_original_derivatives_and_metadata(
    client: TestClient, photos_root: Path
) -> None:
    trip = make_trip(client)
    original = make_jpeg()
    result = upload(client, trip["id"], ("IMG_0001.JPG", original))

    assert result["errors"] == [] and result["duplicates"] == []
    photo = result["created"][0]
    assert photo["original_filename"] == "IMG_0001.JPG"
    assert photo["mime_type"] == "image/jpeg"
    assert (photo["width"], photo["height"]) == (1200, 800)
    assert photo["taken_at"] == "2025-05-13T10:15:00"
    assert photo["lat"] == pytest.approx(40.7484, abs=1e-4)
    assert photo["day_id"] is None  # nessun matching automatico

    trip_dir = photos_root / trip["id"]
    assert (trip_dir / "originals" / f"{photo['id']}.jpg").read_bytes() == original
    thumb = Image.open(trip_dir / "thumbs" / f"{photo['id']}.webp")
    assert max(thumb.size) == storage.DERIVED_SIZES[storage.Variant.thumb]
    assert not thumb.getexif().get_ifd(ExifTags.IFD.GPSInfo)  # le varianti non hanno GPS

    response = client.get(photo["thumb_url"])
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    original_response = client.get(photo["original_url"])
    assert original_response.content == original


def test_upload_applies_exif_orientation_to_derivatives(
    client: TestClient, photos_root: Path
) -> None:
    trip = make_trip(client)
    photo = upload(client, trip["id"], ("r.jpg", make_jpeg(orientation=6)))["created"][0]
    assert (photo["width"], photo["height"]) == (800, 1200)
    display = Image.open(photos_root / trip["id"] / "display" / f"{photo['id']}.webp")
    assert display.size[1] > display.size[0]


def test_upload_multiple_with_duplicates_and_invalid_files(client: TestClient) -> None:
    trip = make_trip(client)
    first = make_jpeg()
    upload(client, trip["id"], ("a.jpg", first))

    result = upload(
        client,
        trip["id"],
        ("a-copia.jpg", first),
        ("b.jpg", make_jpeg(color=(10, 10, 10), gps=None, taken_at=None)),
        ("note.txt", b"non sono una foto"),
        ("vuoto.jpg", b""),
    )
    assert [p["original_filename"] for p in result["created"]] == ["b.jpg"]
    assert [p["original_filename"] for p in result["duplicates"]] == ["a.jpg"]
    assert {e["filename"]: e["code"] for e in result["errors"]} == {
        "note.txt": "unsupported_format",
        "vuoto.jpg": "empty_file",
    }
    assert len(client.get(f"/api/trips/{trip['id']}/photos").json()) == 2


def test_upload_to_stop_sets_day(client: TestClient) -> None:
    trip = make_trip(client)
    day = trip["days"][1]
    stop_id = day["stops"][0]["id"]
    photo = upload(client, trip["id"], ("s.jpg", make_jpeg()), stop_id=stop_id)["created"][0]
    assert photo["stop_id"] == stop_id and photo["day_id"] == day["id"]

    by_stop = client.get(f"/api/trips/{trip['id']}/photos", params={"stop_id": stop_id}).json()
    assert [p["id"] for p in by_stop] == [photo["id"]]


def test_manual_assignment_keeps_day_and_stop_consistent(client: TestClient) -> None:
    trip = make_trip(client)
    day1, day2 = trip["days"][0], trip["days"][1]
    stop_id = day2["stops"][0]["id"]
    photo = upload(client, trip["id"], ("p.jpg", make_jpeg()))["created"][0]

    photo = client.patch(f"/api/photos/{photo['id']}", json={"stop_id": stop_id}).json()
    assert (photo["day_id"], photo["stop_id"]) == (day2["id"], stop_id)

    # Cambiare giorno scollega la tappa del giorno precedente.
    photo = client.patch(f"/api/photos/{photo['id']}", json={"day_id": day1["id"]}).json()
    assert (photo["day_id"], photo["stop_id"]) == (day1["id"], None)

    photo = client.patch(f"/api/photos/{photo['id']}", json={"caption": "  Vista  "}).json()
    assert photo["caption"] == "Vista" and photo["day_id"] == day1["id"]

    other = client.post(
        "/api/trips", json={"title": "Altro", "start_date": "2025-01-01", "end_date": "2025-01-01"}
    ).json()
    response = client.patch(f"/api/photos/{photo['id']}", json={"day_id": other["days"][0]["id"]})
    assert response.status_code == 422


def test_moving_stop_moves_its_photos(client: TestClient) -> None:
    trip = make_trip(client)
    stop_id = trip["days"][1]["stops"][0]["id"]
    target = trip["days"][2]
    upload(client, trip["id"], ("m.jpg", make_jpeg()), stop_id=stop_id)

    client.post(f"/api/stops/{stop_id}/move", json={"day_id": target["id"]})
    photos = client.get(f"/api/trips/{trip['id']}/photos").json()
    assert photos[0]["day_id"] == target["id"] and photos[0]["stop_id"] == stop_id


def test_assign_by_date_only_touches_unassigned(client: TestClient) -> None:
    trip = make_trip(client)
    day1, day2 = trip["days"][0], trip["days"][1]
    upload(client, trip["id"], ("a.jpg", make_jpeg(taken_at="2025:05:13 09:00:00")))
    upload(
        client, trip["id"], ("b.jpg", make_jpeg(color=(1, 2, 3), taken_at="2025:06:01 09:00:00"))
    )
    manual = upload(client, trip["id"], ("c.jpg", make_jpeg(color=(4, 5, 6))), day_id=day1["id"])[
        "created"
    ][0]

    result = client.post(f"/api/trips/{trip['id']}/photos/assign-by-date").json()
    assert result == {"assigned": 1}
    photos = {
        p["original_filename"]: p for p in client.get(f"/api/trips/{trip['id']}/photos").json()
    }
    assert photos["a.jpg"]["day_id"] == day2["id"]
    assert photos["b.jpg"]["day_id"] is None  # fuori dalle date del viaggio
    assert photos["c.jpg"]["day_id"] == manual["day_id"]


def test_cover_and_fallback(client: TestClient) -> None:
    trip = make_trip(client)
    early = upload(client, trip["id"], ("e.jpg", make_jpeg(taken_at="2025:05:12 08:00:00")))
    late = upload(client, trip["id"], ("l.jpg", make_jpeg(color=(9, 9, 9))))
    early_id, late_id = early["created"][0]["id"], late["created"][0]["id"]

    summary = client.get("/api/trips").json()[0]
    assert summary["photo_count"] == 2
    assert summary["cover_photo_id"] is None
    assert early_id in summary["cover_url"]  # ripiego: la prima foto scattata

    detail = client.patch(f"/api/trips/{trip['id']}", json={"cover_photo_id": late_id}).json()
    assert detail["cover_photo_id"] == late_id and late_id in detail["cover_url"]

    client.delete(f"/api/photos/{late_id}")
    detail = client.get(f"/api/trips/{trip['id']}").json()
    assert detail["cover_photo_id"] is None and early_id in detail["cover_url"]


def test_delete_photo_and_trip_remove_files(client: TestClient, photos_root: Path) -> None:
    trip = make_trip(client)
    photo = upload(client, trip["id"], ("d.jpg", make_jpeg()))["created"][0]
    original = photos_root / trip["id"] / "originals" / f"{photo['id']}.jpg"
    assert original.exists()

    assert client.delete(f"/api/photos/{photo['id']}").status_code == 204
    assert not original.exists()
    assert client.get(photo["thumb_url"]).status_code == 404

    upload(client, trip["id"], ("d2.jpg", make_jpeg(color=(0, 0, 255))))
    assert client.delete(f"/api/trips/{trip['id']}").status_code == 204
    assert not (photos_root / trip["id"]).exists()


def test_missing_derivative_is_regenerated(client: TestClient, photos_root: Path) -> None:
    trip = make_trip(client)
    photo = upload(client, trip["id"], ("x.jpg", make_jpeg()))["created"][0]
    thumb = photos_root / trip["id"] / "thumbs" / f"{photo['id']}.webp"
    thumb.unlink()
    assert client.get(photo["thumb_url"]).status_code == 200
    assert thumb.exists()


def test_upload_heic_keeps_original_and_serves_webp(client: TestClient) -> None:
    trip = make_trip(client)
    buffer = io.BytesIO()
    Image.new("RGB", (640, 480), (30, 60, 90)).save(buffer, format="HEIF")
    photo = upload(client, trip["id"], ("IMG_1234.HEIC", buffer.getvalue()))["created"][0]
    assert photo["mime_type"] == "image/heic"
    assert client.get(photo["display_url"]).headers["content-type"] == "image/webp"
