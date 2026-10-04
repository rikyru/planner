import logging
from typing import Any

import httpx

from app.services.geocoding.base import Place, category_from_osm, osm_ref

logger = logging.getLogger(__name__)

_FALLBACK_LANGUAGE = "en"


class PhotonProvider:
    """Photon (komoot o self-hosted): pensato per la ricerca mentre si digita."""

    name = "photon"

    def __init__(
        self, base_url: str, user_agent: str, timeout: float, language: str = "en"
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"), headers={"User-Agent": user_agent}, timeout=timeout
        )
        # Senza lingua Photon restituisce i nomi locali (北京市, Москва).
        self._language = language

    def search(
        self, query: str, *, lat: float | None, lon: float | None, limit: int
    ) -> list[Place]:
        params: dict[str, Any] = {"q": query, "limit": limit, "lang": self._language}
        if lat is not None and lon is not None:
            params.update(lat=lat, lon=lon)
        response = self._client.get("/api", params=params)
        if response.status_code == 400 and self._language != _FALLBACK_LANGUAGE:
            # Lingua non supportata da questa istanza: si passa all'inglese una volta per tutte.
            logger.info(
                "Photon non supporta la lingua %r: uso %r", self._language, _FALLBACK_LANGUAGE
            )
            self._language = _FALLBACK_LANGUAGE
            return self.search(query, lat=lat, lon=lon, limit=limit)
        response.raise_for_status()
        return [p for f in response.json().get("features", []) if (p := _to_place(f))]


def _to_place(feature: dict[str, Any]) -> Place | None:
    props = feature.get("properties") or {}
    coords = (feature.get("geometry") or {}).get("coordinates") or []
    if len(coords) < 2:
        return None
    street = " ".join(str(x) for x in (props.get("street"), props.get("housenumber")) if x)
    parts = [
        street,
        props.get("district"),
        props.get("city"),
        props.get("state"),
        props.get("country"),
    ]
    address = ", ".join(dict.fromkeys(str(p) for p in parts if p)) or None
    name = props.get("name") or street or props.get("city") or address
    if not name:
        return None
    return Place(
        name=str(name),
        address=address,
        lat=float(coords[1]),
        lon=float(coords[0]),
        category=category_from_osm(props.get("osm_key"), props.get("osm_value")),
        external_ref=osm_ref(props.get("osm_type"), props.get("osm_id")),
    )
