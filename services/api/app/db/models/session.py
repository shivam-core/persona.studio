"""Owner authentication and session management."""

from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base, generate_uuid


class OwnerSession(Base):
    __tablename__ = "owner_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    token_hash: Mapped[str] = mapped_column(String(64), index=True, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
