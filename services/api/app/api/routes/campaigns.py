"""Campaign planning, briefs, and offering fit endpoints."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import Offering, Campaign, PersonaCard, EvidenceMetric
from app.api.routes.workspace import get_or_create_default_workspace
from app.domain.matching.engine import score_offering_fit, OfferingFitResult
from app.security.auth import require_mutation_access

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


class CampaignResponse(BaseModel):
    id: str
    name: str
    objective: str
    offering_id: str | None
    audience_snapshot_id: str | None
    channel: str
    proposition: str
    offer_type: str
    discount_pct: float
    fixed_discount: float
    budget: float
    fixed_cost: float
    duration_days: int
    status: str
    brief: dict
    message_variants: list[dict]
    created_at: str
    updated_at: str


class CampaignCreate(BaseModel):
    name: str = "New Campaign Draft"
    objective: str = "acquisition"  # acquisition, retention, reactivation
    offering_id: str | None = None
    audience_snapshot_id: str | None = None
    channel: str = "email"
    proposition: str = ""
    offer_type: str = "none"  # none, percent_discount, fixed_discount
    discount_pct: float = Field(default=0.0, ge=0, le=100)
    fixed_discount: float = Field(default=0.0, ge=0)
    budget: float = Field(default=10000.0, ge=0)
    fixed_cost: float = Field(default=2000.0, ge=0)
    duration_days: int = Field(default=30, ge=1)
    brief: dict = Field(default_factory=dict)
    message_variants: list[dict] = Field(default_factory=list)


class CampaignUpdate(BaseModel):
    name: str | None = None
    objective: str | None = None
    offering_id: str | None = None
    audience_snapshot_id: str | None = None
    channel: str | None = None
    proposition: str | None = None
    offer_type: str | None = None
    discount_pct: float | None = None
    fixed_discount: float | None = None
    budget: float | None = None
    fixed_cost: float | None = None
    duration_days: int | None = None
    status: str | None = None
    brief: dict | None = None
    message_variants: list[dict] | None = None


@router.get("", response_model=list[CampaignResponse])
def list_campaigns(db: Session = Depends(get_db)):
    """List all campaigns in workspace."""
    ws = get_or_create_default_workspace(db)
    camps = db.execute(
        select(Campaign).where(Campaign.workspace_id == ws.id).order_by(Campaign.updated_at.desc())
    ).scalars().all()

    return [
        CampaignResponse(
            id=c.id,
            name=c.name,
            objective=c.objective,
            offering_id=c.offering_id,
            audience_snapshot_id=c.audience_snapshot_id,
            channel=c.channel,
            proposition=c.proposition,
            offer_type=c.offer_type,
            discount_pct=c.discount_pct,
            fixed_discount=c.fixed_discount,
            budget=c.budget,
            fixed_cost=c.fixed_cost,
            duration_days=c.duration_days,
            status=c.status,
            brief=c.brief_json or {},
            message_variants=c.message_variants_json or [],
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat(),
        )
        for c in camps
    ]


@router.post("", response_model=CampaignResponse)
def create_campaign(
    payload: CampaignCreate,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """Create a new campaign draft."""
    ws = get_or_create_default_workspace(db)

    camp = Campaign(
        workspace_id=ws.id,
        name=payload.name,
        objective=payload.objective,
        offering_id=payload.offering_id,
        audience_snapshot_id=payload.audience_snapshot_id,
        channel=payload.channel,
        proposition=payload.proposition,
        offer_type=payload.offer_type,
        discount_pct=payload.discount_pct,
        fixed_discount=payload.fixed_discount,
        budget=payload.budget,
        fixed_cost=payload.fixed_cost,
        duration_days=payload.duration_days,
        status="draft",
        brief_json=payload.brief or {},
        message_variants_json=payload.message_variants or [],
    )
    db.add(camp)
    db.commit()
    db.refresh(camp)

    return CampaignResponse(
        id=camp.id,
        name=camp.name,
        objective=camp.objective,
        offering_id=camp.offering_id,
        audience_snapshot_id=camp.audience_snapshot_id,
        channel=camp.channel,
        proposition=camp.proposition,
        offer_type=camp.offer_type,
        discount_pct=camp.discount_pct,
        fixed_discount=camp.fixed_discount,
        budget=camp.budget,
        fixed_cost=camp.fixed_cost,
        duration_days=camp.duration_days,
        status=camp.status,
        brief=camp.brief_json or {},
        message_variants=camp.message_variants_json or [],
        created_at=camp.created_at.isoformat(),
        updated_at=camp.updated_at.isoformat(),
    )


@router.get("/{campaign_id}", response_model=CampaignResponse)
def get_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Retrieve full campaign brief detail."""
    c = db.execute(select(Campaign).where(Campaign.id == campaign_id)).scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    return CampaignResponse(
        id=c.id,
        name=c.name,
        objective=c.objective,
        offering_id=c.offering_id,
        audience_snapshot_id=c.audience_snapshot_id,
        channel=c.channel,
        proposition=c.proposition,
        offer_type=c.offer_type,
        discount_pct=c.discount_pct,
        fixed_discount=c.fixed_discount,
        budget=c.budget,
        fixed_cost=c.fixed_cost,
        duration_days=c.duration_days,
        status=c.status,
        brief=c.brief_json or {},
        message_variants=c.message_variants_json or [],
        created_at=c.created_at.isoformat(),
        updated_at=c.updated_at.isoformat(),
    )


@router.patch("/{campaign_id}", response_model=CampaignResponse)
def update_campaign(
    campaign_id: str,
    payload: CampaignUpdate,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """Update campaign brief fields."""
    c = db.execute(select(Campaign).where(Campaign.id == campaign_id)).scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    if payload.name is not None:
        c.name = payload.name
    if payload.objective is not None:
        c.objective = payload.objective
    if payload.offering_id is not None:
        c.offering_id = payload.offering_id
    if payload.audience_snapshot_id is not None:
        c.audience_snapshot_id = payload.audience_snapshot_id
    if payload.channel is not None:
        c.channel = payload.channel
    if payload.proposition is not None:
        c.proposition = payload.proposition
    if payload.offer_type is not None:
        c.offer_type = payload.offer_type
    if payload.discount_pct is not None:
        c.discount_pct = payload.discount_pct
    if payload.fixed_discount is not None:
        c.fixed_discount = payload.fixed_discount
    if payload.budget is not None:
        c.budget = payload.budget
    if payload.fixed_cost is not None:
        c.fixed_cost = payload.fixed_cost
    if payload.duration_days is not None:
        c.duration_days = payload.duration_days
    if payload.status is not None:
        c.status = payload.status
    if payload.brief is not None:
        c.brief_json = payload.brief
    if payload.message_variants is not None:
        c.message_variants_json = payload.message_variants

    c.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(c)

    return CampaignResponse(
        id=c.id,
        name=c.name,
        objective=c.objective,
        offering_id=c.offering_id,
        audience_snapshot_id=c.audience_snapshot_id,
        channel=c.channel,
        proposition=c.proposition,
        offer_type=c.offer_type,
        discount_pct=c.discount_pct,
        fixed_discount=c.fixed_discount,
        budget=c.budget,
        fixed_cost=c.fixed_cost,
        duration_days=c.duration_days,
        status=c.status,
        brief=c.brief_json or {},
        message_variants=c.message_variants_json or [],
        created_at=c.created_at.isoformat(),
        updated_at=c.updated_at.isoformat(),
    )


@router.get("/offering-fit/{offering_id}", response_model=list[OfferingFitResult])
def get_offering_fit_across_personas(offering_id: str, db: Session = Depends(get_db)):
    """Evaluate explainable heuristic fit of an offering against all published persona cards."""
    ws = get_or_create_default_workspace(db)

    offering = db.execute(
        select(Offering).where(Offering.workspace_id == ws.id, Offering.offering_id == offering_id)
    ).scalars().first()

    if not offering:
        raise HTTPException(status_code=404, detail="Offering not found.")

    cards = db.execute(
        select(PersonaCard).where(PersonaCard.workspace_id == ws.id)
    ).scalars().all()

    results: list[OfferingFitResult] = []
    offering_dict = {
        "offering_id": offering.offering_id,
        "name": offering.name,
        "category": offering.category,
        "kind": offering.kind,
        "list_price": offering.list_price,
    }

    for c in cards:
        metrics = db.execute(
            select(EvidenceMetric).where(EvidenceMetric.persona_card_id == c.id)
        ).scalars().all()

        m_dict = {em.metric_key: em.value for em in metrics}
        m_dict["persona_id"] = c.id
        m_dict["category_shares"] = {offering.category.lower(): 0.35}  # representative share

        fit_res = score_offering_fit(m_dict, offering_dict)
        results.append(fit_res)

    return results
