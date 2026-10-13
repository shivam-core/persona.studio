"""Health and readiness check routes."""

import os
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    """Liveness probe returning process status."""
    return {
        "status": "healthy",
        "service": "persona-studio-api",
        "app_env": settings.APP_ENV,
        "access_mode": settings.ACCESS_MODE,
    }


@router.get("/ready")
def readiness_check(db: Session = Depends(get_db)):
    """Readiness probe checking database connectivity and storage directory."""
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    storage_ok = os.path.exists(settings.DATA_DIR) and os.access(settings.DATA_DIR, os.W_OK)

    if db_ok and storage_ok:
        return {
            "status": "ready",
            "database": "connected",
            "storage": "writable",
            "access_mode": settings.ACCESS_MODE,
        }

    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "unready",
            "database": "connected" if db_ok else "unreachable",
            "storage": "writable" if storage_ok else "unwritable",
        },
    )
