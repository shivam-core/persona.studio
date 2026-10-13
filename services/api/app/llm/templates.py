"""Deterministic persona wording and test hypotheses generator."""

from typing import Any
from pydantic import BaseModel, Field


class SummaryClaim(BaseModel):
    text: str
    evidence_ids: list[str] = Field(default_factory=list)
    kind: str = "observation"  # observation, hypothesis


class TestHypothesis(BaseModel):
    text: str
    evidence_ids: list[str] = Field(default_factory=list)


class PersonaWordingResult(BaseModel):
    display_name: str
    summary_text: str
    summary_claims: list[SummaryClaim]
    test_hypotheses: list[TestHypothesis]
    missing_evidence: list[str]
    provenance: str = "template"  # template, ai


def generate_template_wording(
    metrics_summary: dict[str, Any],
    evidence_ids: list[str],
) -> PersonaWordingResult:
    """Generate deterministic, grounded wording without external LLM."""
    orders = metrics_summary.get("median_orders_lookback", 1.0)
    aov = metrics_summary.get("median_aov_lookback", 1000.0)
    recency = metrics_summary.get("median_recency_days", 30.0)
    discount = metrics_summary.get("median_discount_share", 0.0)

    # Pick matching evidence IDs if present
    ord_id = [eid for eid in evidence_ids if "orders" in eid]
    aov_id = [eid for eid in evidence_ids if "aov" in eid]
    rec_id = [eid for eid in evidence_ids if "recency" in eid]
    disc_id = [eid for eid in evidence_ids if "discount" in eid]

    if orders >= 3 and aov >= 2000:
        display_name = "Frequent Premium Buyers"
        summary = f"Repeat purchasers with {orders:.1f} median orders and high basket value (₹{aov:.0f} AOV)."
        claims = [
            SummaryClaim(text=f"High purchasing frequency with median {orders:.1f} orders in lookback.", evidence_ids=ord_id, kind="observation"),
            SummaryClaim(text=f"Median order value of ₹{aov:.0f} exceeds population baseline.", evidence_ids=aov_id, kind="observation"),
        ]
        hypotheses = [
            TestHypothesis(text="Test exclusive product previews and premium bundle offerings.", evidence_ids=aov_id),
            TestHypothesis(text="Evaluate retention impact of early-access tier with randomized holdout.", evidence_ids=ord_id),
        ]
    elif discount >= 0.15:
        display_name = "Discount-Led Repeat Buyers"
        summary = f"Value-conscious customers with {orders:.1f} orders and {discount*100:.1f}% discount usage."
        claims = [
            SummaryClaim(text=f"Median discount share of {discount*100:.1f}% across completed purchases.", evidence_ids=disc_id, kind="observation"),
            SummaryClaim(text=f"Repeat purchasing pattern with {orders:.1f} orders.", evidence_ids=ord_id, kind="observation"),
        ]
        hypotheses = [
            TestHypothesis(text="Test minimum order threshold discounts to preserve contribution margin.", evidence_ids=disc_id),
            TestHypothesis(text="Measure whether promotional incentives create genuine incremental lift.", evidence_ids=ord_id),
        ]
    elif recency > 120:
        display_name = "Lapsed Historical Buyers"
        summary = f"Past customers with no recorded orders in {recency:.0f} days."
        claims = [
            SummaryClaim(text=f"Extended recency gap with {recency:.0f} days since last completed order.", evidence_ids=rec_id, kind="observation"),
        ]
        hypotheses = [
            TestHypothesis(text="Test targeted reactivation offer with time-bound deadline.", evidence_ids=rec_id),
        ]
    else:
        display_name = "Steady Value Buyers"
        summary = f"Active audience with {orders:.1f} orders and median ₹{aov:.0f} AOV."
        claims = [
            SummaryClaim(text=f"Observed recent activity {recency:.0f} days ago.", evidence_ids=rec_id, kind="observation"),
            SummaryClaim(text=f"Median spend of ₹{aov:.0f} per completed order.", evidence_ids=aov_id, kind="observation"),
        ]
        hypotheses = [
            TestHypothesis(text="Test cross-category recommendations based on observed category affinity.", evidence_ids=ord_id),
        ]

    return PersonaWordingResult(
        display_name=display_name,
        summary_text=summary,
        summary_claims=claims,
        test_hypotheses=hypotheses,
        missing_evidence=[],
        provenance="template",
    )
