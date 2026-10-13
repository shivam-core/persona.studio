"""Offering fit heuristic matching engine."""

from typing import Any
from pydantic import BaseModel, Field


class OfferingFitComponent(BaseModel):
    name: str
    weight: float
    raw_value: float | None
    normalized_score: float
    is_available: bool
    explanation: str


class OfferingFitResult(BaseModel):
    persona_id: str
    offering_id: str
    fit_score: float | None  # 0.0 to 1.0 (or None if insufficient coverage)
    fit_label: str  # High Fit, Moderate Fit, Low Fit, Insufficient Evidence
    coverage_pct: float
    components: list[OfferingFitComponent]
    reasoning: str
    is_heuristic: bool = True


def score_offering_fit(
    persona_metrics: dict[str, Any],
    offering: dict[str, Any],
) -> OfferingFitResult:
    """
    Computes explainable offering fit score as an ordinal planning heuristic.
    Components:
    1. Category affinity (45%)
    2. Historical spend compatibility (25%)
    3. Engagement recency (20%)
    4. Observed category engagement (10%)
    """
    cat = str(offering.get("category", "")).lower()
    price = float(offering.get("list_price", 1000.0))

    components: list[OfferingFitComponent] = []

    # 1. Category affinity (45%)
    cat_shares = persona_metrics.get("category_shares", {})
    cat_share_val = float(cat_shares.get(cat, cat_shares.get(offering.get("category", ""), 0.0)))
    cat_score = min(1.0, cat_share_val * 2.5)  # Scale share to 0..1
    components.append(OfferingFitComponent(
        name="Category Affinity",
        weight=0.45,
        raw_value=cat_share_val,
        normalized_score=round(cat_score, 3),
        is_available=bool(cat_shares),
        explanation=f"{cat_share_val*100:.1f}% of historical segment spend was in {offering.get('category')}.",
    ))

    # 2. Spend compatibility (25%)
    aov = persona_metrics.get("median_aov_lookback")
    if aov is not None and aov > 0:
        ratio = price / aov
        # Bell curve around ratio=1.0: exp(-0.5 * (ln(ratio))^2)
        import math
        spend_score = math.exp(-0.5 * (math.log(max(0.1, ratio)) ** 2))
        spend_avail = True
        spend_expl = f"Offering price (₹{price:.0f}) is {ratio:.1f}x of segment median AOV (₹{aov:.0f})."
    else:
        spend_score = 0.5
        spend_avail = False
        spend_expl = "No historical spend records available for this audience."

    components.append(OfferingFitComponent(
        name="Spend Compatibility",
        weight=0.25,
        raw_value=aov,
        normalized_score=round(spend_score, 3),
        is_available=spend_avail,
        explanation=spend_expl,
    ))

    # 3. Engagement Recency (20%)
    recency = persona_metrics.get("median_recency_days")
    if recency is not None:
        rec_score = max(0.0, min(1.0, 1.0 - (recency / 180.0)))
        rec_avail = True
        rec_expl = f"Segment was recently active {recency:.0f} days ago."
    else:
        rec_score = 0.5
        rec_avail = False
        rec_expl = "No recent activity timestamps observed."

    components.append(OfferingFitComponent(
        name="Recency Compatibility",
        weight=0.20,
        raw_value=recency,
        normalized_score=round(rec_score, 3),
        is_available=rec_avail,
        explanation=rec_expl,
    ))

    # 4. Observed category engagement (10%)
    cart_events = persona_metrics.get("cart_events", 0)
    eng_score = min(1.0, cart_events / 5.0) if cart_events else 0.2
    components.append(OfferingFitComponent(
        name="Category Engagement",
        weight=0.10,
        raw_value=float(cart_events),
        normalized_score=round(eng_score, 3),
        is_available=True,
        explanation=f"Observed {cart_events} add-to-cart signals in lookback.",
    ))

    # Calculate coverage
    available_weights = sum(c.weight for c in components if c.is_available)
    coverage_pct = round(available_weights / 1.0 * 100, 1)

    if coverage_pct < 50.0:
        return OfferingFitResult(
            persona_id=persona_metrics.get("persona_id", ""),
            offering_id=str(offering.get("offering_id", "")),
            fit_score=None,
            fit_label="Insufficient Evidence",
            coverage_pct=coverage_pct,
            components=components,
            reasoning="Less than 50% of required historical behavioral signals are present.",
            is_heuristic=True,
        )

    # Renormalize weighted score over available components
    weighted_sum = sum(c.weight * c.normalized_score for c in components if c.is_available)
    final_score = round(weighted_sum / available_weights, 3)

    if final_score >= 0.70:
        label = "High Fit"
    elif final_score >= 0.45:
        label = "Moderate Fit"
    else:
        label = "Low Fit"

    reasoning = f"{label} ({final_score*100:.0f}/100) based on {components[0].explanation} {components[1].explanation}"

    return OfferingFitResult(
        persona_id=persona_metrics.get("persona_id", ""),
        offering_id=str(offering.get("offering_id", "")),
        fit_score=final_score,
        fit_label=label,
        coverage_pct=coverage_pct,
        components=components,
        reasoning=reasoning,
        is_heuristic=True,
    )
