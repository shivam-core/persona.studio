"""Experiment randomized assignment and intention-to-treat impact analysis."""

from datetime import datetime
from typing import Any
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

from app.domain.experiments.power import calculate_sample_size_and_power, PowerAnalysisResult
from app.domain.experiments.bootstrap import compute_stratified_bootstrap, BootstrapConfidenceIntervals


class AssignmentItem(BaseModel):
    customer_id: str
    stratum_persona_id: str
    arm: str  # treatment, control


class AssignmentResult(BaseModel):
    experiment_id: str
    seed: int
    allocation_ratio: float
    total_assigned: int
    treatment_count: int
    control_count: int
    strata_counts: dict[str, dict[str, int]]
    assignments: list[AssignmentItem]


class StrataAnalysisItem(BaseModel):
    stratum_id: str
    assigned_treatment: int
    assigned_control: int
    converters_treatment: int
    converters_control: int
    rate_treatment: float
    rate_control: float
    percentage_point_lift: float


class ExperimentAnalysis(BaseModel):
    experiment_id: str
    is_complete: bool
    assigned_total: int
    outcomes_reported: int
    missing_outcomes: int
    primary_metric: str
    headline_causal_claim_allowed: bool
    overall_treatment_rate: float | None = None
    treatment_rate: float | None = None
    overall_control_rate: float | None = None
    control_rate: float | None = None
    percentage_point_lift: float | None = None
    absolute_lift_pp: float | None = None
    relative_percent_uplift: float | None = None
    relative_uplift_pct: float | None = None
    incremental_converters_at_test_scale: float | None = None
    incremental_purchasers: float | None = None
    incremental_contribution_before_marketing: float | None = None
    actual_campaign_cost: float = 0.0
    incremental_campaign_contribution_profit: float | None = None
    incremental_net_contribution: float | None = None
    confidence_intervals: dict[str, Any] = Field(default_factory=dict)
    ci_lower_pp: float = 0.0
    ci_upper_pp: float = 0.0
    p_value: float | None = None
    is_statistically_significant: bool = False
    verdict_message: str = ""
    conclusion_text: str = ""
    treatment_assigned: int = 0
    control_assigned: int = 0
    treatment_converters: int = 0
    control_converters: int = 0
    incremental_cac: float | None = None
    strata_breakdown: list[dict] = Field(default_factory=list)
    exploratory_strata: list[StrataAnalysisItem] = Field(default_factory=list)
    balance_checks: dict[str, Any] = Field(default_factory=dict)
    diagnostics: dict[str, Any] = Field(default_factory=dict)


def assign_experiment(
    audience_df: pd.DataFrame,
    experiment_id: str,
    allocation_ratio: float = 0.5,
    seed: int = 42,
) -> AssignmentResult:
    """
    Stratified randomized assignment within each persona stratum using seeded permutation.
    """
    rng = np.random.RandomState(seed)
    assignments: list[AssignmentItem] = []
    strata_counts: dict[str, dict[str, int]] = {}

    t_total = 0
    c_total = 0

    strata = audience_df["persona_id"].unique()

    for s in strata:
        s_df = audience_df[audience_df["persona_id"] == s].copy()
        cids = s_df["customer_id"].tolist()
        rng.shuffle(cids)

        n_s = len(cids)
        n_t = int(round(n_s * allocation_ratio))
        t_cids = set(cids[:n_t])

        strata_counts[str(s)] = {"treatment": n_t, "control": n_s - n_t, "total": n_s}

        for cid in cids:
            arm = "treatment" if cid in t_cids else "control"
            if arm == "treatment":
                t_total += 1
            else:
                c_total += 1
            assignments.append(AssignmentItem(
                customer_id=str(cid),
                stratum_persona_id=str(s),
                arm=arm,
            ))

    return AssignmentResult(
        experiment_id=experiment_id,
        seed=seed,
        allocation_ratio=allocation_ratio,
        total_assigned=len(assignments),
        treatment_count=t_total,
        control_count=c_total,
        strata_counts=strata_counts,
        assignments=assignments,
    )


def analyze_experiment(
    assignments_df: pd.DataFrame,
    outcomes_df: pd.DataFrame,
    preregistration: dict[str, Any],
    actual_campaign_cost: float = 0.0,
    seed: int = 42,
) -> ExperimentAnalysis:
    """
    Pure ITT impact analyzer with outcome completeness validation and stratified bootstrap CIs.
    """
    exp_id = str(preregistration.get("experiment_id", ""))
    total_assigned = len(assignments_df) if assignments_df is not None else 0

    if total_assigned == 0:
        return ExperimentAnalysis(
            experiment_id=exp_id,
            is_complete=False,
            assigned_total=0,
            outcomes_reported=0,
            missing_outcomes=0,
            primary_metric="conversion_rate",
            headline_causal_claim_allowed=False,
            actual_campaign_cost=actual_campaign_cost,
            verdict_message="No customer profiles assigned to this test yet.",
            diagnostics={"outcome_completeness_pct": 0.0, "missing_outcomes_count": 0},
        )

    # Ensure required assignment columns exist
    req_assign_cols = ["customer_id", "stratum_persona_id", "arm"]
    clean_assignments = assignments_df.copy() if assignments_df is not None and not assignments_df.empty else pd.DataFrame(columns=req_assign_cols)
    for col in req_assign_cols:
        if col not in clean_assignments.columns:
            clean_assignments[col] = "default" if col == "stratum_persona_id" else "control"

    # Ensure required outcome columns exist even if outcomes_df is empty
    req_outcome_cols = ["customer_id", "converted", "net_revenue", "variable_cost", "outcome_complete"]
    if outcomes_df is None or outcomes_df.empty:
        clean_outcomes = pd.DataFrame(columns=req_outcome_cols)
    else:
        clean_outcomes = outcomes_df.copy()
        for col in req_outcome_cols:
            if col not in clean_outcomes.columns:
                clean_outcomes[col] = np.nan

    # Merge on customer_id; arm comes strictly from stored assignments_df!
    merged = pd.merge(
        clean_assignments[req_assign_cols],
        clean_outcomes[req_outcome_cols],
        on="customer_id",
        how="left",
    )

    outcomes_reported = int(merged["converted"].notna().sum())
    missing_outcomes = total_assigned - outcomes_reported
    is_complete = (missing_outcomes == 0 and outcomes_reported > 0) and bool(merged["outcome_complete"].fillna(False).all())

    # If incomplete or no outcomes recorded yet, suppress headline causal claim
    if not is_complete:
        verdict = (
            "No outcome records imported yet. Record test evaluation scenarios or import conversion logs to calculate lift."
            if outcomes_reported == 0
            else f"Observation window incomplete: {missing_outcomes} of {total_assigned} assigned customers lack finalized outcome records. Headline causal claims suppressed until complete."
        )
        return ExperimentAnalysis(
            experiment_id=exp_id,
            is_complete=False,
            assigned_total=total_assigned,
            outcomes_reported=outcomes_reported,
            missing_outcomes=missing_outcomes,
            primary_metric="conversion_rate",
            headline_causal_claim_allowed=False,
            actual_campaign_cost=actual_campaign_cost,
            verdict_message=verdict,
            conclusion_text=verdict,
            diagnostics={
                "outcome_completeness_pct": round(outcomes_reported / total_assigned * 100, 1) if total_assigned > 0 else 0.0,
                "missing_outcomes_count": missing_outcomes,
            },
        )

    # Complete outcomes: Run ITT analysis
    merged["conv_bool"] = merged["converted"].astype(bool)
    merged["revenue_clean"] = merged["net_revenue"].fillna(0.0).astype(float)
    merged["cost_clean"] = merged["variable_cost"].fillna(0.0).astype(float)
    merged["contrib_clean"] = merged["revenue_clean"] - merged["cost_clean"]

    strata = merged["stratum_persona_id"].unique()
    strata_items: list[StrataAnalysisItem] = []

    overall_delta = 0.0
    overall_control = 0.0
    incr_conv_total = 0.0
    incr_contrib_total = 0.0

    for s in strata:
        s_df = merged[merged["stratum_persona_id"] == s]
        all_s = len(s_df)
        w_s = all_s / total_assigned

        t_df = s_df[s_df["arm"] == "treatment"]
        c_df = s_df[s_df["arm"] == "control"]

        t_n = len(t_df)
        c_n = len(c_df)

        t_conv = int(t_df["conv_bool"].sum()) if t_n > 0 else 0
        c_conv = int(c_df["conv_bool"].sum()) if c_n > 0 else 0

        rate_t = t_conv / t_n if t_n > 0 else 0.0
        rate_c = c_conv / c_n if c_n > 0 else 0.0
        diff_s = rate_t - rate_c

        overall_delta += w_s * diff_s
        overall_control += w_s * rate_c
        incr_conv_total += t_n * diff_s

        mean_contrib_t = float(t_df["contrib_clean"].mean()) if t_n > 0 else 0.0
        mean_contrib_c = float(c_df["contrib_clean"].mean()) if c_n > 0 else 0.0
        incr_contrib_total += t_n * (mean_contrib_t - mean_contrib_c)

        strata_items.append(StrataAnalysisItem(
            stratum_id=str(s),
            assigned_treatment=t_n,
            assigned_control=c_n,
            converters_treatment=t_conv,
            converters_control=c_conv,
            rate_treatment=round(rate_t, 4),
            rate_control=round(rate_c, 4),
            percentage_point_lift=round(diff_s * 100, 2),
        ))

    rel_uplift = (overall_delta / overall_control) if overall_control > 0 else None
    incr_profit = incr_contrib_total - actual_campaign_cost

    # Run stratified bootstrap for 95% CIs
    ci_res: BootstrapConfidenceIntervals = compute_stratified_bootstrap(
        data_df=merged,
        stratum_col="stratum_persona_id",
        arm_col="arm",
        converted_col="conv_bool",
        revenue_col="revenue_clean",
        cost_col="cost_clean",
        actual_campaign_cost=actual_campaign_cost,
        seed=seed,
        resamples=2000,
    )

    is_sig = (ci_res.lift_pp_ci[0] > 0 and ci_res.lift_pp_ci[1] > 0) or (ci_res.lift_pp_ci[0] < 0 and ci_res.lift_pp_ci[1] < 0)

    if is_sig and overall_delta > 0:
        verdict = f"Statistically significant positive impact: +{overall_delta*100:.2f} percentage points lift (95% CI: [{ci_res.lift_pp_ci[0]*100:.2f}pp, {ci_res.lift_pp_ci[1]*100:.2f}pp])."
    elif is_sig and overall_delta < 0:
        verdict = f"Statistically significant negative impact: {overall_delta*100:.2f} percentage points lift (95% CI: [{ci_res.lift_pp_ci[0]*100:.2f}pp, {ci_res.lift_pp_ci[1]*100:.2f}pp])."
    else:
        verdict = f"Evidence is inconclusive at the 95% confidence level (CI spans zero: [{ci_res.lift_pp_ci[0]*100:.2f}pp, {ci_res.lift_pp_ci[1]*100:.2f}pp])."

    return ExperimentAnalysis(
        experiment_id=exp_id,
        is_complete=True,
        assigned_total=total_assigned,
        outcomes_reported=outcomes_reported,
        missing_outcomes=0,
        primary_metric="conversion_rate",
        headline_causal_claim_allowed=True,
        overall_treatment_rate=round(overall_control + overall_delta, 4),
        treatment_rate=round(overall_control + overall_delta, 4),
        overall_control_rate=round(overall_control, 4),
        control_rate=round(overall_control, 4),
        percentage_point_lift=round(overall_delta * 100, 2),
        absolute_lift_pp=round(overall_delta * 100, 2),
        relative_percent_uplift=round(rel_uplift * 100, 2) if rel_uplift is not None else None,
        relative_uplift_pct=round(rel_uplift * 100, 2) if rel_uplift is not None else None,
        incremental_converters_at_test_scale=round(incr_conv_total, 1),
        incremental_purchasers=round(incr_conv_total, 1),
        incremental_contribution_before_marketing=round(incr_contrib_total, 2),
        actual_campaign_cost=round(actual_campaign_cost, 2),
        incremental_campaign_contribution_profit=round(incr_profit, 2),
        incremental_net_contribution=round(incr_profit, 2),
        confidence_intervals=ci_res.to_dict(),
        ci_lower_pp=round(float(ci_res.lift_pp_ci[0]) * 100, 2),
        ci_upper_pp=round(float(ci_res.lift_pp_ci[1]) * 100, 2),
        p_value=ci_res.bootstrap_p_value,
        is_statistically_significant=is_sig,
        verdict_message=verdict,
        conclusion_text=verdict,
        treatment_assigned=int((merged['arm']=='treatment').sum()),
        control_assigned=int((merged['arm']=='control').sum()),
        treatment_converters=int(merged[merged['arm']=='treatment']['conv_bool'].sum()),
        control_converters=int(merged[merged['arm']=='control']['conv_bool'].sum()),
        strata_breakdown=[{
            "stratum_name": s.stratum_id,
            "treatment_n": s.assigned_treatment,
            "control_n": s.assigned_control,
            "treatment_rate": s.rate_treatment,
            "control_rate": s.rate_control,
            "lift_pp": s.percentage_point_lift,
        } for s in strata_items],
        exploratory_strata=strata_items,
        balance_checks={
            "sample_ratio_treatment": round(len(merged[merged['arm']=='treatment']) / total_assigned, 4),
            "sample_ratio_control": round(len(merged[merged['arm']=='control']) / total_assigned, 4),
        },
        diagnostics={
            "design": "Stratified 2-arm randomized holdout",
            "observation_window": f"{preregistration.get('observation_window_days', 30)} days",
        },
    )
