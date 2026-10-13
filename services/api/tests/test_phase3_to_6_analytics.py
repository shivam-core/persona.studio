"""Comprehensive numerical tests covering Phases 3, 4, 5, and 6 specifications."""

import pytest
import pandas as pd
import numpy as np

from app.domain.segmentation.engine import fit_candidates
from app.domain.evidence.engine import build_persona_evidence
from app.domain.matching.engine import score_offering_fit
from app.domain.simulation.engine import SimulationInputs, simulate_expected
from app.domain.optimization.engine import AllocationCellInput, allocate_budget
from app.domain.experiments.power import calculate_sample_size_and_power
from app.domain.experiments.engine import assign_experiment, analyze_experiment


# ==========================================
# PHASE 3: Segmentation Engine Tests
# ==========================================
def test_segmentation_candidate_fitting():
    # Synthetic feature matrix with 100 samples and 3 features
    rng = np.random.RandomState(42)
    c1 = rng.normal(loc=[1.0, 500.0, 20.0], scale=[0.5, 100.0, 5.0], size=(60, 3))
    c2 = rng.normal(loc=[5.0, 2500.0, 90.0], scale=[1.0, 300.0, 10.0], size=(60, 3))
    data = np.vstack([c1, c2])

    df = pd.DataFrame(data, columns=["orders_lookback", "net_sales_lookback", "recency_days"])
    df["customer_id"] = [f"CUST-{i}" for i in range(len(df))]

    comp = fit_candidates(df, population_type="existing_buyer", seed=42)
    assert not comp.is_fallback_rule
    assert comp.recommended_k >= 2
    assert len(comp.candidates) >= 2
    assert len(comp.labels) == len(df)
    assert len(comp.pca_projection["sampled_points"]) == len(df)


# ==========================================
# PHASE 4: Persona Evidence & Matching Tests
# ==========================================
def test_persona_evidence_and_matching():
    df = pd.DataFrame({
        "customer_id": [f"C-{i}" for i in range(100)],
        "orders_lookback": [4] * 50 + [1] * 50,
        "net_sales_lookback": [4000.0] * 50 + [800.0] * 50,
        "aov_lookback": [1000.0] * 50 + [800.0] * 50,
        "recency_days": [15.0] * 50 + [160.0] * 50,
        "discount_share": [0.05] * 50 + [0.35] * 50,
        "refund_share": [0.0] * 100,
    })
    labels = [0] * 50 + [1] * 50
    bundle = build_persona_evidence(df, labels, run_id="run_test", snapshot_meta={"is_synthetic": True})
    assert len(bundle.cards) == 2
    assert bundle.cards[0].display_name == "Frequent Premium Buyers"

    # Offering fit test
    offering = {"offering_id": "OFF-1", "name": "Linen Shirt", "category": "Apparel", "list_price": 1000.0}
    persona_metrics = {
        "persona_id": bundle.cards[0].stable_segment_id,
        "median_aov_lookback": 1000.0,
        "median_recency_days": 15.0,
        "category_shares": {"apparel": 0.40},
    }
    fit = score_offering_fit(persona_metrics, offering)
    assert fit.fit_score is not None
    assert fit.fit_score >= 0.50
    assert fit.is_heuristic


# ==========================================
# PHASE 5: Economics Simulator Golden Cases
# ==========================================
def test_golden_paid_product_case():
    """
    Section 10.4 Demo Golden Case:
    B=₹20,000, CPC=₹10, a=1, N=10,000, p=0.05, P=₹1,000, unit_variable_cost=₹400,
    F=₹5,000, unconstrained capacity.
    Expected:
    q=2,000, Q=100, revenue=₹100,000, contribution before marketing=₹60,000,
    marketing cost=₹25,000, campaign contribution profit=₹35,000, CAC=₹250, ROAS=5.0, ROI=1.4 (140%).
    """
    inputs = SimulationInputs(
        delivery_model="paid_cpc",
        objective="acquisition",
        offering_kind="product",
        variable_budget=20000.0,
        fixed_cost=5000.0,
        cpc=10.0,
        clicks_per_person=1.0,
        audience_n=10000,
        conversion_probability=0.05,
        list_price=1000.0,
        unit_variable_cost=400.0,
    )
    res = simulate_expected(inputs)
    assert res.expected_contacts == 2000.0
    assert res.expected_purchasers == 100.0
    assert res.net_revenue == 100000.0
    assert res.contribution_before_marketing == 60000.0
    assert res.total_marketing_cost == 25000.0
    assert res.campaign_contribution_profit == 35000.0
    assert res.campaign_cac == 250.0
    assert res.cost_per_repeat_purchaser is None
    assert res.roas == 5.0
    assert res.marketing_roi == 1.4


def test_golden_direct_retention_case():
    """
    Section 17.2 Direct Retention:
    N=1,000, B=₹1,000, c=₹1, p=0.10, P=₹500, cost=₹200, F=₹500.
    Expected: 100 purchasers, ₹50,000 revenue, ₹30,000 contribution before marketing,
    ₹28,500 contribution profit, ₹15 cost per repeat purchaser, CAC unavailable.
    """
    inputs = SimulationInputs(
        delivery_model="direct_outreach",
        objective="retention",
        offering_kind="product",
        variable_budget=1000.0,
        fixed_cost=500.0,
        direct_contact_cost=1.0,
        audience_n=1000,
        conversion_probability=0.10,
        list_price=500.0,
        unit_variable_cost=200.0,
    )
    res = simulate_expected(inputs)
    assert res.expected_purchasers == 100.0
    assert res.net_revenue == 50000.0
    assert res.contribution_before_marketing == 30000.0
    assert res.total_marketing_cost == 1500.0
    assert res.campaign_contribution_profit == 28500.0
    assert res.cost_per_repeat_purchaser == 15.0
    assert res.campaign_cac is None


def test_golden_cannibalization_case():
    """
    Section 17.2 Cannibalization:
    q=1,000, p1=0.06, p0=0.05, discounted margin=₹300, no-campaign margin=₹500, marketing=₹2,000.
    Expected: -₹9,000 incremental contribution despite 10 additional purchasers.
    """
    inputs = SimulationInputs(
        delivery_model="direct_outreach",
        objective="retention",
        offering_kind="product",
        variable_budget=2000.0,
        fixed_cost=0.0,
        direct_contact_cost=2.0,
        audience_n=1000,
        conversion_probability=0.06,
        no_campaign_conversion_probability=0.05,
        list_price=1000.0,
        discount_fraction=0.20,  # 800 net price
        unit_variable_cost=500.0,  # 300 margin
        no_campaign_margin=500.0,
    )
    res = simulate_expected(inputs)
    assert res.modeled_counterfactual_incremental_profit == -9000.0
    assert res.modeled_incremental_purchasers == 10.0


def test_golden_subscription_limits():
    """
    Section 17.2 Subscription limits:
    H=12, h=0, P=₹1,000, v=₹400, O=₹200.
    Expected: 12*(1000-400) - 200 = ₹7,000 per customer.
    If h=1: month-one contribution minus onboarding = ₹400.
    """
    inputs_h0 = SimulationInputs(
        offering_kind="subscription",
        variable_budget=1000.0,
        audience_n=1,
        conversion_probability=1.0,
        list_price=1000.0,
        unit_variable_cost=400.0,
        horizon_months=12,
        monthly_churn=0.0,
        onboarding_cost=200.0,
    )
    res_h0 = simulate_expected(inputs_h0)
    assert res_h0.contribution_before_marketing == 7000.0

    inputs_h1 = inputs_h0.model_copy(update={"monthly_churn": 1.0})
    res_h1 = simulate_expected(inputs_h1)
    assert res_h1.contribution_before_marketing == 400.0


def test_budget_allocator():
    cells = [
        AllocationCellInput(
            cell_id="cell_1",
            persona_id="p1",
            persona_name="Frequent Buyers",
            channel="email",
            audience_n=1000,
            cost_per_contact=1.0,
            baseline_conversion=0.08,
            contribution_per_purchaser=500.0,
            saturation_lambda=1.0,
        ),
        AllocationCellInput(
            cell_id="cell_2",
            persona_id="p2",
            persona_name="Lapsed Buyers",
            channel="email",
            audience_n=500,
            cost_per_contact=1.0,
            baseline_conversion=0.02,
            contribution_per_purchaser=300.0,
            saturation_lambda=1.0,
        ),
    ]
    alloc = allocate_budget(cells, total_budget=10000.0, fixed_cost=2000.0)
    assert alloc.total_budget == 10000.0
    assert alloc.fixed_cost == 2000.0
    assert alloc.spendable_variable_budget == 8000.0
    assert alloc.allocated_variable_spend <= 8000.0
    assert alloc.recommended_action in ["launch", "do_not_launch"]
    # Check that high-performing cell gets more spend
    c1 = next(c for c in alloc.cell_allocations if c.cell_id == "cell_1")
    c2 = next(c for c in alloc.cell_allocations if c.cell_id == "cell_2")
    assert c1.allocated_spend >= c2.allocated_spend


# ==========================================
# PHASE 6: Experiment Analyzer Golden Case
# ==========================================
def test_experiment_analysis_golden_case():
    """
    Section 17.2 Simple unstratified experiment:
    1,000 assigned per arm, 80 treatment converters and 50 control converters.
    Absolute lift: 3 percentage points.
    Relative uplift: 60%.
    Incremental converters: 30.
    """
    n_per_arm = 1000
    t_conv = 80
    c_conv = 50

    t_rows = [
        {"customer_id": f"T-{i}", "stratum_persona_id": "P1", "arm": "treatment", "converted": i < t_conv, "net_revenue": 1000.0 if i < t_conv else 0.0, "variable_cost": 400.0 if i < t_conv else 0.0, "outcome_complete": True}
        for i in range(n_per_arm)
    ]
    c_rows = [
        {"customer_id": f"C-{i}", "stratum_persona_id": "P1", "arm": "control", "converted": i < c_conv, "net_revenue": 1000.0 if i < c_conv else 0.0, "variable_cost": 400.0 if i < c_conv else 0.0, "outcome_complete": True}
        for i in range(n_per_arm)
    ]

    assignments_df = pd.DataFrame(t_rows + c_rows)[["customer_id", "stratum_persona_id", "arm"]]
    outcomes_df = pd.DataFrame(t_rows + c_rows)[["customer_id", "converted", "net_revenue", "variable_cost", "outcome_complete"]]

    analysis = analyze_experiment(assignments_df, outcomes_df, preregistration={"experiment_id": "exp_golden"}, seed=42)

    assert analysis.is_complete
    assert analysis.headline_causal_claim_allowed
    assert analysis.percentage_point_lift == 3.0
    assert analysis.relative_percent_uplift == 60.0
    assert analysis.incremental_converters_at_test_scale == 30.0
    assert analysis.confidence_intervals["lift_percentage_points_ci_95"] is not None
