"""Security, session validation, and owner protection."""

import hashlib
import secrets
from datetime import datetime, timedelta
from fastapi import Request, HTTPException, Depends
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.config import settings
from app.db.session import get_db
from app.db.models.session import OwnerSession

ph = PasswordHasher()


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(hash_str: str, password: str) -> bool:
    try:
        return ph.verify(hash_str, password)
    except VerifyMismatchError:
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_owner_session(db: Session, duration_days: int = 7) -> str:
    """Create a new owner session and return the raw session token."""
    raw_token = secrets.token_urlsafe(32)
    token_h = hash_token(raw_token)
    session = OwnerSession(
        token_hash=token_h,
        expires_at=datetime.utcnow() + timedelta(days=duration_days),
    )
    db.add(session)
    db.commit()
    return raw_token


def require_mutation_access(request: Request, db: Session = Depends(get_db)):
    """
    Enforce security boundary on state-mutating requests:
    - In 'local' mode: allowed without authentication.
    - In 'public_readonly' mode: all mutations are blocked with HTTP 403.
    - In 'public_owner' mode: requires valid session cookie or Authorization bearer token.
    """
    mode = settings.ACCESS_MODE

    if mode == "public_readonly":
        raise HTTPException(
            status_code=403,
            detail="Mutations are disabled in public read-only demo mode.",
        )

    if mode == "local":
        return True

    if mode == "public_owner":
        # Check Authorization header or session cookie
        token = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        elif "persona_session" in request.cookies:
            token = request.cookies.get("persona_session")

        if not token:
            raise HTTPException(status_code=401, detail="Authentication required.")

        token_h = hash_token(token)
        session_obj = db.execute(
            select(OwnerSession).where(
                OwnerSession.token_hash == token_h,
                OwnerSession.expires_at > datetime.utcnow(),
            )
        ).scalar_one_or_none()

        if not session_obj:
            raise HTTPException(status_code=401, detail="Session expired or invalid.")

        return True

    return True
