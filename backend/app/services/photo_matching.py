"""Punto di estensione per l'associazione automatica foto → tappa (roadmap V0.5).

Non è usato nell'MVP: l'associazione è manuale. Le foto salvano già `taken_at` e `location`
(indicizzata con GIST), quindi un matcher potrà proporre la tappa più vicina nel tempo e nello
spazio con una query `ST_DWithin` sulle tappe del giorno.
"""

import uuid
from typing import Protocol

from sqlalchemy.orm import Session

from app.models import Photo


class PhotoMatcher(Protocol):
    def suggest_stop(self, session: Session, photo: Photo) -> uuid.UUID | None: ...


class NoMatcher:
    def suggest_stop(self, session: Session, photo: Photo) -> uuid.UUID | None:
        return None
