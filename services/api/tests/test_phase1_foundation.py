"""Test Phase 1 runnable foundation: DB, API, health endpoints, and worker execution."""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.jobs.repository import create_job, claim_next_job, complete_job
from app.db.models.job import Job


def test_health_and_readiness():
    client = TestClient(app)
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "healthy"

    ready = client.get("/ready")
    assert ready.status_code == 200
    assert ready.json()["database"] == "connected"


def test_workspace_settings():
    client = TestClient(app)
    res = client.get("/api/v1/workspace")
    assert res.status_code == 200
    data = res.json()
    assert "currency" in data
    assert "timezone" in data


def test_worker_job_lifecycle():
    with SessionLocal() as db:
        from app.api.routes.workspace import get_or_create_default_workspace
        ws = get_or_create_default_workspace(db)

        # Create a job
        job = create_job(db, workspace_id=ws.id, kind="test_job", input_data={"hello": "world"})
        assert job.status == "queued"
        job_id = job.id

        # Worker claims job
        claimed = claim_next_job(db)
        assert claimed is not None
        assert claimed.id == job_id
        assert claimed.status == "running"
        assert claimed.attempt_count == 1

        # Complete job
        complete_job(db, job_id, result_ref={"processed": True})

        # Verify completed in DB
        refreshed = db.query(Job).filter(Job.id == job_id).first()
        assert refreshed.status == "succeeded"
        assert refreshed.progress_pct == 100.0
        assert refreshed.result_ref == {"processed": True}
