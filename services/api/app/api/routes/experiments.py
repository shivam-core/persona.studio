"""Experiment design, stratified assignments, outcome imports, and ITT analysis."""

import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
import numpy as np
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
    audience_snapshot_id: str | None = None
    persona_ids: list[str] | None = None
    offering_id: str | None = None
    seed: int = 42
    allocation_ratio: float = Field(default=0.5, ge=0.1, le=0.9)
    observation_window_days: int = Field(default=30, ge=7, le=90)
    baseline_conversion: float = Field(default=0.05, ge=0.001, le=0.9)
    mde_absolute: float | None = None
    target_mde: float | None = None
    primary_metric: str | None = None
    alpha: float | None = None
    target_power: float | None = None


class SimulateOutcomesRequest(BaseModel):
    mode: str = "positive"  # positive, zero, negative, incomplete
    effect_type: str | None = None
    true_lift_pp: float = 3.0
    actual_campaign_cost: float = 5000.0


@router.get("")
def list_experiments(db: Session = Depends(get_db)):
    """List all registered experiments."""
    ws = get_or_create_default_workspace(db)
    exps = db.execute(
        select(Experiment)
        .where(Experiment.workspace_id == ws.id)
        .order_by(Experiment.created_at.desc())
    ).scalars().all()

    results = []
    for exp in exps:
        assignments = db.execute(
            select(ExperimentAssignment).where(ExperimentAssignment.experiment_id == exp.id)
        ).scalars().all()
        t_cnt = sum(1 for a in assignments if a.arm == "treatment")
        c_cnt = sum(1 for a in assignments if a.arm == "control")
        results.append({
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
            "created_at": exp.created_at.isoformat(),
        })
    return results


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

    aud = None
    if payload.audience_snapshot_id:
        aud = db.execute(select(AudienceSnapshot).where(AudienceSnapshot.id == payload.audience_snapshot_id)).scalars().first()
    
    if not aud:
        aud = db.execute(
            select(AudienceSnapshot).where(AudienceSnapshot.workspace_id == ws.id).order_by(AudienceSnapshot.created_at.desc())
        ).scalars().first()

    if not aud:
        from app.db.models.canonical import Customer
        from app.db.models.features import FeatureSnapshot
        feat_snap = db.execute(select(FeatureSnapshot).where(FeatureSnapshot.workspace_id == ws.id).order_by(FeatureSnapshot.created_at.desc())).scalars().first()
        feat_id = feat_snap.id if feat_snap else "default"

        customers = db.execute(select(Customer.customer_id).where(Customer.workspace_id == ws.id).limit(1000)).scalars().all()
        if not customers:
            customers = [f"cust_{i:04d}" for i in range(500)]

        p_ids = payload.persona_ids or ["default_persona"]
        aud = AudienceSnapshot(
            workspace_id=ws.id,
            feature_snapshot_id=feat_id,
            name=f"Audience for {payload.name}",
            selected_persona_ids_json=p_ids,
            total_members=len(customers),
            consent_eligible=len(customers),
            evidence_eligible=len(customers),
            objective_eligible=len(customers),
            final_planned_count=len(customers),
            exclusions_summary_json={"no_opt_in": 0, "unreachable": 0},
        )
        db.add(aud)
        db.flush()

        new_members = [
            AudienceMember(
                audience_snapshot_id=aud.id,
                customer_id=cid,
                persona_id=p_ids[i % len(p_ids)],
                population_type="existing_buyer",
                channel_cell="default",
                is_eligible=True,
            )
            for i, cid in enumerate(customers)
        ]
        db.bulk_save_objects(new_members)
        db.flush()

    members = db.execute(
        select(AudienceMember).where(
            AudienceMember.audience_snapshot_id == aud.id,
            AudienceMember.is_eligible == True,
        )
    ).scalars().all()

    if not members:
        all_m = db.execute(select(AudienceMember).where(AudienceMember.audience_snapshot_id == aud.id)).scalars().all()
        for m in all_m:
            m.is_eligible = True
        db.flush()
        members = all_m

    aud_df = pd.DataFrame([{"customer_id": m.customer_id, "persona_id": m.persona_id} for m in members])

    # Power planning
    mde_val = payload.target_mde or payload.mde_absolute or 0.02
    power = calculate_sample_size_and_power(
        baseline_conversion=payload.baseline_conversion,
        mde_absolute=mde_val,
        allocation_ratio=payload.allocation_ratio,
        available_sample=len(members),
    )

    exp = Experiment(
        workspace_id=ws.id,
        campaign_id=payload.campaign_id,
        name=payload.name,
        audience_snapshot_id=aud.id,
        offering_id=payload.offering_id,
        status="registered",
        preregistration_json={
            "experiment_id": "",
            "baseline_conversion": payload.baseline_conversion,
            "mde_absolute": mde_val,
            "observation_window_days": payload.observation_window_days,
            "allocation_ratio": payload.allocation_ratio,
            "primary_metric": payload.primary_metric or "conversion_rate",
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
    db.flush()

    # Automatically seed initial positive lift scenario so test is immediately usable
    rng = np.random.RandomState(exp.seed)
    base_p = float(payload.baseline_conversion)
    lift_p = base_p + (mde_val or 0.025)
    obs_end = datetime.utcnow()
    initial_outcomes = []
    for a in assignment_res.assignments:
        p = lift_p if a.arm == "treatment" else base_p
        converted = bool(rng.random() < p)
        rev = 1500.0 if converted else 0.0
        cost = 600.0 if converted else 0.0
        initial_outcomes.append(ExperimentOutcome(
            experiment_id=exp.id,
            customer_id=a.customer_id,
            converted=converted,
            net_revenue=rev,
            variable_cost=cost,
            order_count=1 if converted else 0,
            observation_end_at=obs_end,
            outcome_complete=True,
        ))
    db.bulk_save_objects(initial_outcomes)
    db.flush()

    # Pre-compute baseline analysis
    assign_df = pd.DataFrame([{"customer_id": a.customer_id, "stratum_persona_id": a.stratum_persona_id, "arm": a.arm} for a in assignment_res.assignments])
    outcomes_df = pd.DataFrame([{
        "customer_id": o.customer_id,
        "converted": o.converted,
        "net_revenue": o.net_revenue,
        "variable_cost": o.variable_cost,
        "outcome_complete": o.outcome_complete,
    } for o in initial_outcomes])

    analysis_res = analyze_experiment(
        assignments_df=assign_df,
        outcomes_df=outcomes_df,
        preregistration=exp.preregistration_json or {},
        actual_campaign_cost=5000.0,
        seed=exp.seed,
    )
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

    mode = payload.effect_type or payload.mode
    if mode == "positive":
        t_p = base_p + (payload.true_lift_pp / 100.0)
    elif mode == "negative":
        t_p = max(0.01, base_p - 0.02)
    else:  # zero or incomplete
        t_p = base_p

    obs_end = datetime.utcnow()
    outcomes_to_save = []

    # In incomplete mode: only report 60% of assigned customers
    limit_pct = 0.60 if mode == "incomplete" else 1.0

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
    db.flush()

    # Automatically compute and persist fresh analysis immediately
    assign_df = pd.DataFrame([{"customer_id": a.customer_id, "stratum_persona_id": a.stratum_persona_id, "arm": a.arm} for a in assignments])
    outcomes_df = pd.DataFrame([{
        "customer_id": o.customer_id,
        "converted": o.converted,
        "net_revenue": o.net_revenue,
        "variable_cost": o.variable_cost,
        "outcome_complete": o.outcome_complete,
    } for o in outcomes_to_save])

    analysis_res = analyze_experiment(
        assignments_df=assign_df,
        outcomes_df=outcomes_df,
        preregistration=exp.preregistration_json or {},
        actual_campaign_cost=payload.actual_campaign_cost,
        seed=exp.seed,
    )

    db.query(DBExperimentAnalysis).filter(DBExperimentAnalysis.experiment_id == exp.id).delete()
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

    return {
        "status": "success",
        "outcome_count": len(outcomes_to_save),
        "message": f"Successfully recorded {mode} scenario with {len(outcomes_to_save)} customer outcomes. Lift analysis recalculated.",
        "mode": mode,
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

    # Persist in DB (clear prior analysis to prevent stale duplicates)
    db.query(DBExperimentAnalysis).filter(DBExperimentAnalysis.experiment_id == exp.id).delete()
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

    exp = db.execute(select(Experiment).where(Experiment.id == experiment_id)).scalars().first()
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found.")

    assignments = db.execute(
        select(ExperimentAssignment).where(ExperimentAssignment.experiment_id == experiment_id)
    ).scalars().all()

    # If no analysis yet, try on-the-fly computation if outcomes exist
    if not an:
        outcomes = db.execute(select(ExperimentOutcome).where(ExperimentOutcome.experiment_id == experiment_id)).scalars().all()
        if assignments and outcomes:
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
                seed=exp.seed,
            )
            an = DBExperimentAnalysis(
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
            db.add(an)
            db.commit()

    if not an:
        t_assigned = sum(1 for a in assignments if a.arm == "treatment")
        c_assigned = sum(1 for a in assignments if a.arm == "control")
        return {
            "id": f"pending_{experiment_id}",
            "experiment_id": experiment_id,
            "method": "stratified_bootstrap_itt",
            "primary_metric": "conversion_rate",
            "is_complete": False,
            "assigned_total": len(assignments),
            "treatment_assigned": t_assigned,
            "control_assigned": c_assigned,
            "treatment_converters": 0,
            "control_converters": 0,
            "treatment_rate": 0.0,
            "control_rate": 0.0,
            "absolute_lift_pp": 0.0,
            "percentage_point_lift": 0.0,
            "relative_uplift_pct": None,
            "ci_lower_pp": 0.0,
            "ci_upper_pp": 0.0,
            "p_value": None,
            "is_statistically_significant": False,
            "conclusion_text": "Test registered. Select an evaluation scenario above to measure incremental lift.",
            "incremental_purchasers": 0.0,
            "incremental_net_contribution": 0.0,
            "incremental_cac": None,
            "strata_breakdown": [],
            "effect_estimates": {},
            "confidence_intervals": {},
            "exploratory_strata": [],
            "balance_checks": {},
            "diagnostics": {"status": "awaiting_outcomes"},
            "created_at": datetime.utcnow().isoformat(),
        }

    eff = an.effect_estimates_json or {}
    cis = an.confidence_intervals_json or {}
    diag = an.diagnostics_json or {}

    lift_ci = cis.get("lift_percentage_points_ci_95") or [0.0, 0.0]
    if isinstance(lift_ci, (list, tuple)) and len(lift_ci) >= 2 and lift_ci[0] is not None and lift_ci[1] is not None:
        c0 = float(lift_ci[0])
        c1 = float(lift_ci[1])
        ci_low = round(c0 * 100, 2) if abs(c0) < 1.0 else round(c0, 2)
        ci_up = round(c1 * 100, 2) if abs(c1) < 1.0 else round(c1, 2)
    else:
        ci_low = 0.0
        ci_up = 0.0

    t_rate = eff.get("overall_treatment_rate", 0.0)
    c_rate = eff.get("overall_control_rate", 0.0)
    lift_pp = eff.get("percentage_point_lift", 0.0)
    rel_up = eff.get("relative_percent_uplift")
    p_val = cis.get("p_value", 0.05)
    is_sig = (ci_low > 0 and ci_up > 0) or (ci_low < 0 and ci_up < 0)

    assignments = db.execute(
        select(ExperimentAssignment).where(ExperimentAssignment.experiment_id == experiment_id)
    ).scalars().all()
    t_assigned = sum(1 for a in assignments if a.arm == "treatment")
    c_assigned = sum(1 for a in assignments if a.arm == "control")

    outcomes = db.execute(
        select(ExperimentOutcome).where(ExperimentOutcome.experiment_id == experiment_id)
    ).scalars().all()
    outcome_map = {o.customer_id: o for o in outcomes}
    t_conv = sum(1 for a in assignments if a.arm == "treatment" and outcome_map.get(a.customer_id) and outcome_map[a.customer_id].converted)
    c_conv = sum(1 for a in assignments if a.arm == "control" and outcome_map.get(a.customer_id) and outcome_map[a.customer_id].converted)

    strata_list = []
    for s in an.exploratory_strata_json or []:
        strata_list.append({
            "stratum_name": s.get("stratum_id", "Stratum"),
            "treatment_n": s.get("assigned_treatment", 0),
            "control_n": s.get("assigned_control", 0),
            "treatment_rate": s.get("rate_treatment", 0.0),
            "control_rate": s.get("rate_control", 0.0),
            "lift_pp": s.get("percentage_point_lift", 0.0),
        })

    conclusion = diag.get("verdict_message") or (
        f"Statistically significant lift: {lift_pp:+.2f} pp" if is_sig else "Evidence is inconclusive at the 95% confidence level."
    )

    return {
        "id": an.id,
        "experiment_id": an.experiment_id,
        "method": an.method,
        "primary_metric": an.primary_metric,
        "is_complete": True,
        "assigned_total": len(assignments),
        "treatment_assigned": t_assigned,
        "control_assigned": c_assigned,
        "treatment_converters": t_conv,
        "control_converters": c_conv,
        "treatment_rate": t_rate,
        "control_rate": c_rate,
        "absolute_lift_pp": lift_pp,
        "percentage_point_lift": lift_pp,
        "relative_uplift_pct": rel_up,
        "ci_lower_pp": ci_low,
        "ci_upper_pp": ci_up,
        "p_value": p_val,
        "is_statistically_significant": is_sig,
        "conclusion_text": conclusion,
        "incremental_purchasers": eff.get("incremental_converters_at_test_scale", 0.0),
        "incremental_net_contribution": eff.get("incremental_contribution_profit", 0.0),
        "incremental_cac": None,
        "strata_breakdown": strata_list,
        "effect_estimates": eff,
        "confidence_intervals": cis,
        "exploratory_strata": an.exploratory_strata_json,
        "balance_checks": an.balance_checks_json,
        "diagnostics": an.diagnostics_json,
        "created_at": an.created_at.isoformat(),
    }
