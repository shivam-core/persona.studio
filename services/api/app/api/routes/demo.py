"""Synthetic demo seeding endpoint running the full empirical analytics pipeline."""

from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
import pandas as pd

from app.db.session import get_db
from app.db.models import (
    Workspace,
    DatasetVersion,
    UploadFile as DBUploadFile,
    Offering,
    Customer,
    OrderLine,
    EngagementEvent,
    FeatureSnapshot,
    CustomerFeature,
    SegmentationRun,
    SegmentMembership,
    PersonaCard,
    EvidenceMetric,
    Campaign,
)
from app.api.routes.workspace import get_or_create_default_workspace
from app.storage.adapter import storage
from app.domain.data.generator import generate_retail_demo_dataset, DEFAULT_AS_OF
from app.domain.validation.engine import validate_tables
from app.domain.features.engine import build_features
from app.domain.segmentation.engine import fit_candidates
from app.domain.evidence.engine import build_persona_evidence
from app.security.auth import require_mutation_access

router = APIRouter(prefix="/demo", tags=["Demo"])


@router.post("/seed")
def seed_synthetic_demo_pipeline(
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """
    Runs the complete connected analytics pipeline for synthetic demo:
    Generator -> Validation -> Ingestion -> Feature Building -> Segmentation -> Persona Publishing.
    """
    ws = get_or_create_default_workspace(db)
    ws.is_synthetic_demo = True

    # 1. Generate synthetic dataset
    dfs = generate_retail_demo_dataset(seed=42, as_of=DEFAULT_AS_OF)

    # 2. Validate tables through pure validation engine
    report = validate_tables(dfs, as_of_at=DEFAULT_AS_OF)

    # 3. Create DatasetVersion
    existing_ds = db.execute(
        select(DatasetVersion).where(
            DatasetVersion.workspace_id == ws.id,
            DatasetVersion.is_synthetic == True,
        )
    ).scalars().first()

    if existing_ds:
        ds = existing_ds
        ds.status = "features_ready"
    else:
        ds = DatasetVersion(
            workspace_id=ws.id,
            name="Indian Retail Synthetic Demo",
            version_number=1,
            status="features_ready",
            currency=ws.currency,
            timezone=ws.timezone,
            row_counts={tbl: len(df) for tbl, df in dfs.items()},
            accepted_rows=sum(len(df) for df in dfs.values()),
            quarantined_rows=0,
            purchase_history_complete=True,
            is_synthetic=True,
        )
        db.add(ds)
        db.flush()

    # Save CSVs to storage adapter
    for tbl, df in dfs.items():
        upload_path = storage.get_upload_path(ds.id, f"{tbl}.csv")
        df.to_csv(upload_path, index=False)

    # 4. Ingest Offerings if not present
    existing_offs = db.execute(select(Offering).where(Offering.workspace_id == ws.id)).scalars().all()
    if not existing_offs:
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
                billing_period_months=int(row["billing_period_months"]) if pd.notna(row.get("billing_period_months")) else 1,
                monthly_variable_cost=float(row["monthly_variable_cost"]) if pd.notna(row.get("monthly_variable_cost")) else None,
                description=str(row.get("description", "")),
                is_active=True,
            ))
        db.bulk_save_objects(off_objs)
        db.flush()

    # Ingest Customers if not present
    existing_cust_count = db.scalar(select(Customer.id).where(Customer.dataset_version_id == ds.id))
    if not existing_cust_count:
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
        db.flush()

    # 5. Build features through pure feature engineering engine
    feat_result = build_features(dfs, as_of_at=DEFAULT_AS_OF, lookback_days=180)

    # Check existing snapshot
    snap = db.execute(
        select(FeatureSnapshot).where(FeatureSnapshot.dataset_version_id == ds.id)
    ).scalars().first()

    if not snap:
        snap = FeatureSnapshot(
            workspace_id=ws.id,
            dataset_version_id=ds.id,
            snapshot_name="Retail Demo Features (180d Lookback)",
            as_of_at=DEFAULT_AS_OF,
            lookback_start_at=feat_result.lookback_start_at,
            lookback_days=180,
            config_json={"lookback_days": 180},
            population_counts=feat_result.population_counts,
            summary_stats=feat_result.summary_stats,
        )
        db.add(snap)
        db.flush()

        # Save customer features
        cf_objs = []
        for rec in feat_result.records:
            cf_objs.append(CustomerFeature(
                feature_snapshot_id=snap.id,
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
            ))
        db.bulk_save_objects(cf_objs)
        db.flush()

    # 6. Fit segmentation candidates on existing buyers
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

    comparison = fit_candidates(feat_df, population_type="existing_buyer", seed=42)

    # Save segmentation run
    seg_run = db.execute(
        select(SegmentationRun).where(SegmentationRun.feature_snapshot_id == snap.id)
    ).scalars().first()

    if not seg_run:
        seg_run = SegmentationRun(
            workspace_id=ws.id,
            feature_snapshot_id=snap.id,
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

        # Memberships
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

        # 7. Generate and Publish Persona Cards & Evidence
        bundle = build_persona_evidence(
            raw_features_df=feat_df,
            labels=comparison.labels,
            run_id=seg_run.id,
            snapshot_meta={
                "as_of_at": snap.as_of_at.isoformat(),
                "lookback_start_at": snap.lookback_start_at.isoformat(),
                "is_synthetic": True,
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
                    dataset_version_id=ds.id,
                    feature_snapshot_id=snap.id,
                    lookback_start_at=snap.lookback_start_at,
                    as_of_at=snap.as_of_at,
                    missing_fraction=em.missing_fraction,
                    is_synthetic=em.is_synthetic,
                )
                db.add(db_em)

    # 8. Pre-create Demo Campaign
    camp = db.execute(select(Campaign).where(Campaign.workspace_id == ws.id)).scalars().first()
    if not camp:
        first_card = db.execute(select(PersonaCard).where(PersonaCard.workspace_id == ws.id)).scalars().first()
        camp = Campaign(
            workspace_id=ws.id,
            name="Q4 Festive Collection Launch",
            objective="retention",
            offering_id="OFF-101",
            channel="email",
            proposition="Exclusive festive linen shirt collection for high-value repeat customers.",
            offer_type="percent_discount",
            discount_pct=15.0,
            fixed_discount=0.0,
            budget=25000.0,
            fixed_cost=5000.0,
            duration_days=30,
            status="planned",
            brief_json={"creative_focus": "Handcrafted Indian linen aesthetics"},
            message_variants_json=[
                {"variant": "A", "headline": "Early Access: The Festive Linen Series"},
                {"variant": "B", "headline": "Handcrafted Elegance: Special Member Privilege"},
            ],
        )
        db.add(camp)

    db.commit()

    return {
        "message": "Synthetic retail demo seeded successfully through the real analytics pipeline.",
        "dataset_version_id": ds.id,
        "feature_snapshot_id": snap.id,
        "segmentation_run_id": seg_run.id,
        "population_counts": feat_result.population_counts,
        "summary_stats": feat_result.summary_stats,
    }
