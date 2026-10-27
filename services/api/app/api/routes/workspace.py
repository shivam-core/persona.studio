"""Workspace management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.workspace import Workspace
from app.security.auth import require_mutation_access, create_owner_session, verify_password
from app.config import settings

router = APIRouter(prefix="/workspace", tags=["Workspace"])


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    currency: str
    timezone: str
    is_synthetic_demo: bool
    settings_json: dict


class WorkspaceUpdate(BaseModel):
    name: str | None = None
    currency: str | None = None
    timezone: str | None = None
    settings_json: dict | None = None


class LoginRequest(BaseModel):
    password: str


def get_or_create_default_workspace(db: Session) -> Workspace:
    ws = db.execute(select(Workspace).order_by(Workspace.created_at.asc())).scalars().first()
    if not ws:
        ws = Workspace(
            name="Persona Studio Demo Workspace",
            currency=settings.DEFAULT_CURRENCY,
            timezone=settings.DEFAULT_TIMEZONE,
            is_synthetic_demo=False,
            settings_json={},
        )
        db.add(ws)
        db.commit()
        db.refresh(ws)
    return ws


@router.get("", response_model=WorkspaceResponse)
def get_workspace(db: Session = Depends(get_db)):
    """Get active workspace configuration."""
    ws = get_or_create_default_workspace(db)
    return WorkspaceResponse(
        id=ws.id,
        name=ws.name,
        currency=ws.currency,
        timezone=ws.timezone,
        is_synthetic_demo=ws.is_synthetic_demo,
        settings_json=ws.settings_json or {},
    )


@router.patch("", response_model=WorkspaceResponse)
def update_workspace(
    payload: WorkspaceUpdate,
    db: Session = Depends(get_db),
    _authorized: bool = Depends(require_mutation_access),
):
    """Update workspace parameters."""
    ws = get_or_create_default_workspace(db)
    if payload.name is not None:
        ws.name = payload.name
    if payload.currency is not None:
        ws.currency = payload.currency
    if payload.timezone is not None:
        ws.timezone = payload.timezone
    if payload.settings_json is not None:
        ws.settings_json = payload.settings_json

    db.commit()
    db.refresh(ws)
    return WorkspaceResponse(
        id=ws.id,
        name=ws.name,
        currency=ws.currency,
        timezone=ws.timezone,
        is_synthetic_demo=ws.is_synthetic_demo,
        settings_json=ws.settings_json or {},
    )


@router.post("/login")
def owner_login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate owner when in public_owner access mode."""
    if settings.ACCESS_MODE != "public_owner":
        return {"message": "Authentication not required in current mode.", "authenticated": True}

    if not settings.OWNER_PASSWORD_HASH or not verify_password(settings.OWNER_PASSWORD_HASH, payload.password):
        raise HTTPException(status_code=401, detail="Invalid password.")

    token = create_owner_session(db)
    response.set_cookie(
        key="persona_session",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.APP_ENV == "production",
    )
    return {"message": "Authenticated successfully.", "token": token}


@router.post("/reset")
def reset_workspace_data(
    db: Session = Depends(get_db),
    _authorized: bool = Depends(require_mutation_access),
):
    """
    Completely removes all synthetic and existing data across all tables,
    resetting the workspace to a clean, fresh state ready for real dataset uploads.
    """
    from app.db.models import (
        PersonaCard,
        EvidenceMetric,
        SegmentMembership,
        SegmentationRun,
        CustomerFeature,
        FeatureSnapshot,
        SimulationRun,
        AllocationRun,
        ExperimentAnalysis,
        ExperimentOutcome,
        ExperimentAssignment,
        AudienceMember,
        AudienceSnapshot,
        Experiment,
        Campaign,
        EngagementEvent,
        OrderLine,
        Offering,
        Customer,
        UploadFile,
        ValidationIssue,
        DatasetVersion,
    )

    ws = get_or_create_default_workspace(db)

    # Delete in strict child -> parent foreign-key dependency order
    db.query(ExperimentAnalysis).delete()
    db.query(ExperimentOutcome).delete()
    db.query(ExperimentAssignment).delete()
    db.query(Experiment).delete()
    db.query(AllocationRun).delete()
    db.query(Campaign).delete()
    db.query(SimulationRun).delete()
    db.query(EvidenceMetric).delete()
    db.query(PersonaCard).delete()
    db.query(SegmentMembership).delete()
    db.query(SegmentationRun).delete()
    db.query(AudienceMember).delete()
    db.query(AudienceSnapshot).delete()
    db.query(CustomerFeature).delete()
    db.query(FeatureSnapshot).delete()
    db.query(EngagementEvent).delete()
    db.query(OrderLine).delete()
    db.query(Offering).delete()
    db.query(Customer).delete()
    db.query(ValidationIssue).delete()
    db.query(UploadFile).delete()
    db.query(DatasetVersion).delete()

    ws.is_synthetic_demo = False
    ws.name = "Persona Studio Workspace"
    db.commit()

    return {
        "status": "success",
        "message": "All synthetic and existing data successfully removed. Workspace is clean and ready for real data ingestion.",
    }
