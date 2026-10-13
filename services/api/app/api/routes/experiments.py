"""Experiment design, stratified assignments, outcome imports, and ITT analysis."""

import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.experiment import (
    Experiment,
    ExperimentAssignment,
    ExperimentOutcome,
    ExperimentAnalysis as DBExperimentAnalysis,
)
from app.db.models.audience import AudienceSnapshot, AudienceMember
from app.api.routes.workspace import get_or_create_default_workspace
from app.domain.experiments.power import calculate_sample_size_and_power
from app.domain.experiments.engine import assign_experiment, analyze_experiment, ExperimentAnalysis
from app.security.auth import require_mutation_access

router = APIRouter(prefix="/experiments", tags=["Experiments"])


class CreateExperimentRequest(BaseModel):
    name: str = "Holdout Campaign Impact Test"
    campaign_id: str | None = None
    audience_snapshot_id: str
    offering_id: str | None = None
    seed: int = 42
    allocation_ratio: float = Field(default=0.5, ge=0.1, le=0.9)
    observation_window_days: int = Field(default=30, ge=7, le=90)
    baseline_conversion: float = Field(default=0.05, ge=0.001, le=0.9)
    mde_absolute: float = Field(default=0.02, ge=0.001, le=0.5)


class SimulateOutcomesRequest(BaseModel):
    mode: str = "positive"  # positive, zero, negative, incomplete
    true_lift_pp: float = 3.0
    actual_campaign_cost: float = 5000.0


@router.post("")
def register_experiment(
    payload: CreateExperimentRequest,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """
    Register randomized experiment design, compute power analysis, and freeze stratified assignments.
    """
    ws = get_or_create_default_workspace(db)

    aud = db.execute(select(AudienceSnapshot).where(AudienceSnapshot.id == payload.audience_snapshot_id)).scalars().first()
    if not aud:
        raise HTTPException(status_code=404, detail="Audience snapshot not found.")

    members = db.execute(
        select(AudienceMember).where(
            AudienceMember.audience_snapshot_id == payload.audience_snapshot_id,
            AudienceMember.is_eligible == True,
        )
    ).scalars().all()

    if not members:
        raise HTTPException(status_code=400, detail="No eligible members in audience snapshot.")

    aud_df = pd.DataFrame([{"customer_id": m.customer_id, "persona_id": m.persona_id} for m in members])

    # Power planning
    power = calculate_sample_size_and_power(
        baseline_conversion=payload.baseline_conversion,
        mde_absolute=payload.mde_absolute,
        allocation_ratio=payload.allocation_ratio,
        available_sample=len(members),
    )

    exp = Experiment(
        workspace_id=ws.id,
        campaign_id=payload.campaign_id,
        name=payload.name,
        audience_snapshot_id=payload.audience_snapshot_id,
        offering_id=payload.offering_id,
        status="registered",
        preregistration_json={
            "experiment_id": "",
            "baseline_conversion": payload.baseline_conversion,
            "mde_absolute": payload.mde_absolute,
            "observation_window_days": payload.observation_window_days,
            "allocation_ratio": payload.allocation_ratio,
        },
        power_analysis_json=power.model_dump(),
        seed=payload.seed,
        allocation_ratio=payload.allocation_ratio,
        observation_window_days=payload.observation_window_days,
        is_synthetic=True,
    )
    db.add(exp)
    db.flush()

    # Stratified assignment
    assignment_res = assign_experiment(
        audience_df=aud_df,
        experiment_id=exp.id,
        allocation_ratio=payload.allocation_ratio,
        seed=payload.seed,
    )

    # Save assignments
    db_assignments = [
        ExperimentAssignment(
            experiment_id=exp.id,
            customer_id=a.customer_id,
            stratum_persona_id=a.stratum_persona_id,
            arm=a.arm,
        )
        for a in assignment_res.assignments
    ]
    db.bulk_save_objects(db_assignments)

    prereg = exp.preregistration_json or {}
    prereg["experiment_id"] = exp.id
    exp.preregistration_json = prereg
    db.commit()

    return {
        "id": exp.id,
        "name": exp.name,
        "status": exp.status,
        "total_assigned": assignment_res.total_assigned,
        "treatment_count": assignment_res.treatment_count,
        "control_count": assignment_res.control_count,
        "power_analysis": power.model_dump(),
    }


@router.get("/{experiment_id}")
def get_experiment_details(experiment_id: str, db: Session = Depends(get_db)):
    """Retrieve experiment status, power analysis, and assignments summary."""
    exp = db.execute(select(Experiment).where(Experiment.id == experiment_id)).scalars().first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found.")

    assignments = db.execute(
        select(ExperimentAssignment).where(ExperimentAssignment.experiment_id == experiment_id)
    ).scalars().all()

    outcomes_count = db.scalar(
        select(ExperimentOutcome).where(ExperimentOutcome.experiment_id == experiment_id)
    )

    t_cnt = sum(1 for a in assignments if a.arm == "treatment")
    c_cnt = sum(1 for a in assignments if a.arm == "control")

    return {
        "id": exp.id,
        "name": exp.name,
        "status": exp.status,
        "audience_snapshot_id": exp.audience_snapshot_id,
        "offering_id": exp.offering_id,
        "total_assigned": len(assignments),
        "treatment_count": t_cnt,
        "control_count": c_cnt,
        "power_analysis": exp.power_analysis_json,
        "preregistration": exp.preregistration_json,
        "observation_window_days": exp.observation_window_days,
        "has_outcomes": outcomes_count is not None,
        "created_at": exp.created_at.isoformat(),
    }


@router.get("/{experiment_id}/assignments.csv")
def export_assignments_csv(experiment_id: str, db: Session = Depends(get_db)):
    """Export frozen customer assignments CSV for execution."""
    exp = db.execute(select(Experiment).where(Experiment.id == experiment_id)).scalars().first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found.")

    assignments = db.execute(
        select(ExperimentAssignment).where(ExperimentAssignment.experiment_id == experiment_id)
    ).scalars().all()

    rows = [
        {
            "experiment_id": exp.id,
            "customer_id": a.customer_id,
            "stratum_persona_id": a.stratum_persona_id,
            "arm": a.arm,
            "assigned_at": a.assigned_at.isoformat(),
        }
        for a in assignments
    ]
    df = pd.DataFrame(rows)
    stream = io.StringIO()
    df.to_csv(stream, index=False)

    return Response(
        content=stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=assignments_{experiment_id[:8]}.csv"},
    )


@router.post("/{experiment_id}/outcomes")
def simulate_experiment_outcomes(
    experiment_id: str,
    payload: SimulateOutcomesRequest,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """
    Generate synthetic customer-level outcomes to demonstrate causal analysis.
    Supports: positive, zero, negative, and incomplete outcome modes.
    """
    exp = db.execute(select(Experiment).where(Experiment.id == experiment_id)).scalars().first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found.")

    assignments = db.execute(
        select(ExperimentAssignment).where(ExperimentAssignment.experiment_id == experiment_id)
    ).scalars().all()

    # Clear previous outcomes
    db.query(ExperimentOutcome).filter(ExperimentOutcome.experiment_id == experiment_id).delete()

    rng = np.random.RandomState(exp.seed)
    base_p = float(exp.preregistration_json.get("baseline_conversion", 0.05))

    if payload.mode == "positive":
        t_p = base_p + (payload.true_lift_pp / 100.0)
    elif payload.mode == "negative":
        t_p = max(0.01, base_p - 0.02)
    else:  # zero or incomplete
        t_p = base_p

    obs_end = datetime.utcnow()
    outcomes_to_save = []

    # In incomplete mode: only report 60% of assigned customers
    limit_pct = 0.60 if payload.mode == "incomplete" else 1.0

    for a in assignments:
        if rng.random() > limit_pct:
            continue  # Outcome omitted

        p = t_p if a.arm == "treatment" else base_p
        converted = bool(rng.random() < p)

        rev = 1500.0 if converted else 0.0
        cost = 600.0 if converted else 0.0
        orders = 1 if converted else 0

        outcomes_to_save.append(ExperimentOutcome(
            experiment_id=exp.id,
            customer_id=a.customer_id,
            converted=converted,
            net_revenue=rev,
            variable_cost=cost,
            order_count=orders,
            observation_end_at=obs_end,
            outcome_complete=True,
        ))

    db.bulk_save_objects(outcomes_to_save)
    exp.status = "outcomes_imported"
    db.commit()

    return {
        "message": f"Successfully imported outcomes for {len(outcomes_to_save)} of {len(assignments)} assigned profiles.",
        "mode": payload.mode,
        "is_complete": len(outcomes_to_save) == len(assignments),
    }


@router.post("/{experiment_id}/analyze", response_model=ExperimentAnalysis)
def trigger_experiment_analysis(
    experiment_id: str,
    actual_campaign_cost: float = 5000.0,
    db: Session = Depends(get_db),
    _auth: bool = Depends(require_mutation_access),
):
    """
    Run intention-to-treat (ITT) analysis and stratified customer bootstrap CIs.
    """
    exp = db.execute(select(Experiment).where(Experiment.id == experiment_id)).scalars().first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found.")

    assignments = db.execute(
        select(ExperimentAssignment).where(ExperimentAssignment.experiment_id == experiment_id)
    ).scalars().all()

    outcomes = db.execute(
        select(ExperimentOutcome).where(ExperimentOutcome.experiment_id == experiment_id)
    ).scalars().all()

    assign_df = pd.DataFrame([{"customer_id": a.customer_id, "stratum_persona_id": a.stratum_persona_id, "arm": a.arm} for a in assignments])
    outcomes_df = pd.DataFrame([{
        "customer_id": o.customer_id,
        "converted": o.converted,
        "net_revenue": o.net_revenue,
        "variable_cost": o.variable_cost,
        "outcome_complete": o.outcome_complete,
    } for o in outcomes])

    analysis_res = analyze_experiment(
        assignments_df=assign_df,
        outcomes_df=outcomes_df,
        preregistration=exp.preregistration_json or {},
        actual_campaign_cost=actual_campaign_cost,
        seed=exp.seed,
    )

    # Persist in DB
    db_analysis = DBExperimentAnalysis(
        experiment_id=exp.id,
        method="stratified_bootstrap_itt",
        primary_metric=analysis_res.primary_metric,
        effect_estimates_json={
            "overall_treatment_rate": analysis_res.overall_treatment_rate,
            "overall_control_rate": analysis_res.overall_control_rate,
            "percentage_point_lift": analysis_res.percentage_point_lift,
            "relative_percent_uplift": analysis_res.relative_percent_uplift,
            "incremental_converters_at_test_scale": analysis_res.incremental_converters_at_test_scale,
            "incremental_contribution_profit": analysis_res.incremental_campaign_contribution_profit,
        },
        confidence_intervals_json=analysis_res.confidence_intervals,
        exploratory_strata_json=[s.model_dump() for s in analysis_res.exploratory_strata],
        balance_checks_json=analysis_res.balance_checks,
        diagnostics_json=analysis_res.diagnostics,
    )
    db.add(db_analysis)
    exp.status = "analyzed"
    db.commit()

    return analysis_res


@router.get("/{experiment_id}/analysis")
def get_experiment_analysis(experiment_id: str, db: Session = Depends(get_db)):
    """Retrieve saved experiment analysis and confidence intervals."""
    an = db.execute(
        select(DBExperimentAnalysis)
        .where(DBExperimentAnalysis.experiment_id == experiment_id)
        .order_by(DBExperimentAnalysis.created_at.desc())
    ).scalars().first()

    if not an:
        raise HTTPException(status_code=404, detail="Analysis not found for this experiment.")

    return {
        "id": an.id,
        "experiment_id": an.experiment_id,
        "method": an.method,
        "primary_metric": an.primary_metric,
        "effect_estimates": an.effect_estimates_json,
        "confidence_intervals": an.confidence_intervals_json,
        "exploratory_strata": an.exploratory_strata_json,
        "balance_checks": an.balance_checks_json,
        "diagnostics": an.diagnostics_json,
        "created_at": an.created_at.isoformat(),
    }
