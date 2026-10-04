from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.models.enums import StopCategory
from app.schemas.common import ApiModel
from app.services.geocoding import GeocodingService, get_geocoding_service

router = APIRouter(prefix="/geocode", tags=["geocoding"])


class PlaceOut(ApiModel):
    name: str
    address: str | None
    lat: float
    lon: float
    category: StopCategory | None
    external_ref: str | None


@router.get("/search", response_model=list[PlaceOut])
def search(
    service: Annotated[GeocodingService, Depends(get_geocoding_service)],
    q: str = Query(min_length=2, max_length=200),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    limit: int = Query(default=6, ge=1, le=15),
    # Ricerca esplicita ("Cerca ancora"): usa un provider più completo ma più lento.
    deep: bool = False,
) -> list[PlaceOut]:
    return [PlaceOut.model_validate(p) for p in service.search(q, lat, lon, limit, deep=deep)]
