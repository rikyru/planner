from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configurazione letta da variabili d'ambiente (vedi .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://planner:planner@postgres:5432/planner"
    data_dir: Path = Path("/data")
    log_level: str = "INFO"

    # Utente locale implicito: l'MVP non ha login.
    local_username: str = "local"

    # Mappa: stile MapLibre (JSON style URL), sostituibile senza ricompilare il frontend.
    map_style_url: str = "https://tiles.openfreemap.org/styles/liberty"
    map_attribution: str = ""

    # Geocoding
    geocoder: Literal["photon", "nominatim"] = "photon"
    photon_url: str = "https://photon.komoot.io"
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    geocoder_user_agent: str = "planner-selfhosted/0.1"
    geocoder_timeout_s: float = 8.0
    # Lingua dei nomi restituiti (Pechino invece di 北京市). Photon pubblico ne supporta poche:
    # se rifiuta questa si ripiega sull'inglese.
    geocoder_language: str = "it"

    # URL pubblico usato per comporre i link di condivisione (vuoto = relativo).
    public_base_url: str = ""

    @property
    def photos_dir(self) -> Path:
        return self.data_dir / "photos"


@lru_cache
def get_settings() -> Settings:
    return Settings()
