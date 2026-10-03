from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.models import User
from app.services.users import get_or_create_local_user

DbSession = Annotated[Session, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def get_current_user(session: DbSession, settings: AppSettings) -> User:
    # Punto unico in cui in futuro si inserirà l'autenticazione.
    return get_or_create_local_user(session, settings.local_username)


CurrentUser = Annotated[User, Depends(get_current_user)]
