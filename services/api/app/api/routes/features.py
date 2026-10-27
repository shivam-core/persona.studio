"""Feature inspection and customer feature records endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models.features import FeatureSnapshot, CustomerFeature
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/features", tags=["Features"])


class FeatureSnapshotResponse(BaseModel):
    id: str
    dataset_version_id: str
    snapshot_name: str
    as_of_at: str
    lookback_start_at: str
    lookback_days: int
    population_counts: dict
    summary_stats: dict


class CustomerFeatureItem(BaseModel):
    customer_id: str
    population_type: str
    recency_days: float | None
    orders_lookback: int
    net_sales_lookback: float
    aov_lookback: float | None
    tenure_days: float | None
    purchase_active_days: int
    discount_share: float | None
    refund_share: float | None
    category_shares: dict
    engagement_days: int
    cart_events: int


@router.get("", response_model=list[FeatureSnapshotResponse])
def list_feature_snapshots(db: Session = Depends(get_db)):
    """List all feature snapshots in the workspace."""
    from app.api.routes.workspace import get_or_create_default_workspace
    ws = get_or_create_default_workspace(db)
    snaps = db.execute(
        select(FeatureSnapshot)
        .where(FeatureSnapshot.workspace_id == ws.id)
        .order_by(FeatureSnapshot.created_at.desc())
    ).scalars().all()
    return [
        FeatureSnapshotResponse(
            id=s.id,
            dataset_version_id=s.dataset_version_id,
            snapshot_name=s.snapshot_name,
            as_of_at=s.as_of_at.isoformat(),
            lookback_start_at=s.lookback_start_at.isoformat(),
            lookback_days=s.lookback_days,
            population_counts=s.population_counts or {},
            summary_stats=s.summary_stats or {},
        )
        for s in snaps
    ]


@router.get("/{snapshot_id}", response_model=FeatureSnapshotResponse)
def get_feature_snapshot(snapshot_id: str, db: Session = Depends(get_db)):
    """Retrieve metadata and population counts for a feature snapshot."""
    snap = db.execute(select(FeatureSnapshot).where(FeatureSnapshot.id == snapshot_id)).scalars().first()
    if not snap:
        raise HTTPException(status_code=404, detail="Feature snapshot not found.")

    return FeatureSnapshotResponse(
        id=snap.id,
        dataset_version_id=snap.dataset_version_id,
        snapshot_name=snap.snapshot_name,
        as_of_at=snap.as_of_at.isoformat(),
        lookback_start_at=snap.lookback_start_at.isoformat(),
        lookback_days=snap.lookback_days,
        population_counts=snap.population_counts or {},
        summary_stats=snap.summary_stats or {},
    )


@router.get("/{snapshot_id}/customers", response_model=PaginatedResponse[CustomerFeatureItem])
def list_feature_customers(
    snapshot_id: str,
    population_type: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieve paginated customer records with contributing feature values."""
    snap = db.execute(select(FeatureSnapshot).where(FeatureSnapshot.id == snapshot_id)).scalars().first()
    if not snap:
        raise HTTPException(status_code=404, detail="Feature snapshot not found.")

    query = select(CustomerFeature).where(CustomerFeature.feature_snapshot_id == snapshot_id)
    if population_type:
        query = query.where(CustomerFeature.population_type == population_type)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    query = query.offset((page - 1) * page_size).limit(page_size)
    items = db.execute(query).scalars().all()

    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        items=[
            CustomerFeatureItem(
                customer_id=f"CUST-***{c.customer_id[-4:]}" if len(c.customer_id) >= 6 else c.customer_id,
                population_type=c.population_type,
                recency_days=c.recency_days,
                orders_lookback=c.orders_lookback,
                net_sales_lookback=c.net_sales_lookback,
                aov_lookback=c.aov_lookback,
                tenure_days=c.tenure_days,
                purchase_active_days=c.purchase_active_days,
                discount_share=c.discount_share,
                refund_share=c.refund_share,
                category_shares=c.category_shares_json or {},
                engagement_days=c.engagement_days,
                cart_events=c.cart_events,
            )
            for c in items
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
