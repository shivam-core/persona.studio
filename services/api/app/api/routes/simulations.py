"""Campaign economics simulator and Monte Carlo uncertainty endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.simulation import SimulationRun
from app.api.routes.workspace import get_or_create_default_workspace
from app.domain.simulation.engine import SimulationInputs, simulate_expected, SimulationResult
from app.domain.simulation.monte_carlo import simulate_uncertainty, UncertaintyResult
from app.security.auth import require_mutation_access

router = APIRouter(prefix="/simulations", tags=["Simulations"])


class SaveSimulationRequest(BaseModel):
    campaign_id: str | None = None
    scenario_name: str = "base"  # conservative, base, optimistic, custom
    inputs: SimulationInputs
    run_monte_carlo: bool = True
    draws: int = 1000


@router.post("/preview", response_model=SimulationResult)
def preview_simulation_economics(payload: SimulationInputs):
    """
    Lightweight, instant (<500ms) deterministic economics calculation.
    Computes exact profit waterfall, campaign CAC or repeat cost, and ROAS.
    """
    try:
        return simulate_expected(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("")
def save_simulation_scenario(
    payload: SaveSimulationRequest,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """
    Save economic scenario snapshot and execute 1,000-draw Monte Carlo uncertainty analysis.
    """
    ws = get_or_create_default_workspace(db)

    try:
        expected = simulate_expected(payload.inputs)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    uncertainty_dict = None
    if payload.run_monte_carlo:
        uncertainty_res = simulate_uncertainty(payload.inputs, seed=42, draws=payload.draws)
        uncertainty_dict = uncertainty_res.model_dump()

    run = SimulationRun(
        workspace_id=ws.id,
        campaign_id=payload.campaign_id,
        scenario_name=payload.scenario_name,
        delivery_model=payload.inputs.delivery_model,
        inputs_json=payload.inputs.model_dump(),
        expected_outputs_json=expected.model_dump(),
        uncertainty_outputs_json=uncertainty_dict,
        is_synthetic=True,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    return {
        "id": run.id,
        "scenario_name": run.scenario_name,
        "delivery_model": run.delivery_model,
        "expected": expected.model_dump(),
        "uncertainty": uncertainty_dict,
        "created_at": run.created_at.isoformat(),
    }


@router.get("/{run_id}")
def get_simulation_run(run_id: str, db: Session = Depends(get_db)):
    """Retrieve saved simulation snapshot and Monte Carlo uncertainty metrics."""
    run = db.execute(select(SimulationRun).where(SimulationRun.id == run_id)).scalars().first()
    if not run:
        raise HTTPException(status_code=404, detail="Simulation run not found.")

    return {
        "id": run.id,
        "campaign_id": run.campaign_id,
        "scenario_name": run.scenario_name,
        "delivery_model": run.delivery_model,
        "inputs": run.inputs_json,
        "expected": run.expected_outputs_json,
        "uncertainty": run.uncertainty_outputs_json,
        "created_at": run.created_at.isoformat(),
    }
