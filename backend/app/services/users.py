from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User


def get_or_create_local_user(session: Session, username: str) -> User:
    """L'MVP non ha login: tutti i dati appartengono a un utente locale implicito."""
    user = session.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(username=username)
        session.add(user)
        session.commit()
    return user
