"""Servizio di geocoding: sceglie il provider da configurazione e aggiunge una cache in memoria."""

import logging
import threading
import time
from collections import OrderedDict
from functools import lru_cache

import httpx

from app.core.config import get_settings
from app.core.errors import ExternalServiceError
from app.services.geocoding.base import GeocodingProvider, Place
from app.services.geocoding.nominatim import NominatimProvider
from app.services.geocoding.photon import PhotonProvider

logger = logging.getLogger(__name__)

__all__ = ["GeocodingService", "Place", "get_geocoding_service"]


class GeocodingService:
    """`provider` serve la ricerca mentre si digita; `deep_provider` la ricerca esplicita
    "Cerca ancora", per i nomi che il primo non conosce (es. Pechino su Photon)."""

    def __init__(
        self,
        provider: GeocodingProvider,
        deep_provider: GeocodingProvider | None = None,
        cache_size: int = 512,
        ttl_s: float = 86_400,
    ):
        self.provider = provider
        self.deep_provider = deep_provider or provider
        self._cache: OrderedDict[tuple[object, ...], tuple[float, list[Place]]] = OrderedDict()
        self._cache_size = cache_size
        self._ttl_s = ttl_s
        self._lock = threading.Lock()

    def search(
        self,
        query: str,
        lat: float | None = None,
        lon: float | None = None,
        limit: int = 6,
        *,
        deep: bool = False,
    ) -> list[Place]:
        provider = self.deep_provider if deep else self.provider
        query = " ".join(query.split())
        # Il bias viene arrotondato (~10 km): ricerche nella stessa zona condividono la cache.
        key = (provider.name, query.lower(), _round(lat), _round(lon), limit)
        now = time.monotonic()
        with self._lock:
            hit = self._cache.get(key)
            if hit and now - hit[0] < self._ttl_s:
                self._cache.move_to_end(key)
                return hit[1]
        try:
            places = provider.search(query, lat=_round(lat), lon=_round(lon), limit=limit)
        except httpx.HTTPError as exc:
            logger.warning("Geocoding %s fallito per %r: %s", provider.name, query, exc)
            raise ExternalServiceError("Il servizio di ricerca luoghi non risponde") from exc
        with self._lock:
            self._cache[key] = (now, places)
            while len(self._cache) > self._cache_size:
                self._cache.popitem(last=False)
        return places


def _round(value: float | None) -> float | None:
    return None if value is None else round(value, 1)


@lru_cache
def get_geocoding_service() -> GeocodingService:
    s = get_settings()
    lang = s.geocoder_language
    nominatim = NominatimProvider(
        s.nominatim_url, s.geocoder_user_agent, s.geocoder_timeout_s, lang
    )
    if s.geocoder == "nominatim":
        return GeocodingService(nominatim)
    photon = PhotonProvider(s.photon_url, s.geocoder_user_agent, s.geocoder_timeout_s, lang)
    return GeocodingService(photon, deep_provider=nominatim)
