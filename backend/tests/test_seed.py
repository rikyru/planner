import json

from sqlalchemy.orm import Session

from seed.load import SEED_FILE


def test_seed_file_is_consistent() -> None:
    data = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    assert len(data["days"]) == 7
    categories, modes = set(), set()
    for day in data["days"]:
        assert 3 <= len(day["stops"]) <= 5
        assert len(day["segments"]) == len(day["stops"]) - 1
        categories |= {s["category"] for s in day["stops"]}
        modes |= {m for m, _ in day["segments"]}
    assert len(categories) >= 5
    assert len(modes) >= 4


def test_seed_loads(session: Session, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    import seed.load as loader

    monkeypatch.setattr(loader, "SessionLocal", lambda: _NoClose(session))
    trip = loader.load(json.loads(SEED_FILE.read_text(encoding="utf-8")))
    assert trip is not None
    assert len(trip.days) == 7
    assert sum(len(d.stops) for d in trip.days) == 33
    assert all(len(d.segments) == len(d.stops) - 1 for d in trip.days)
    assert loader.load(json.loads(SEED_FILE.read_text(encoding="utf-8"))) is None


class _NoClose:
    def __init__(self, session: Session) -> None:
        self.session = session

    def __enter__(self) -> Session:
        return self.session

    def __exit__(self, *args: object) -> None:
        return None
