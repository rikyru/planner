from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import DbSession
from app.core.errors import DomainError

router = APIRouter(tags=["system"])


class DatabaseUnavailable(DomainError):
    status_code = 503
    code = "database_unavailable"


@router.get("/health")
def health(session: DbSession) -> dict[str, str]:
    try:
        postgis = session.scalar(text("SELECT postgis_lib_version()"))
    except Exception as exc:
        raise DatabaseUnavailable("Database non raggiungibile") from exc
    return {"status": "ok", "postgis": str(postgis)}
