"""Segmentation runs, candidate comparisons, and publishing flow."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
import pandas as pd

from app.db.session import get_db
from app.db.models.segmentation import SegmentationRun, SegmentMembership
from app.db.models.features import FeatureSnapshot, CustomerFeature
from app.db.models.persona import PersonaCard, EvidenceMetric
from app.domain.segmentation.engine import fit_candidates
from app.domain.evidence.engine import build_persona_evidence
from app.security.auth import require_mutation_access

router = APIRouter(prefix="/segmentations", tags=["Segmentations"])


class FitSegmentationRequest(BaseModel):
    feature_snapshot_id: str | None = None
    dataset_id: str | None = None
    population_type: str = "existing_buyer"
    seed: int = 42


class PublishSegmentationRequest(BaseModel):
    k_selected: int | None = None
    algorithm_selected: str | None = None  # kmeans, gmm, rule_based_cohorts
    candidate_id: str | None = None


@router.post("")
def create_segmentation_run(
    payload: FitSegmentationRequest,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """Fit candidate segmentation models on features and generate diagnostics."""
    snapshot = None
    if payload.feature_snapshot_id:
        snapshot = db.execute(
            select(FeatureSnapshot).where(FeatureSnapshot.id == payload.feature_snapshot_id)
        ).scalars().first()
        if not snapshot:
            # Check if feature_snapshot_id was actually a dataset_version_id
            snapshot = db.execute(
                select(FeatureSnapshot)
                .where(FeatureSnapshot.dataset_version_id == payload.feature_snapshot_id)
                .order_by(FeatureSnapshot.created_at.desc())
            ).scalars().first()

    if not snapshot and payload.dataset_id:
        snapshot = db.execute(
            select(FeatureSnapshot)
            .where(FeatureSnapshot.dataset_version_id == payload.dataset_id)
            .order_by(FeatureSnapshot.created_at.desc())
        ).scalars().first()

    if not snapshot:
        # Fallback to latest feature snapshot in workspace
        snapshot = db.execute(
            select(FeatureSnapshot).order_by(FeatureSnapshot.created_at.desc())
        ).scalars().first()

    if not snapshot:
        raise HTTPException(status_code=404, detail="No feature snapshot found. Please build features first in Data Hub.")

    cust_features = db.execute(
        select(CustomerFeature).where(
            CustomerFeature.feature_snapshot_id == snapshot.id,
            CustomerFeature.population_type == payload.population_type,
        )
    ).scalars().all()

    if len(cust_features) < 10:
        raise HTTPException(status_code=400, detail="Insufficient customer profiles to cluster.")

    # Convert to DataFrame
    rows = []
    for cf in cust_features:
        r = {"customer_id": cf.customer_id}
        if cf.feature_vector_json:
            r.update(cf.feature_vector_json)
        else:
            r.update({
                "orders_lookback": cf.orders_lookback,
                "net_sales_lookback": cf.net_sales_lookback,
                "recency_days": cf.recency_days or 180.0,
                "aov_lookback": cf.aov_lookback or 0.0,
            })
        rows.append(r)

    df_feats = pd.DataFrame(rows)

    comparison = fit_candidates(
        feature_records_df=df_feats,
        population_type=payload.population_type,
        seed=payload.seed,
    )

    seg_run = SegmentationRun(
        workspace_id=snapshot.workspace_id,
        feature_snapshot_id=snapshot.id,
        population_type=payload.population_type,
        config_json={"seed": payload.seed},
        k_selected=comparison.recommended_k,
        algorithm_selected=comparison.recommended_algorithm,
        diagnostics_json={
            "recommended_k": comparison.recommended_k,
            "recommended_algorithm": comparison.recommended_algorithm,
            "status_message": comparison.status_message,
        },
        candidate_comparisons_json=[c.model_dump() for c in comparison.candidates],
        pca_projection_json=comparison.pca_projection,
        status="candidate_ready",
    )
    db.add(seg_run)
    db.flush()

    # Save initial memberships
    mem_objs = []
    for idx, cid in enumerate(comparison.customer_ids):
        mem = SegmentMembership(
            segmentation_run_id=seg_run.id,
            segment_ordinal=comparison.labels[idx],
            customer_id=cid,
            boundary_ambiguity_score=comparison.ambiguity_scores[idx],
        )
        mem_objs.append(mem)

    db.bulk_save_objects(mem_objs)
    db.commit()

    return {
        "id": seg_run.id,
        "workspace_id": seg_run.workspace_id,
        "feature_snapshot_id": seg_run.feature_snapshot_id,
        "population_type": seg_run.population_type,
        "status": "completed",
        "recommended_k": comparison.recommended_k,
        "recommended_algorithm": comparison.recommended_algorithm,
        "candidates": [c.model_dump() for c in comparison.candidates],
        "candidate_comparisons": [c.model_dump() for c in comparison.candidates],
        "pca_projection": comparison.pca_projection,
        "status_message": comparison.status_message,
        "created_at": seg_run.created_at.isoformat() if seg_run.created_at else None,
    }


@router.get("")
def list_segmentation_runs(db: Session = Depends(get_db)):
    """List all segmentation runs."""
    runs = db.execute(
        select(SegmentationRun).order_by(SegmentationRun.created_at.desc())
    ).scalars().all()
    results = []
    for run in runs:
        results.append({
            "id": run.id,
            "workspace_id": run.workspace_id,
            "feature_snapshot_id": run.feature_snapshot_id,
            "population_type": run.population_type,
            "status": "completed" if run.status in ("candidate_ready", "published") else run.status,
            "k_selected": run.k_selected,
            "algorithm_selected": run.algorithm_selected,
            "diagnostics": run.diagnostics_json,
            "candidates": run.candidate_comparisons_json or [],
            "candidate_comparisons": run.candidate_comparisons_json or [],
            "pca_projection": run.pca_projection_json,
            "published_at": run.published_at.isoformat() if run.published_at else None,
            "created_at": run.created_at.isoformat() if run.created_at else None,
        })
    return results


@router.get("/{run_id}")
def get_segmentation_run(run_id: str, db: Session = Depends(get_db)):
    """Retrieve diagnostics, candidate models, and PCA scatter for a segmentation run."""
    run = db.execute(select(SegmentationRun).where(SegmentationRun.id == run_id)).scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Segmentation run not found.")

    return {
        "id": run.id,
        "workspace_id": run.workspace_id,
        "feature_snapshot_id": run.feature_snapshot_id,
        "population_type": run.population_type,
        "status": "completed" if run.status in ("candidate_ready", "published") else run.status,
        "k_selected": run.k_selected,
        "algorithm_selected": run.algorithm_selected,
        "diagnostics": run.diagnostics_json,
        "candidates": run.candidate_comparisons_json or [],
        "candidate_comparisons": run.candidate_comparisons_json or [],
        "pca_projection": run.pca_projection_json,
        "published_at": run.published_at.isoformat() if run.published_at else None,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


@router.post("/{run_id}/publish")
def publish_segmentation_candidate(
    run_id: str,
    payload: PublishSegmentationRequest,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """
    Freeze chosen candidate model, materialize immutable EvidenceMetrics, and create PersonaCards.
    """
    run = db.execute(select(SegmentationRun).where(SegmentationRun.id == run_id)).scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Segmentation run not found.")

    snapshot = db.execute(select(FeatureSnapshot).where(FeatureSnapshot.id == run.feature_snapshot_id)).scalars().first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Feature snapshot not found.")

    cust_features = db.execute(
        select(CustomerFeature).where(
            CustomerFeature.feature_snapshot_id == run.feature_snapshot_id,
            CustomerFeature.population_type == run.population_type,
        )
    ).scalars().all()

    # Get customer memberships
    memberships = db.execute(
        select(SegmentMembership).where(SegmentMembership.segmentation_run_id == run_id)
    ).scalars().all()
    cust_labels_map = {m.customer_id: m.segment_ordinal for m in memberships}

    raw_rows = []
    labels = []
    for cf in cust_features:
        if cf.customer_id in cust_labels_map:
            raw_rows.append({
                "customer_id": cf.customer_id,
                "orders_lookback": cf.orders_lookback,
                "net_sales_lookback": cf.net_sales_lookback,
                "recency_days": cf.recency_days,
                "aov_lookback": cf.aov_lookback,
                "discount_share": cf.discount_share,
                "refund_share": cf.refund_share,
            })
            labels.append(cust_labels_map[cf.customer_id])

    df_raw = pd.DataFrame(raw_rows)

    # Compute Evidence Bundle
    bundle = build_persona_evidence(
        raw_features_df=df_raw,
        labels=labels,
        run_id=run.id,
        snapshot_meta={
            "as_of_at": snapshot.as_of_at.isoformat(),
            "lookback_start_at": snapshot.lookback_start_at.isoformat(),
            "is_synthetic": True,
            "population_type": run.population_type,
        },
    )

    # Delete previous cards for this run if any
    prev_cards = db.execute(select(PersonaCard).where(PersonaCard.segmentation_run_id == run_id)).scalars().all()
    for pc in prev_cards:
        db.delete(pc)
    db.flush()

    # Save PersonaCards and EvidenceMetrics
    created_cards = []
    for card_data in bundle.cards:
        pc = PersonaCard(
            workspace_id=run.workspace_id,
            segmentation_run_id=run.id,
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
            is_synthetic=True,
            text_provenance="template",
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
                dataset_version_id=snapshot.dataset_version_id,
                feature_snapshot_id=snapshot.id,
                lookback_start_at=snapshot.lookback_start_at,
                as_of_at=snapshot.as_of_at,
                missing_fraction=em.missing_fraction,
                is_synthetic=em.is_synthetic,
            )
            db.add(db_em)

        created_cards.append({
            "id": pc.id,
            "display_name": pc.display_name,
            "audience_count": pc.audience_count,
            "audience_share": pc.audience_share,
            "color_hex": pc.color_hex,
        })

    run.status = "published"
    run.published_at = datetime.utcnow()
    chosen_k = payload.k_selected
    chosen_alg = payload.algorithm_selected
    if payload.candidate_id and run.candidate_comparisons_json:
        for c in run.candidate_comparisons_json:
            if c.get("id") == payload.candidate_id or str(c.get("n_clusters")) == str(payload.candidate_id):
                chosen_k = c.get("n_clusters")
                chosen_alg = c.get("algorithm")
                break
    run.k_selected = chosen_k or run.k_selected or 2
    run.algorithm_selected = chosen_alg or run.algorithm_selected or "kmeans"
    db.commit()

    return {
        "status": "success",
        "persona_card_count": len(created_cards),
        "message": f"Successfully published {len(created_cards)} persona cards.",
        "published_cards": created_cards,
    }
