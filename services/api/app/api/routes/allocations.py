"""Model-based budget allocation endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.simulation import AllocationRun
from app.api.routes.workspace import get_or_create_default_workspace
from app.domain.optimization.engine import (
    AllocationCellInput,
    allocate_budget,
    AllocationResult,
)
from app.security.auth import require_mutation_access

router = APIRouter(prefix="/allocations", tags=["Allocations"])


class AllocationRequest(BaseModel):
    campaign_id: str | None = None
    total_budget: float = Field(ge=0)
    fixed_cost: float = Field(default=0.0, ge=0)
    shared_capacity_units: int | None = None
    cells: list[AllocationCellInput]


@router.get("")
def list_allocations(db: Session = Depends(get_db)):
    """List saved budget allocation runs."""
    ws = get_or_create_default_workspace(db)
    runs = db.execute(
        select(AllocationRun)
        .where(AllocationRun.workspace_id == ws.id)
        .order_by(AllocationRun.created_at.desc())
        .limit(20)
    ).scalars().all()
    return [
        {
            "id": r.id,
            "campaign_id": r.campaign_id,
            "total_budget": r.total_budget,
            "fixed_cost": r.fixed_cost,
            "method": r.method,
            "results": r.results_json,
            "created_at": r.created_at.isoformat(),
        }
        for r in runs
    ]


@router.post("", response_model=AllocationResult)
def run_budget_allocation(
    payload: AllocationRequest,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """
    Run constrained marginal budget allocation across deduplicated persona-channel audience cells.
    """
    ws = get_or_create_default_workspace(db)

    result = allocate_budget(
        cells=payload.cells,
        total_budget=payload.total_budget,
        fixed_cost=payload.fixed_cost,
        shared_capacity_units=payload.shared_capacity_units,
    )

    run = AllocationRun(
        workspace_id=ws.id,
        campaign_id=payload.campaign_id,
        total_budget=payload.total_budget,
        fixed_cost=payload.fixed_cost,
        method="marginal_contribution_saturation",
        cells_json=[c.model_dump() for c in payload.cells],
        results_json=result.model_dump(),
        is_synthetic=True,
    )
    db.add(run)
    db.commit()

    return result


@router.get("/{run_id}")
def get_allocation_run(run_id: str, db: Session = Depends(get_db)):
    """Retrieve saved budget allocation result."""
    run = db.execute(select(AllocationRun).where(AllocationRun.id == run_id)).scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Allocation run not found.")

    return {
        "id": run.id,
        "campaign_id": run.campaign_id,
        "total_budget": run.total_budget,
        "fixed_cost": run.fixed_cost,
        "method": run.method,
        "results": run.results_json,
        "created_at": run.created_at.isoformat(),
    }
