from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import AppSettings

router = APIRouter(tags=["system"])


class PublicConfig(BaseModel):
    map_style_url: str
    map_attribution: str
    geocoder: str
    version: str


@router.get("/config", response_model=PublicConfig)
def public_config(settings: AppSettings) -> PublicConfig:
    return PublicConfig(
        map_style_url=settings.map_style_url,
        map_attribution=settings.map_attribution,
        geocoder=settings.geocoder,
        version="0.1.0",
    )
