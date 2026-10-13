"""Dataset upload, mapping, validation, quarantine, and feature triggers."""

import os
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.dataset import DatasetVersion, UploadFile as DBUploadFile, ValidationIssue
from app.db.models.workspace import Workspace
from app.api.routes.workspace import get_or_create_default_workspace
from app.storage.adapter import storage
from app.security.auth import require_mutation_access
from app.domain.validation.engine import validate_tables
from app.domain.features.engine import build_features
from app.db.models.features import FeatureSnapshot, CustomerFeature
from app.config import settings

router = APIRouter(prefix="/datasets", tags=["Datasets"])


class DatasetResponse(BaseModel):
    id: str
    name: str
    version_number: int
    status: str
    currency: str
    timezone: str
    row_counts: dict
    accepted_rows: int
    quarantined_rows: int
    is_synthetic: bool
    created_at: datetime


class CreateDatasetDraft(BaseModel):
    name: str = "My Uploaded Dataset"


class ValidationSummaryResponse(BaseModel):
    is_valid: bool
    has_fatal_errors: bool
    total_issues: int
    accepted_rows: dict[str, int]
    quarantined_rows: dict[str, int]
    issues: list[dict]


class FeatureBuildRequest(BaseModel):
    as_of_at: datetime = Field(default_factory=datetime.utcnow)
    lookback_days: int = 180


@router.get("", response_model=list[DatasetResponse])
def list_datasets(db: Session = Depends(get_db)):
    """List all dataset versions in workspace."""
    ws = get_or_create_default_workspace(db)
    datasets = db.execute(
        select(DatasetVersion)
        .where(DatasetVersion.workspace_id == ws.id)
        .order_by(DatasetVersion.created_at.desc())
    ).scalars().all()

    return [
        DatasetResponse(
            id=d.id,
            name=d.name,
            version_number=d.version_number,
            status=d.status,
            currency=d.currency,
            timezone=d.timezone,
            row_counts=d.row_counts or {},
            accepted_rows=d.accepted_rows,
            quarantined_rows=d.quarantined_rows,
            is_synthetic=d.is_synthetic,
            created_at=d.created_at,
        )
        for d in datasets
    ]


@router.post("", response_model=DatasetResponse)
def create_dataset_draft(
    payload: CreateDatasetDraft,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """Create a new dataset version draft."""
    ws = get_or_create_default_workspace(db)
    count = db.execute(
        select(DatasetVersion).where(DatasetVersion.workspace_id == ws.id)
    ).scalars().all()

    ds = DatasetVersion(
        workspace_id=ws.id,
        name=payload.name,
        version_number=len(count) + 1,
        status="uploaded",
        currency=ws.currency,
        timezone=ws.timezone,
        row_counts={},
        accepted_rows=0,
        quarantined_rows=0,
        is_synthetic=False,
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)

    return DatasetResponse(
        id=ds.id,
        name=ds.name,
        version_number=ds.version_number,
        status=ds.status,
        currency=ds.currency,
        timezone=ds.timezone,
        row_counts=ds.row_counts or {},
        accepted_rows=ds.accepted_rows,
        quarantined_rows=ds.quarantined_rows,
        is_synthetic=ds.is_synthetic,
        created_at=ds.created_at,
    )


@router.post("/{dataset_id}/files")
async def upload_dataset_file(
    dataset_id: str,
    table_name: str = Form(...),  # customers, order_lines, offerings, engagement_events
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """Upload a CSV file for a specific table in the dataset draft."""
    ds = db.execute(select(DatasetVersion).where(DatasetVersion.id == dataset_id)).scalars().first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    if table_name not in ["customers", "order_lines", "offerings", "engagement_events"]:
        raise HTTPException(status_code=400, detail=f"Unsupported table name '{table_name}'.")

    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_MB}MB.")

    storage_path = storage.get_upload_path(dataset_id, f"{table_name}.csv")
    storage.save_bytes(storage_path, content)

    # Count rows
    try:
        df = pd.read_csv(storage_path)
        row_count = len(df)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {exc}")

    # Record or update in DB
    existing_file = db.execute(
        select(DBUploadFile).where(
            DBUploadFile.dataset_version_id == dataset_id,
            DBUploadFile.table_name == table_name,
        )
    ).scalars().first()

    if existing_file:
        existing_file.original_filename = file.filename or f"{table_name}.csv"
        existing_file.row_count = row_count
        existing_file.file_size_bytes = len(content)
        existing_file.storage_path = str(storage_path)
    else:
        db_file = DBUploadFile(
            dataset_version_id=dataset_id,
            table_name=table_name,
            original_filename=file.filename or f"{table_name}.csv",
            storage_path=str(storage_path),
            row_count=row_count,
            file_size_bytes=len(content),
            file_hash="",
        )
        db.add(db_file)

    row_counts = ds.row_counts or {}
    row_counts[table_name] = row_count
    ds.row_counts = row_counts

    db.commit()
    return {"message": f"Successfully uploaded {table_name}.csv", "row_count": row_count}


@router.get("/{dataset_id}/preview")
def preview_dataset_files(dataset_id: str, db: Session = Depends(get_db)):
    """Preview uploaded files with column names and first 10 rows."""
    files = db.execute(
        select(DBUploadFile).where(DBUploadFile.dataset_version_id == dataset_id)
    ).scalars().all()

    previews = {}
    for f in files:
        if os.path.exists(f.storage_path):
            try:
                df = pd.read_csv(f.storage_path, nrows=10)
                previews[f.table_name] = {
                    "columns": list(df.columns),
                    "rows": df.fillna("").to_dict(orient="records"),
                    "total_rows": f.row_count,
                }
            except Exception:
                pass
    return previews


@router.post("/{dataset_id}/validate", response_model=ValidationSummaryResponse)
def validate_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """Run validation engine on uploaded files and record issues."""
    ds = db.execute(select(DatasetVersion).where(DatasetVersion.id == dataset_id)).scalars().first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    files = db.execute(
        select(DBUploadFile).where(DBUploadFile.dataset_version_id == dataset_id)
    ).scalars().all()

    tables: dict[str, pd.DataFrame] = {}
    for f in files:
        if os.path.exists(f.storage_path):
            tables[f.table_name] = pd.read_csv(f.storage_path)

    report = validate_tables(tables)

    # Delete previous issues
    db.query(ValidationIssue).filter(ValidationIssue.dataset_version_id == dataset_id).delete()

    for issue in report.issues:
        db_issue = ValidationIssue(
            dataset_version_id=dataset_id,
            table_name=issue.table_name,
            row_index=issue.row_index,
            column_name=issue.column_name,
            severity=issue.severity,
            issue_code=issue.issue_code,
            message=issue.message,
            raw_value=issue.raw_value,
            proposed_resolution=issue.proposed_resolution,
            is_quarantined=issue.is_quarantined,
        )
        db.add(db_issue)

    ds.status = "failed" if report.has_fatal_errors else ("needs_review" if report.total_issues > 0 else "validated")
    ds.accepted_rows = sum(report.accepted_rows.values())
    ds.quarantined_rows = sum(report.quarantined_rows.values())
    db.commit()

    return ValidationSummaryResponse(
        is_valid=report.is_valid,
        has_fatal_errors=report.has_fatal_errors,
        total_issues=report.total_issues,
        accepted_rows=report.accepted_rows,
        quarantined_rows=report.quarantined_rows,
        issues=[issue.model_dump() for issue in report.issues[:100]],
    )


@router.post("/{dataset_id}/commit")
def commit_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """Confirm quarantines and commit dataset version for feature building."""
    ds = db.execute(select(DatasetVersion).where(DatasetVersion.id == dataset_id)).scalars().first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    if ds.status == "failed":
        raise HTTPException(status_code=400, detail="Cannot commit dataset with fatal errors.")

    ds.status = "validated"
    db.commit()
    return {"message": "Dataset committed successfully. Ready for feature engineering.", "status": ds.status}


@router.post("/{dataset_id}/features")
def trigger_feature_engineering(
    dataset_id: str,
    payload: FeatureBuildRequest,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """Build as-of customer features for the dataset snapshot."""
    ds = db.execute(select(DatasetVersion).where(DatasetVersion.id == dataset_id)).scalars().first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    files = db.execute(
        select(DBUploadFile).where(DBUploadFile.dataset_version_id == dataset_id)
    ).scalars().all()

    tables: dict[str, pd.DataFrame] = {}
    for f in files:
        if os.path.exists(f.storage_path):
            tables[f.table_name] = pd.read_csv(f.storage_path)

    if "customers" not in tables:
        raise HTTPException(status_code=400, detail="Cannot build features without customers table.")

    feat_result = build_features(tables, as_of_at=payload.as_of_at, lookback_days=payload.lookback_days)

    snapshot = FeatureSnapshot(
        workspace_id=ds.workspace_id,
        dataset_version_id=dataset_id,
        snapshot_name=f"Features as-of {payload.as_of_at.strftime('%Y-%m-%d')}",
        as_of_at=payload.as_of_at,
        lookback_start_at=feat_result.lookback_start_at,
        lookback_days=payload.lookback_days,
        config_json={"lookback_days": payload.lookback_days},
        population_counts=feat_result.population_counts,
        summary_stats=feat_result.summary_stats,
    )
    db.add(snapshot)
    db.flush()

    # Batch insert CustomerFeature records
    cust_feat_objs = []
    for rec in feat_result.records:
        cf = CustomerFeature(
            feature_snapshot_id=snapshot.id,
            customer_id=rec.customer_id,
            population_type=rec.population_type,
            recency_days=rec.recency_days,
            orders_lookback=rec.orders_lookback,
            net_sales_lookback=rec.net_sales_lookback,
            aov_lookback=rec.aov_lookback,
            tenure_days=rec.tenure_days,
            purchase_active_days=rec.purchase_active_days,
            discount_share=rec.discount_share,
            refund_share=rec.refund_share,
            category_shares_json=rec.category_shares,
            engagement_days=rec.engagement_days,
            channel_click_shares_json=rec.channel_click_shares,
            cart_events=rec.cart_events,
            feature_vector_json=rec.feature_vector,
        )
        cust_feat_objs.append(cf)

    db.bulk_save_objects(cust_feat_objs)
    ds.status = "features_ready"
    db.commit()

    return {
        "message": "Features built successfully.",
        "feature_snapshot_id": snapshot.id,
        "population_counts": feat_result.population_counts,
        "summary_stats": feat_result.summary_stats,
    }
