"""Pure evidence metric generation and behavioral fingerprint extraction."""

from datetime import datetime
from typing import Any
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

PALETTE = ["#5146D9", "#087F8C", "#B65D18", "#A53D72", "#466EB4", "#55742B", "#7653A6", "#6B7280"]
GLYPHS = ["trending-up", "percent", "shopping-bag", "clock", "award", "tag", "repeat", "sparkles"]


class EvidenceMetricItem(BaseModel):
    id: str
    segment_id: str
    metric_key: str
    display_label: str
    value: float | None
    unit: str  # currency, fraction, count, days
    aggregation: str
    valid_n: int
    population_n: int
    baseline_value: float | None
    numerator: float | None = None
    denominator: float | None = None
    source_columns: list[str] = Field(default_factory=list)
    lookback_start_at: str
    as_of_at: str
    missing_fraction: float = 0.0
    is_synthetic: bool = False


class PersonaEvidenceCard(BaseModel):
    segment_ordinal: int
    stable_segment_id: str
    display_name: str
    summary_text: str
    audience_count: int
    audience_share: float
    population_type: str
    color_hex: str
    behavioral_glyph: str
    evidence_coverage_badge: str
    fingerprint: dict[str, dict[str, float]]
    top_distinctions: list[dict[str, Any]]
    hypotheses: list[dict[str, str]]
    missing_evidence: list[str]
    metrics: list[EvidenceMetricItem]


class PersonaEvidenceBundle(BaseModel):
    run_id: str
    cards: list[PersonaEvidenceCard]


def build_persona_evidence(
    raw_features_df: pd.DataFrame,
    labels: list[int],
    run_id: str,
    snapshot_meta: dict[str, Any],
) -> PersonaEvidenceBundle:
    """
    Computes immutable EvidenceMetric records and behavioral fingerprints for each segment.
    All displayed numbers are computed in Python with explicit baselines, populations, and units.
    """
    df = raw_features_df.copy()
    df["segment_ordinal"] = labels
    total_n = len(df)
    unique_ordinals = sorted(list(set(labels)))

    as_of_str = str(snapshot_meta.get("as_of_at", datetime.utcnow().isoformat()))
    lookback_start_str = str(snapshot_meta.get("lookback_start_at", ""))
    is_synthetic = bool(snapshot_meta.get("is_synthetic", False))
    pop_type = str(snapshot_meta.get("population_type", "existing_buyer"))

    # Population baselines
    pop_med_orders = float(df["orders_lookback"].median()) if "orders_lookback" in df.columns else 0.0
    pop_med_sales = float(df["net_sales_lookback"].median()) if "net_sales_lookback" in df.columns else 0.0
    pop_med_aov = float(df["aov_lookback"].dropna().median()) if "aov_lookback" in df.columns and not df["aov_lookback"].dropna().empty else 0.0
    pop_med_recency = float(df["recency_days"].dropna().median()) if "recency_days" in df.columns and not df["recency_days"].dropna().empty else 180.0
    pop_med_discount = float(df["discount_share"].dropna().median()) if "discount_share" in df.columns and not df["discount_share"].dropna().empty else 0.0
    pop_med_refund = float(df["refund_share"].dropna().median()) if "refund_share" in df.columns and not df["refund_share"].dropna().empty else 0.0

    cards: list[PersonaEvidenceCard] = []

    for idx, ord_val in enumerate(unique_ordinals):
        seg_df = df[df["segment_ordinal"] == ord_val]
        seg_n = len(seg_df)
        seg_share = round(seg_n / total_n, 4) if total_n > 0 else 0.0
        stable_id = f"{run_id}:seg{ord_val}"

        # Segment statistics
        seg_med_orders = float(seg_df["orders_lookback"].median()) if "orders_lookback" in seg_df.columns else 0.0
        seg_med_sales = float(seg_df["net_sales_lookback"].median()) if "net_sales_lookback" in seg_df.columns else 0.0
        seg_med_aov = float(seg_df["aov_lookback"].dropna().median()) if "aov_lookback" in seg_df.columns and not seg_df["aov_lookback"].dropna().empty else 0.0
        seg_med_recency = float(seg_df["recency_days"].dropna().median()) if "recency_days" in seg_df.columns and not seg_df["recency_days"].dropna().empty else 180.0
        seg_med_discount = float(seg_df["discount_share"].dropna().median()) if "discount_share" in seg_df.columns and not seg_df["discount_share"].dropna().empty else 0.0
        seg_med_refund = float(seg_df["refund_share"].dropna().median()) if "refund_share" in seg_df.columns and not seg_df["refund_share"].dropna().empty else 0.0

        # Construct EvidenceMetric items
        metrics: list[EvidenceMetricItem] = [
            EvidenceMetricItem(
                id=f"ev_{run_id}_s{ord_val}_orders",
                segment_id=stable_id,
                metric_key="median_orders_lookback",
                display_label="Order Frequency",
                value=round(seg_med_orders, 1),
                unit="count",
                aggregation="median_orders_in_lookback",
                valid_n=seg_n,
                population_n=total_n,
                baseline_value=round(pop_med_orders, 1),
                source_columns=["order_lines.order_id"],
                lookback_start_at=lookback_start_str,
                as_of_at=as_of_str,
                is_synthetic=is_synthetic,
            ),
            EvidenceMetricItem(
                id=f"ev_{run_id}_s{ord_val}_aov",
                segment_id=stable_id,
                metric_key="median_aov_lookback",
                display_label="Average Order Value (AOV)",
                value=round(seg_med_aov, 2),
                unit="currency",
                aggregation="median_order_level_aov",
                valid_n=int(seg_df["aov_lookback"].dropna().count()) if "aov_lookback" in seg_df.columns else 0,
                population_n=total_n,
                baseline_value=round(pop_med_aov, 2),
                source_columns=["order_lines.unit_list_price", "order_lines.discount_amount", "order_lines.refund_amount"],
                lookback_start_at=lookback_start_str,
                as_of_at=as_of_str,
                is_synthetic=is_synthetic,
            ),
            EvidenceMetricItem(
                id=f"ev_{run_id}_s{ord_val}_recency",
                segment_id=stable_id,
                metric_key="median_recency_days",
                display_label="Days Since Last Purchase",
                value=round(seg_med_recency, 1),
                unit="days",
                aggregation="median_days_since_completed_order",
                valid_n=int(seg_df["recency_days"].dropna().count()) if "recency_days" in seg_df.columns else 0,
                population_n=total_n,
                baseline_value=round(pop_med_recency, 1),
                source_columns=["order_lines.order_at"],
                lookback_start_at=lookback_start_str,
                as_of_at=as_of_str,
                is_synthetic=is_synthetic,
            ),
            EvidenceMetricItem(
                id=f"ev_{run_id}_s{ord_val}_discount",
                segment_id=stable_id,
                metric_key="median_discount_share",
                display_label="Discount Utilization Rate",
                value=round(seg_med_discount, 4),
                unit="fraction",
                aggregation="median_discount_over_gross_sales",
                valid_n=seg_n,
                population_n=total_n,
                baseline_value=round(pop_med_discount, 4),
                source_columns=["order_lines.discount_amount", "order_lines.unit_list_price"],
                lookback_start_at=lookback_start_str,
                as_of_at=as_of_str,
                is_synthetic=is_synthetic,
            ),
            EvidenceMetricItem(
                id=f"ev_{run_id}_s{ord_val}_refund",
                segment_id=stable_id,
                metric_key="median_refund_share",
                display_label="Refund Share",
                value=round(seg_med_refund, 4),
                unit="fraction",
                aggregation="median_refund_over_post_discount_sales",
                valid_n=seg_n,
                population_n=total_n,
                baseline_value=round(pop_med_refund, 4),
                source_columns=["order_lines.refund_amount"],
                lookback_start_at=lookback_start_str,
                as_of_at=as_of_str,
                is_synthetic=is_synthetic,
            ),
        ]

        # Behavioral Fingerprint (0-100 percentile ranks against overall population)
        def _calc_pct(val: float, col: str) -> float:
            if col not in df.columns or df[col].dropna().empty:
                return 50.0
            return round(float((df[col] <= val).mean() * 100), 1)

        fingerprint = {
            "raw_values": {
                "orders_lookback": round(seg_med_orders, 1),
                "aov_lookback": round(seg_med_aov, 2),
                "recency_days": round(seg_med_recency, 1),
                "discount_share": round(seg_med_discount, 4),
                "refund_share": round(seg_med_refund, 4),
                "net_sales_lookback": round(seg_med_sales, 2),
            },
            "percentiles": {
                "orders_lookback": round(_calc_pct(seg_med_orders, "orders_lookback") / 100.0, 2),
                "aov_lookback": round(_calc_pct(seg_med_aov, "aov_lookback") / 100.0, 2),
                "recency_days": round((100.0 - _calc_pct(seg_med_recency, "recency_days")) / 100.0, 2),
                "discount_share": round(_calc_pct(seg_med_discount, "discount_share") / 100.0, 2),
                "refund_share": round(_calc_pct(seg_med_refund, "refund_share") / 100.0, 2),
            },
            "order_frequency": {"percentile": _calc_pct(seg_med_orders, "orders_lookback"), "raw": seg_med_orders},
            "average_order_value": {"percentile": _calc_pct(seg_med_aov, "aov_lookback"), "raw": seg_med_aov},
            "recency_recency": {"percentile": round(100.0 - _calc_pct(seg_med_recency, "recency_days"), 1), "raw": seg_med_recency},
            "discount_sensitivity": {"percentile": _calc_pct(seg_med_discount, "discount_share"), "raw": seg_med_discount},
            "refund_rate": {"percentile": _calc_pct(seg_med_refund, "refund_share"), "raw": seg_med_refund},
        }

        # Determine distinguishing characteristics
        top_distinctions = []
        if seg_med_orders > pop_med_orders * 1.3:
            top_distinctions.append({"label": "High Frequency", "detail": f"{seg_med_orders:.1f} orders vs {pop_med_orders:.1f} baseline"})
        elif seg_med_orders < pop_med_orders * 0.7:
            top_distinctions.append({"label": "Low Frequency", "detail": f"{seg_med_orders:.1f} orders vs {pop_med_orders:.1f} baseline"})

        if seg_med_aov > pop_med_aov * 1.2:
            top_distinctions.append({"label": "Premium Spend", "detail": f"AOV ₹{seg_med_aov:.0f} vs ₹{pop_med_aov:.0f} baseline"})
        elif seg_med_discount > pop_med_discount * 1.4:
            top_distinctions.append({"label": "High Discount Affinity", "detail": f"{seg_med_discount*100:.1f}% discount share vs {pop_med_discount*100:.1f}% baseline"})

        if seg_med_recency < pop_med_recency * 0.7:
            top_distinctions.append({"label": "Recent Activity", "detail": f"Active {seg_med_recency:.0f}d ago vs {pop_med_recency:.0f}d baseline"})
        elif seg_med_recency > 120.0:
            top_distinctions.append({"label": "Lapsed", "detail": f"Last seen {seg_med_recency:.0f}d ago"})

        if not top_distinctions:
            top_distinctions.append({"label": "Standard Behavior", "detail": "Metrics aligned with overall population median"})

        # Assign deterministic behavioral persona name based on real metrics
        if seg_med_orders >= 3 and seg_med_aov >= pop_med_aov:
            name = "Frequent Premium Buyers"
            summary = f"High-frequency buyers ({seg_med_orders:.1f} orders) with above-average basket value."
            hypo = [
                {"text": "Test premium bundle or early access to new collections.", "evidence_id": f"ev_{run_id}_s{ord_val}_aov"},
                {"text": "Introduce VIP loyalty tier to reinforce repeat purchasing.", "evidence_id": f"ev_{run_id}_s{ord_val}_orders"},
            ]
        elif seg_med_discount >= 0.15:
            name = "Discount-Led Repeat Buyers"
            summary = f"Price-sensitive repeat customers ({seg_med_orders:.1f} orders) with {seg_med_discount*100:.1f}% discount utilization."
            hypo = [
                {"text": "Test tiered minimum-spend discounts rather than flat price cuts.", "evidence_id": f"ev_{run_id}_s{ord_val}_discount"},
                {"text": "Evaluate margin cannibalization before increasing promotional rate.", "evidence_id": f"ev_{run_id}_s{ord_val}_discount"},
            ]
        elif seg_med_recency > 150:
            name = "Lapsed / At-Risk Buyers"
            summary = f"Historical purchasers with no orders in over {seg_med_recency:.0f} days."
            hypo = [
                {"text": "Test reactivation campaign with an explicit finite-horizon offer.", "evidence_id": f"ev_{run_id}_s{ord_val}_recency"},
            ]
        elif seg_med_orders == 1:
            name = "Recent One-Time Buyers"
            summary = f"Single-order buyers ({seg_med_orders:.0f} order) acquired recently ({seg_med_recency:.0f} days ago)."
            hypo = [
                {"text": "Test complementary cross-sell within 30 days of first purchase.", "evidence_id": f"ev_{run_id}_s{ord_val}_recency"},
            ]
        else:
            name = f"Behavioral Cluster {ord_val + 1}"
            summary = f"Segment of {seg_n} customers with median AOV ₹{seg_med_aov:.0f}."
            hypo = [
                {"text": "Conduct exploratory campaign test with holdout to evaluate incremental lift.", "evidence_id": f"ev_{run_id}_s{ord_val}_orders"},
            ]

        # Badge: Strong if seg_n >= 50 and metrics grounded
        coverage_badge = "Strong" if seg_n >= 50 else ("Partial" if seg_n >= 20 else "Limited")

        color_hex = PALETTE[idx % len(PALETTE)]
        glyph = GLYPHS[idx % len(GLYPHS)]

        cards.append(PersonaEvidenceCard(
            segment_ordinal=ord_val,
            stable_segment_id=stable_id,
            display_name=name,
            summary_text=summary,
            audience_count=seg_n,
            audience_share=seg_share,
            population_type=pop_type,
            color_hex=color_hex,
            behavioral_glyph=glyph,
            evidence_coverage_badge=coverage_badge,
            fingerprint=fingerprint,
            top_distinctions=top_distinctions[:3],
            hypotheses=hypo,
            missing_evidence=[],
            metrics=metrics,
        ))

    return PersonaEvidenceBundle(run_id=run_id, cards=cards)
