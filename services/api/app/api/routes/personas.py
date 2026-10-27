"""Persona cards, evidence metrics, and member inspection endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.persona import PersonaCard, EvidenceMetric
from app.db.models.segmentation import SegmentMembership
from app.db.models.features import CustomerFeature, FeatureSnapshot
from app.api.routes.workspace import get_or_create_default_workspace
from app.security.auth import require_mutation_access
from app.llm.gemini import generate_persona_wording
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/personas", tags=["Personas"])


class EvidenceMetricResponse(BaseModel):
    id: str
    metric_key: str
    display_label: str
    value: float | None
    unit: str
    aggregation: str
    valid_n: int
    population_n: int
    baseline_value: float | None
    numerator: float | None = None
    denominator: float | None = None
    source_columns: list[str]
    missing_fraction: float


class PersonaCardResponse(BaseModel):
    id: str
    segmentation_run_id: str
    segment_ordinal: int
    stable_segment_id: str
    display_name: str
    summary_text: str
    audience_count: int
    audience_share: float
    population_type: str
    color_hex: str
    behavioral_glyph: str
    evidence_coverage_badge: str
    claims: list[dict]
    hypotheses: list[dict]
    missing_evidence: list[str]
    fingerprint: dict
    is_synthetic: bool
    text_provenance: str
    created_at: str


class MaskedMemberItem(BaseModel):
    customer_id: str
    boundary_ambiguity: float | None
    orders_lookback: int
    net_sales_lookback: float
    recency_days: float | None
    aov_lookback: float | None


@router.get("", response_model=list[PersonaCardResponse])
def list_persona_cards(
    segmentation_run_id: str | None = None,
    latest_only: bool = True,
    db: Session = Depends(get_db),
):
    """List published persona cards in active workspace, scoped to the latest run by default."""
    ws = get_or_create_default_workspace(db)
    query = select(PersonaCard).where(PersonaCard.workspace_id == ws.id)

    if segmentation_run_id:
        query = query.where(PersonaCard.segmentation_run_id == segmentation_run_id)
    elif latest_only:
        latest_card = db.execute(
            select(PersonaCard)
            .where(PersonaCard.workspace_id == ws.id)
            .order_by(PersonaCard.created_at.desc())
        ).scalars().first()
        if latest_card:
            query = query.where(PersonaCard.segmentation_run_id == latest_card.segmentation_run_id)
        else:
            return []

    cards = db.execute(
        query.order_by(PersonaCard.segment_ordinal.asc())
    ).scalars().all()

    return [
        PersonaCardResponse(
            id=c.id,
            segmentation_run_id=c.segmentation_run_id,
            segment_ordinal=c.segment_ordinal,
            stable_segment_id=c.stable_segment_id,
            display_name=c.display_name,
            summary_text=c.summary_text,
            audience_count=c.audience_count,
            audience_share=c.audience_share,
            population_type=c.population_type,
            color_hex=c.color_hex,
            behavioral_glyph=c.behavioral_glyph,
            evidence_coverage_badge=c.evidence_coverage_badge,
            claims=c.claims_json or [],
            hypotheses=c.hypotheses_json or [],
            missing_evidence=c.missing_evidence_json or [],
            fingerprint=c.fingerprint_json or {},
            is_synthetic=c.is_synthetic,
            text_provenance=c.text_provenance,
            created_at=c.created_at.isoformat(),
        )
        for c in cards
    ]


@router.get("/{persona_id}", response_model=PersonaCardResponse)
def get_persona_card(persona_id: str, db: Session = Depends(get_db)):
    """Retrieve full detail for a persona card."""
    c = db.execute(select(PersonaCard).where(PersonaCard.id == persona_id)).scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Persona card not found.")

    return PersonaCardResponse(
        id=c.id,
        segmentation_run_id=c.segmentation_run_id,
        segment_ordinal=c.segment_ordinal,
        stable_segment_id=c.stable_segment_id,
        display_name=c.display_name,
        summary_text=c.summary_text,
        audience_count=c.audience_count,
        audience_share=c.audience_share,
        population_type=c.population_type,
        color_hex=c.color_hex,
        behavioral_glyph=c.behavioral_glyph,
        evidence_coverage_badge=c.evidence_coverage_badge,
        claims=c.claims_json or [],
        hypotheses=c.hypotheses_json or [],
        missing_evidence=c.missing_evidence_json or [],
        fingerprint=c.fingerprint_json or {},
        is_synthetic=c.is_synthetic,
        text_provenance=c.text_provenance,
        created_at=c.created_at.isoformat(),
    )


@router.get("/{persona_id}/evidence", response_model=list[EvidenceMetricResponse])
def get_persona_evidence(persona_id: str, db: Session = Depends(get_db)):
    """Retrieve grounded evidence metrics supporting this persona card."""
    metrics = db.execute(
        select(EvidenceMetric).where(EvidenceMetric.persona_card_id == persona_id)
    ).scalars().all()

    return [
        EvidenceMetricResponse(
            id=em.id,
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
            source_columns=em.source_columns_json or [],
            missing_fraction=em.missing_fraction,
        )
        for em in metrics
    ]


@router.get("/{persona_id}/members", response_model=PaginatedResponse[MaskedMemberItem])
def list_persona_members(
    persona_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieve paginated masked customers contributing to this persona card."""
    c = db.execute(select(PersonaCard).where(PersonaCard.id == persona_id)).scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Persona card not found.")

    mems_q = select(SegmentMembership).where(
        SegmentMembership.segmentation_run_id == c.segmentation_run_id,
        SegmentMembership.segment_ordinal == c.segment_ordinal,
    )

    total = db.scalar(select(func.count()).select_from(mems_q.subquery())) or 0
    mems = db.execute(mems_q.offset((page - 1) * page_size).limit(page_size)).scalars().all()

    cids = [m.customer_id for m in mems]
    # Get feature records
    features = db.execute(
        select(CustomerFeature).where(CustomerFeature.customer_id.in_(cids))
    ).scalars().all()
    feat_map = {f.customer_id: f for f in features}

    items = []
    for m in mems:
        f = feat_map.get(m.customer_id)
        masked_id = f"CUST-***{m.customer_id[-4:]}" if len(m.customer_id) >= 6 else m.customer_id
        items.append(MaskedMemberItem(
            customer_id=masked_id,
            boundary_ambiguity=m.boundary_ambiguity_score,
            orders_lookback=f.orders_lookback if f else 0,
            net_sales_lookback=f.net_sales_lookback if f else 0.0,
            recency_days=f.recency_days if f else None,
            aov_lookback=f.aov_lookback if f else None,
        ))

    total_pages = (total + page_size - 1) // page_size
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("/{persona_id}/wording")
def improve_wording_with_ai(
    persona_id: str,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """Optional action: generate grounded wording and test hypotheses using Gemini or template."""
    c = db.execute(select(PersonaCard).where(PersonaCard.id == persona_id)).scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Persona card not found.")

    metrics = db.execute(
        select(EvidenceMetric).where(EvidenceMetric.persona_card_id == persona_id)
    ).scalars().all()

    summary_dict = {em.metric_key: em.value for em in metrics}
    ev_ids = [em.id for em in metrics]

    wording_res = generate_persona_wording(summary_dict, ev_ids)

    c.display_name = wording_res.display_name
    c.summary_text = wording_res.summary_text
    c.claims_json = [c.model_dump() for c in wording_res.summary_claims]
    c.hypotheses_json = [h.model_dump() for h in wording_res.test_hypotheses]
    c.text_provenance = wording_res.provenance
    db.commit()

    return {
        "message": "Persona wording updated successfully.",
        "display_name": c.display_name,
        "summary_text": c.summary_text,
        "provenance": c.text_provenance,
        "hypotheses": c.hypotheses_json,
    }
