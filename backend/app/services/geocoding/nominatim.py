import threading
import time
from typing import Any

import httpx

from app.services.geocoding.base import Place, category_from_osm, osm_ref


class NominatimProvider:
    """Nominatim. La policy pubblica vieta l'autocompletamento e impone max 1 richiesta/s:
    il frontend usa un debounce e qui le richieste vengono serializzate."""

    name = "nominatim"
    _min_interval_s = 1.0

    def __init__(
        self, base_url: str, user_agent: str, timeout: float, language: str = "en"
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"), headers={"User-Agent": user_agent}, timeout=timeout
        )
        self._lock = threading.Lock()
        self._last_call = 0.0
        self._language = language

    def search(
        self, query: str, *, lat: float | None, lon: float | None, limit: int
    ) -> list[Place]:
        params: dict[str, Any] = {
            "q": query,
            "format": "jsonv2",
            "limit": limit,
            "addressdetails": 0,
            # Nominatim cerca in tutti i nomi (Pechino, Beijing, 北京) e restituisce questa lingua.
            "accept-language": self._language,
        }
        if lat is not None and lon is not None:
            # Preferenza (non vincolo) per i risultati vicini al viaggio.
            params["viewbox"] = f"{lon - 0.5},{lat + 0.5},{lon + 0.5},{lat - 0.5}"
        with self._lock:
            wait = self._min_interval_s - (time.monotonic() - self._last_call)
            if wait > 0:
                time.sleep(wait)
            try:
                response = self._client.get("/search", params=params)
            finally:
                self._last_call = time.monotonic()
        response.raise_for_status()
        return [p for item in response.json() if (p := _to_place(item))]


def _to_place(item: dict[str, Any]) -> Place | None:
    try:
        lat, lon = float(item["lat"]), float(item["lon"])
    except (KeyError, TypeError, ValueError):
        return None
    display = item.get("display_name") or None
    name = item.get("name") or (display.split(",")[0] if display else None)
    if not name:
        return None
    return Place(
        name=str(name),
        address=display,
        lat=lat,
        lon=lon,
        category=category_from_osm(item.get("category"), item.get("type")),
        external_ref=osm_ref(item.get("osm_type"), item.get("osm_id")),
    )
