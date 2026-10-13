"""Job status and cancellation endpoints."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.job import Job
from app.security.auth import require_mutation_access

router = APIRouter(prefix="/jobs", tags=["Jobs"])


class JobResponse(BaseModel):
    id: str
    workspace_id: str
    kind: str
    status: str
    phase: str
    progress_pct: float
    attempt_count: int
    created_at: datetime
    started_at: datetime | None
    heartbeat_at: datetime | None
    finished_at: datetime | None
    result_ref: dict | None
    error_code: str | None
    error_message: str | None


@router.get("/{job_id}", response_model=JobResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Fetch status and progress for a background job."""
    job = db.execute(select(Job).where(Job.id == job_id)).scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    return JobResponse(
        id=job.id,
        workspace_id=job.workspace_id,
        kind=job.kind,
        status=job.status,
        phase=job.phase,
        progress_pct=job.progress_pct,
        attempt_count=job.attempt_count,
        created_at=job.created_at,
        started_at=job.started_at,
        heartbeat_at=job.heartbeat_at,
        finished_at=job.finished_at,
        result_ref=job.result_ref,
        error_code=job.error_code,
        error_message=job.error_message,
    )


@router.post("/{job_id}/cancel")
def request_job_cancellation(
    job_id: str,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """Request cooperative cancellation for an in-progress or queued job."""
    job = db.execute(select(Job).where(Job.id == job_id)).scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job.status in ["succeeded", "failed", "cancelled"]:
        return {"message": f"Job is already finished with status '{job.status}'."}

    if job.status == "queued":
        job.status = "cancelled"
        job.phase = "cancelled"
        job.finished_at = datetime.utcnow()
        db.commit()
        return {"message": "Queued job was cancelled immediately."}

    # Running job: request cooperative cancellation
    job.status = "cancel_requested"
    db.commit()
    return {"message": "Job cancellation requested."}
