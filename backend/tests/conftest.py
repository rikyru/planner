"""Test su un vero PostgreSQL+PostGIS.

Database: TEST_DATABASE_URL (default: database `planner_test` sullo stesso server di
DATABASE_URL). Lo schema viene creato con le migrazioni Alembic; ogni test gira in una
transazione annullata alla fine.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session

from alembic import command

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _test_url() -> str:
    explicit = os.environ.get("TEST_DATABASE_URL")
    if explicit:
        return explicit
    base = make_url(
        os.environ.get(
            "DATABASE_URL", "postgresql+psycopg://planner:planner@localhost:5432/planner"
        )
    )
    return base.set(database="planner_test").render_as_string(hide_password=False)


TEST_URL = _test_url()
os.environ["DATABASE_URL"] = TEST_URL


@pytest.fixture(scope="session")
def engine(tmp_path_factory: pytest.TempPathFactory) -> Iterator[Engine]:
    url = make_url(TEST_URL)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database}
        )
        if exists:
            conn.execute(text(f'DROP DATABASE "{url.database}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin.dispose()

    os.environ["DATA_DIR"] = str(tmp_path_factory.mktemp("data"))
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")

    eng = create_engine(TEST_URL)
    yield eng
    eng.dispose()


@pytest.fixture()
def session(engine: Engine) -> Iterator[Session]:
    connection = engine.connect()
    transaction = connection.begin()
    db = Session(
        bind=connection,
        autoflush=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    try:
        yield db
    finally:
        db.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(session: Session) -> Iterator[TestClient]:
    from app.db.session import get_session
    from app.main import app

    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
