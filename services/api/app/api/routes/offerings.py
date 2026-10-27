"""Offerings catalog endpoints."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Offering, Workspace
from app.api.routes.workspace import get_or_create_default_workspace
from app.security.auth import require_mutation_access

router = APIRouter(prefix="/offerings", tags=["Offerings"])


class OfferingResponse(BaseModel):
    id: str
    offering_id: str
    name: str
    category: str
    kind: str
    list_price: float
    unit_variable_cost: float | None = None
    fixed_campaign_cost_default: float = 0.0
    capacity_units: int | None = None
    billing_period_months: int = 1
    monthly_variable_cost: float | None = None
    description: str | None = None
    is_active: bool = True


class OfferingCreate(BaseModel):
    offering_id: str
    name: str
    category: str
    kind: str  # product, service, subscription
    list_price: float = Field(ge=0)
    unit_variable_cost: float | None = Field(default=None, ge=0)
    fixed_campaign_cost_default: float = Field(default=0.0, ge=0)
    capacity_units: int | None = Field(default=None, ge=0)
    billing_period_months: int = Field(default=1, ge=1)
    monthly_variable_cost: float | None = Field(default=None, ge=0)
    description: str | None = None


@router.get("", response_model=list[OfferingResponse])
def list_offerings(db: Session = Depends(get_db)):
    """List all offerings in active workspace."""
    ws = get_or_create_default_workspace(db)
    offerings = db.execute(
        select(Offering)
        .where(Offering.workspace_id == ws.id, Offering.is_active == True)
        .order_by(Offering.category.asc(), Offering.name.asc())
    ).scalars().all()

    return [
        OfferingResponse(
            id=o.id,
            offering_id=o.offering_id,
            name=o.name,
            category=o.category,
            kind=o.kind,
            list_price=o.list_price,
            unit_variable_cost=o.unit_variable_cost,
            fixed_campaign_cost_default=o.fixed_campaign_cost_default,
            capacity_units=o.capacity_units,
            billing_period_months=o.billing_period_months,
            monthly_variable_cost=o.monthly_variable_cost,
            description=o.description,
            is_active=o.is_active,
        )
        for o in offerings
    ]


@router.post("", response_model=OfferingResponse)
def create_offering(
    payload: OfferingCreate,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """Add a new product or service offering to catalog."""
    ws = get_or_create_default_workspace(db)

    # Check duplicate offering_id
    existing = db.execute(
        select(Offering).where(
            Offering.workspace_id == ws.id,
            Offering.offering_id == payload.offering_id,
        )
    ).scalars().first()

    if existing:
        raise HTTPException(status_code=400, detail=f"Offering ID '{payload.offering_id}' already exists.")

    offering = Offering(
        workspace_id=ws.id,
        dataset_version_id="",  # Global catalog item
        offering_id=payload.offering_id,
        name=payload.name,
        category=payload.category,
        kind=payload.kind.lower(),
        list_price=payload.list_price,
        unit_variable_cost=payload.unit_variable_cost,
        fixed_campaign_cost_default=payload.fixed_campaign_cost_default,
        capacity_units=payload.capacity_units,
        billing_period_months=payload.billing_period_months,
        monthly_variable_cost=payload.monthly_variable_cost,
        description=payload.description,
        is_active=True,
    )
    db.add(offering)
    db.commit()
    db.refresh(offering)

    return OfferingResponse(
        id=offering.id,
        offering_id=offering.offering_id,
        name=offering.name,
        category=offering.category,
        kind=offering.kind,
        list_price=offering.list_price,
        unit_variable_cost=offering.unit_variable_cost,
        fixed_campaign_cost_default=offering.fixed_campaign_cost_default,
        capacity_units=offering.capacity_units,
        billing_period_months=offering.billing_period_months,
        monthly_variable_cost=offering.monthly_variable_cost,
        description=offering.description,
        is_active=offering.is_active,
    )


@router.get("/{offering_id}", response_model=OfferingResponse)
def get_offering(offering_id: str, db: Session = Depends(get_db)):
    """Fetch an offering by id or offering_id."""
    ws = get_or_create_default_workspace(db)
    offering = db.execute(
        select(Offering).where(
            Offering.workspace_id == ws.id,
            (Offering.id == offering_id) | (Offering.offering_id == offering_id),
        )
    ).scalars().first()

    if not offering:
        raise HTTPException(status_code=404, detail="Offering not found.")

    return OfferingResponse(
        id=offering.id,
        offering_id=offering.offering_id,
        name=offering.name,
        category=offering.category,
        kind=offering.kind,
        list_price=offering.list_price,
        unit_variable_cost=offering.unit_variable_cost,
        fixed_campaign_cost_default=offering.fixed_campaign_cost_default,
        capacity_units=offering.capacity_units,
        billing_period_months=offering.billing_period_months,
        monthly_variable_cost=offering.monthly_variable_cost,
        description=offering.description,
        is_active=offering.is_active,
    )


@router.get("/{offering_id}/fit")
def get_offering_fit(offering_id: str, db: Session = Depends(get_db)):
    """Evaluate explainable heuristic fit of an offering against all published persona cards."""
    from app.db.models.persona import PersonaCard, EvidenceMetric
    from app.domain.matching.engine import score_offering_fit

    ws = get_or_create_default_workspace(db)

    offering = db.execute(
        select(Offering).where(
            Offering.workspace_id == ws.id,
            (Offering.id == offering_id) | (Offering.offering_id == offering_id),
        )
    ).scalars().first()

    if not offering:
        raise HTTPException(status_code=404, detail="Offering not found.")

    cards = db.execute(
        select(PersonaCard).where(PersonaCard.workspace_id == ws.id)
    ).scalars().all()

    results = []
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
        m_dict["category_shares"] = {offering.category.lower(): 0.35}

        fit_res = score_offering_fit(m_dict, offering_dict)
        components_map = {c.name.lower(): c.normalized_score for c in fit_res.components}
        results.append({
            "persona_card_id": c.id,
            "offering_id": offering.id,
            "fit_score": fit_res.fit_score or 0.0,
            "fit_label": fit_res.fit_label.replace(" Fit", ""),
            "breakdown": {
                "category_affinity": components_map.get("category affinity", 0.35),
                "spend_compatibility": components_map.get("spend compatibility", 0.50),
                "recency_engagement": components_map.get("engagement recency", 0.40),
                "category_activity": components_map.get("observed category engagement", 0.25),
            },
            "explanation": fit_res.reasoning,
        })

    return results

