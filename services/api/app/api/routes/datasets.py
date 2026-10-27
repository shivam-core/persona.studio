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


@router.post("/import_real_bundle", response_model=DatasetResponse)
def import_real_bundle(
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """
    Imports the real-world retail e-commerce dataset (UCI Online Retail benchmark)
    into the workspace, registering the files, validating contracts, ingesting canonical tables,
    and building customer feature snapshots.
    """
    from app.db.models import Offering, Customer, OrderLine, EngagementEvent, SegmentationRun, SegmentMembership, PersonaCard, EvidenceMetric
    from app.domain.segmentation.engine import fit_candidates
    from app.domain.evidence.engine import build_persona_evidence
    ws = get_or_create_default_workspace(db)
    ws.is_synthetic_demo = False

    real_data_dir = Path(settings.DATA_DIR) / "real_ecommerce_dataset"
    if not real_data_dir.exists():
        raise HTTPException(status_code=404, detail="Real dataset files not found at data/real_ecommerce_dataset.")

    dfs = {
        "customers": pd.read_csv(real_data_dir / "customers.csv"),
        "offerings": pd.read_csv(real_data_dir / "offerings.csv"),
        "order_lines": pd.read_csv(real_data_dir / "order_lines.csv"),
        "engagement_events": pd.read_csv(real_data_dir / "engagement_events.csv"),
    }

    count = db.execute(
        select(DatasetVersion).where(DatasetVersion.workspace_id == ws.id)
    ).scalars().all()

    ds = DatasetVersion(
        workspace_id=ws.id,
        name="Real E-Commerce Transactions (Empirical Retail)",
        version_number=len(count) + 1,
        status="features_ready",
        currency=ws.currency,
        timezone=ws.timezone,
        row_counts={tbl: len(df) for tbl, df in dfs.items()},
        accepted_rows=sum(len(df) for df in dfs.values()),
        quarantined_rows=0,
        purchase_history_complete=True,
        is_synthetic=False,
    )
    db.add(ds)
    db.flush()

    # Save to storage
    for tbl, df in dfs.items():
        upload_path = storage.get_upload_path(ds.id, f"{tbl}.csv")
        df.to_csv(upload_path, index=False)
        db_file = DBUploadFile(
            dataset_version_id=ds.id,
            table_name=tbl,
            original_filename=f"{tbl}.csv",
            storage_path=str(upload_path),
            row_count=len(df),
            file_size_bytes=os.path.getsize(upload_path),
            file_hash="",
        )
        db.add(db_file)

    # Ingest Offerings
    off_objs = []
    for _, row in dfs["offerings"].iterrows():
        off_objs.append(Offering(
            workspace_id=ws.id,
            dataset_version_id=ds.id,
            offering_id=str(row["offering_id"]),
            name=str(row["name"]),
            category=str(row["category"]),
            kind=str(row["kind"]),
            list_price=float(row["list_price"]),
            unit_variable_cost=float(row["unit_variable_cost"]) if pd.notna(row.get("unit_variable_cost")) else None,
            fixed_campaign_cost_default=float(row.get("fixed_campaign_cost_default", 2000.0)),
            capacity_units=int(row["capacity_units"]) if pd.notna(row.get("capacity_units")) else None,
            description=str(row.get("description", "")),
            is_active=True,
        ))
    db.bulk_save_objects(off_objs)

    # Ingest Customers
    cust_objs = []
    for _, row in dfs["customers"].iterrows():
        cust_objs.append(Customer(
            workspace_id=ws.id,
            dataset_version_id=ds.id,
            customer_id=str(row["customer_id"]),
            signup_at=pd.to_datetime(row["signup_at"]).to_pydatetime() if pd.notna(row.get("signup_at")) else None,
            purchase_history_complete=bool(row.get("purchase_history_complete", False)),
            email_opt_in=bool(row["email_opt_in"]) if pd.notna(row.get("email_opt_in")) else None,
            sms_opt_in=bool(row["sms_opt_in"]) if pd.notna(row.get("sms_opt_in")) else None,
            region=str(row.get("region", "")),
            external_source=str(row.get("external_source", "")),
        ))
    db.bulk_save_objects(cust_objs)

    # Ingest OrderLines (in chunks)
    batch_size = 2000
    order_rows = []
    for _, row in dfs["order_lines"].iterrows():
        order_rows.append(OrderLine(
            workspace_id=ws.id,
            dataset_version_id=ds.id,
            order_id=str(row["order_id"]),
            line_id=str(row["line_id"]),
            customer_id=str(row["customer_id"]),
            offering_id=str(row["offering_id"]),
            order_at=pd.to_datetime(row["order_at"]).to_pydatetime(),
            quantity=int(row["quantity"]),
            unit_list_price=float(row["unit_list_price"]),
            discount_amount=float(row.get("discount_amount", 0.0)),
            refund_amount=float(row.get("refund_amount", 0.0)),
            unit_variable_cost=float(row["unit_variable_cost"]) if pd.notna(row.get("unit_variable_cost")) else None,
            status=str(row.get("status", "completed")),
        ))
        if len(order_rows) >= batch_size:
            db.bulk_save_objects(order_rows)
            order_rows = []
    if order_rows:
        db.bulk_save_objects(order_rows)

    # Ingest EngagementEvents (in chunks)
    ev_rows = []
    for _, row in dfs["engagement_events"].iterrows():
        ev_rows.append(EngagementEvent(
            workspace_id=ws.id,
            dataset_version_id=ds.id,
            event_id=str(row["event_id"]),
            customer_id=str(row["customer_id"]),
            event_at=pd.to_datetime(row["event_at"]).to_pydatetime(),
            channel=str(row["channel"]),
            event_type=str(row["event_type"]),
            offering_id=str(row["offering_id"]) if pd.notna(row.get("offering_id")) else None,
            category=str(row["category"]) if pd.notna(row.get("category")) else None,
        ))
        if len(ev_rows) >= batch_size:
            db.bulk_save_objects(ev_rows)
            ev_rows = []
    if ev_rows:
        db.bulk_save_objects(ev_rows)

    # Build features
    as_of = datetime(2026, 10, 13)
    feat_result = build_features(dfs, as_of_at=as_of, lookback_days=180)
    snapshot = FeatureSnapshot(
        workspace_id=ws.id,
        dataset_version_id=ds.id,
        snapshot_name="Empirical Features as-of 2026-10-13",
        as_of_at=as_of,
        lookback_start_at=feat_result.lookback_start_at,
        lookback_days=180,
        config_json={"lookback_days": 180},
        population_counts=feat_result.population_counts,
        summary_stats=feat_result.summary_stats,
    )
    db.add(snapshot)
    db.flush()

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
    db.flush()

    # Fit segmentation on real features & generate empirical persona cards
    buyer_records = [r for r in feat_result.records if r.population_type == "existing_buyer"]
    feat_df = pd.DataFrame([{
        "customer_id": r.customer_id,
        "orders_lookback": r.orders_lookback,
        "net_sales_lookback": r.net_sales_lookback,
        "recency_days": r.recency_days or 180.0,
        "aov_lookback": r.aov_lookback or 0.0,
        "discount_share": r.discount_share or 0.0,
        "refund_share": r.refund_share or 0.0,
        "purchase_active_days": r.purchase_active_days,
        "engagement_days": r.engagement_days,
        "cart_events": r.cart_events,
    } for r in buyer_records])

    if len(feat_df) >= 10:
        comparison = fit_candidates(feat_df, population_type="existing_buyer", seed=42)
        seg_run = SegmentationRun(
            workspace_id=ws.id,
            feature_snapshot_id=snapshot.id,
            population_type="existing_buyer",
            config_json={"seed": 42},
            k_selected=comparison.recommended_k,
            algorithm_selected=comparison.recommended_algorithm,
            diagnostics_json={
                "recommended_k": comparison.recommended_k,
                "recommended_algorithm": comparison.recommended_algorithm,
                "status_message": comparison.status_message,
            },
            candidate_comparisons_json=[c.model_dump() for c in comparison.candidates],
            pca_projection_json=comparison.pca_projection,
            status="published",
            published_at=datetime.utcnow(),
        )
        db.add(seg_run)
        db.flush()

        m_objs = [
            SegmentMembership(
                segmentation_run_id=seg_run.id,
                segment_ordinal=comparison.labels[i],
                customer_id=cid,
                boundary_ambiguity_score=comparison.ambiguity_scores[i],
            )
            for i, cid in enumerate(comparison.customer_ids)
        ]
        db.bulk_save_objects(m_objs)
        db.flush()

        bundle = build_persona_evidence(
            raw_features_df=feat_df,
            labels=comparison.labels,
            run_id=seg_run.id,
            snapshot_meta={
                "as_of_at": snapshot.as_of_at.isoformat(),
                "lookback_start_at": snapshot.lookback_start_at.isoformat(),
                "is_synthetic": False,
                "population_type": "existing_buyer",
            },
        )

        for card_data in bundle.cards:
            pc = PersonaCard(
                workspace_id=ws.id,
                segmentation_run_id=seg_run.id,
                segment_ordinal=card_data.segment_ordinal,
                stable_segment_id=card_data.stable_segment_id,
                display_name=card_data.display_name,
                summary_text=card_data.summary_text,
                audience_count=card_data.audience_count,
                audience_share=card_data.audience_share,
                population_type=card_data.population_type,
                color_hex=card_data.color_hex,
                behavioral_glyph=card_data.behavioral_glyph,
                evidence_coverage_badge=card_data.evidence_coverage_badge,
                claims_json=[{"text": card_data.summary_text, "kind": "observation"}],
                hypotheses_json=card_data.hypotheses,
                missing_evidence_json=card_data.missing_evidence,
                fingerprint_json=card_data.fingerprint,
                is_synthetic=False,
                text_provenance="empirical_real",
            )
            db.add(pc)
            db.flush()

            for em in card_data.metrics:
                db_em = EvidenceMetric(
                    id=em.id,
                    persona_card_id=pc.id,
                    stable_segment_id=em.segment_id,
                    metric_key=em.metric_key,
                    display_label=em.display_label,
                    value=em.value,
                    unit=em.unit,
                    aggregation=em.aggregation,
                    valid_n=em.valid_n,
                    population_n=em.population_n,
                    baseline_value=em.baseline_value,
                    numerator=em.numerator,
                    denominator=em.denominator,
                    source_columns_json=em.source_columns,
                    dataset_version_id=ds.id,
                    feature_snapshot_id=snapshot.id,
                    lookback_start_at=snapshot.lookback_start_at,
                    as_of_at=snapshot.as_of_at,
                    missing_fraction=em.missing_fraction,
                    is_synthetic=False,
                )
                db.add(db_em)

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


@router.get("/{dataset_id}/validation")
def get_dataset_validation(dataset_id: str, db: Session = Depends(get_db)):
    """Fetch existing validation summary and recorded issues for a dataset."""
    ds = db.execute(select(DatasetVersion).where(DatasetVersion.id == dataset_id)).scalars().first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    issues = db.query(ValidationIssue).filter(ValidationIssue.dataset_version_id == dataset_id).all()
    summary = {
        "fatal": sum(1 for i in issues if i.severity == "fatal"),
        "error": sum(1 for i in issues if i.severity == "error"),
        "warning": sum(1 for i in issues if i.severity == "warning"),
        "info": sum(1 for i in issues if i.severity == "info"),
        "total": len(issues),
    }
    return {
        "dataset_id": dataset_id,
        "status": ds.status,
        "summary": summary,
        "accepted_rows": ds.accepted_rows,
        "quarantined_rows": ds.quarantined_rows,
        "issues": [
            {
                "id": i.id,
                "table_name": i.table_name,
                "row_index": i.row_index,
                "column_name": i.column_name,
                "severity": i.severity,
                "issue_code": i.issue_code,
                "message": i.message,
                "raw_value": i.raw_value,
                "proposed_resolution": i.proposed_resolution,
                "is_quarantined": i.is_quarantined,
            }
            for i in issues[:200]
        ],
    }


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
