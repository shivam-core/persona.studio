"""Audience snapshot freezing and consent filtering."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import AudienceSnapshot, AudienceMember, PersonaCard, SegmentMembership, Customer, Workspace
from app.security.auth import require_mutation_access

router = APIRouter(prefix="/audiences", tags=["Audiences"])


class CreateAudienceRequest(BaseModel):
    name: str = "Campaign Target Audience"
    selected_persona_ids: list[str]
    feature_snapshot_id: str
    channel: str = "email"  # email, sms, direct, search, social


class AudienceSnapshotResponse(BaseModel):
    id: str
    name: str
    feature_snapshot_id: str
    selected_persona_ids: list[str]
    total_members: int
    evidence_eligible: int
    objective_eligible: int
    consent_eligible: int
    excluded_count: int
    final_planned_count: int
    exclusions_summary: dict
    created_at: str


@router.post("", response_model=AudienceSnapshotResponse)
def create_audience_snapshot(
    payload: CreateAudienceRequest,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """
    Freeze deduplicated campaign audience as-of feature snapshot and apply consent policies.
    """
    ws = get_or_create_default_workspace(db)

    # Fetch selected cards
    cards = db.execute(
        select(PersonaCard).where(PersonaCard.id.in_(payload.selected_persona_ids))
    ).scalars().all()

    if not cards:
        raise HTTPException(status_code=400, detail="No valid persona cards selected.")

    # Find customer memberships for selected cards
    seg_run_ids = {c.segmentation_run_id for c in cards}
    mems = db.execute(
        select(SegmentMembership).where(SegmentMembership.segmentation_run_id.in_(seg_run_ids))
    ).scalars().all()

    card_ord_map = {(c.segmentation_run_id, c.segment_ordinal): c for c in cards}

    # Deduplicate customers across selected cards
    selected_cids: dict[str, tuple[str, str]] = {}  # cid -> (persona_id, pop_type)
    for m in mems:
        key = (m.segmentation_run_id, m.segment_ordinal)
        if key in card_ord_map and m.customer_id not in selected_cids:
            card = card_ord_map[key]
            selected_cids[m.customer_id] = (card.id, card.population_type)

    total_count = len(selected_cids)

    # Fetch customer consent records
    cust_records = db.execute(
        select(Customer).where(Customer.customer_id.in_(list(selected_cids.keys())))
    ).scalars().all()
    cust_map = {c.customer_id: c for c in cust_records}

    members_to_save = []
    consent_eligible = 0
    excluded_count = 0
    exclusions_summary = {"no_opt_in": 0, "unreachable": 0}

    snapshot = AudienceSnapshot(
        workspace_id=ws.id,
        feature_snapshot_id=payload.feature_snapshot_id,
        name=payload.name,
        selected_persona_ids_json=payload.selected_persona_ids,
        total_members=total_count,
        evidence_eligible=total_count,
        objective_eligible=total_count,
    )
    db.add(snapshot)
    db.flush()

    for cid, (p_id, p_type) in selected_cids.items():
        cust = cust_map.get(cid)
        is_eligible = True
        ex_reason = None

        if payload.channel == "email":
            if not cust or cust.email_opt_in is not True:
                is_eligible = False
                ex_reason = "Missing explicit email opt-in"
                exclusions_summary["no_opt_in"] += 1
        elif payload.channel == "sms":
            if not cust or cust.sms_opt_in is not True:
                is_eligible = False
                ex_reason = "Missing explicit SMS opt-in"
                exclusions_summary["no_opt_in"] += 1

        if is_eligible:
            consent_eligible += 1
        else:
            excluded_count += 1

        members_to_save.append(AudienceMember(
            audience_snapshot_id=snapshot.id,
            customer_id=cid,
            persona_id=p_id,
            population_type=p_type,
            channel_cell=payload.channel,
            is_eligible=is_eligible,
            exclusion_reason=ex_reason,
        ))

    db.bulk_save_objects(members_to_save)

    snapshot.consent_eligible = consent_eligible
    snapshot.excluded_count = excluded_count
    snapshot.final_planned_count = consent_eligible
    snapshot.exclusions_summary_json = exclusions_summary
    db.commit()

    return AudienceSnapshotResponse(
        id=snapshot.id,
        name=snapshot.name,
        feature_snapshot_id=snapshot.feature_snapshot_id,
        selected_persona_ids=snapshot.selected_persona_ids_json,
        total_members=snapshot.total_members,
        evidence_eligible=snapshot.evidence_eligible,
        objective_eligible=snapshot.objective_eligible,
        consent_eligible=snapshot.consent_eligible,
        excluded_count=snapshot.excluded_count,
        final_planned_count=snapshot.final_planned_count,
        exclusions_summary=snapshot.exclusions_summary_json,
        created_at=snapshot.created_at.isoformat(),
    )


@router.get("/{snapshot_id}", response_model=AudienceSnapshotResponse)
def get_audience_snapshot(snapshot_id: str, db: Session = Depends(get_db)):
    """Fetch audience snapshot summary and exclusions."""
    s = db.execute(select(AudienceSnapshot).where(AudienceSnapshot.id == snapshot_id)).scalars().first()
    if not s:
        raise HTTPException(status_code=404, detail="Audience snapshot not found.")

    return AudienceSnapshotResponse(
        id=s.id,
        name=s.name,
        feature_snapshot_id=s.feature_snapshot_id,
        selected_persona_ids=s.selected_persona_ids_json or [],
        total_members=s.total_members,
        evidence_eligible=s.evidence_eligible,
        objective_eligible=s.objective_eligible,
        consent_eligible=s.consent_eligible,
        excluded_count=s.excluded_count,
        final_planned_count=s.final_planned_count,
        exclusions_summary=s.exclusions_summary_json or {},
        created_at=s.created_at.isoformat(),
    )
