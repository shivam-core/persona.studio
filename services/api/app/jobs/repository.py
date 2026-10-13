"""Job queue repository with FOR UPDATE SKIP LOCKED pattern."""

import hashlib
import json
from datetime import datetime, timedelta
from sqlalchemy import select, update
from sqlalchemy.orm import Session
from app.db.models.job import Job
from app.db.session import generate_uuid


def create_job(
    db: Session,
    workspace_id: str,
    kind: str,
    input_data: dict,
) -> Job:
    """Enqueue a new job with its computed input hash."""
    serialized = json.dumps(input_data, sort_keys=True)
    input_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    job = Job(
        id=generate_uuid(),
        workspace_id=workspace_id,
        kind=kind,
        input_json=input_data,
        input_hash=input_hash,
        status="queued",
        phase="queued",
        progress_pct=0.0,
        attempt_count=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def claim_next_job(db: Session, max_lease_seconds: int = 300) -> Job | None:
    """
    Claim the next queued or stalled job using FOR UPDATE SKIP LOCKED.
    Recovers stalled running jobs where heartbeat is older than max_lease_seconds.
    """
    now = datetime.utcnow()
    stale_cutoff = now - timedelta(seconds=max_lease_seconds)

    # 1. Look for queued jobs
    stmt = (
        select(Job)
        .where(Job.status == "queued")
        .order_by(Job.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    job = db.execute(stmt).scalars().first()

    # 2. If no queued job, look for stalled running jobs
    if not job:
        stalled_stmt = (
            select(Job)
            .where(
                Job.status == "running",
                Job.heartbeat_at < stale_cutoff,
                Job.attempt_count < 2,
            )
            .order_by(Job.heartbeat_at.asc())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        job = db.execute(stalled_stmt).scalars().first()

    if job:
        job.status = "running"
        job.started_at = now
        job.heartbeat_at = now
        job.attempt_count += 1
        db.commit()
        db.refresh(job)

    return job


def update_job_heartbeat(db: Session, job_id: str) -> None:
    """Update heartbeat timestamp for a running job."""
    db.execute(
        update(Job)
        .where(Job.id == job_id, Job.status == "running")
        .values(heartbeat_at=datetime.utcnow())
    )
    db.commit()


def update_job_progress(
    db: Session,
    job_id: str,
    phase: str,
    progress_pct: float,
) -> None:
    """Update phase and progress percentage for a running job."""
    db.execute(
        update(Job)
        .where(Job.id == job_id, Job.status == "running")
        .values(
            phase=phase,
            progress_pct=progress_pct,
            heartbeat_at=datetime.utcnow(),
        )
    )
    db.commit()


def check_job_cancellation(db: Session, job_id: str) -> bool:
    """Check if cancellation has been requested for this job."""
    status = db.execute(
        select(Job.status).where(Job.id == job_id)
    ).scalar_one_or_none()
    return status == "cancel_requested"


def complete_job(
    db: Session,
    job_id: str,
    result_ref: dict | None = None,
) -> None:
    """Mark a job as successfully completed."""
    now = datetime.utcnow()
    db.execute(
        update(Job)
        .where(Job.id == job_id)
        .values(
            status="succeeded",
            phase="completed",
            progress_pct=100.0,
            finished_at=now,
            heartbeat_at=now,
            result_ref=result_ref or {},
        )
    )
    db.commit()


def fail_job(
    db: Session,
    job_id: str,
    error_code: str,
    error_message: str,
) -> None:
    """Mark a job as failed."""
    now = datetime.utcnow()
    db.execute(
        update(Job)
        .where(Job.id == job_id)
        .values(
            status="failed",
            phase="failed",
            finished_at=now,
            heartbeat_at=now,
            error_code=error_code,
            error_message=error_message,
        )
    )
    db.commit()


def cancel_job(db: Session, job_id: str) -> None:
    """Mark a job as cancelled."""
    now = datetime.utcnow()
    db.execute(
        update(Job)
        .where(Job.id == job_id)
        .values(
            status="cancelled",
            phase="cancelled",
            finished_at=now,
            heartbeat_at=now,
        )
    )
    db.commit()
