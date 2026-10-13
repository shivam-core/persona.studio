"""As-of customer feature engineering engine."""

from datetime import datetime, timedelta
from typing import Any
import pandas as pd
import numpy as np
from pydantic import BaseModel, Field


class CustomerFeatureRecord(BaseModel):
    customer_id: str
    population_type: str  # existing_buyer, verified_prospect, unknown_history, insufficient_evidence
    recency_days: float | None = None
    orders_lookback: int = 0
    net_sales_lookback: float = 0.0
    aov_lookback: float | None = None
    tenure_days: float | None = None
    purchase_active_days: int = 0
    discount_share: float | None = None
    refund_share: float | None = None
    category_shares: dict[str, float] = Field(default_factory=dict)
    engagement_days: int = 0
    channel_click_shares: dict[str, float] = Field(default_factory=dict)
    cart_events: int = 0
    feature_vector: dict[str, float] = Field(default_factory=dict)


class FeatureBuildResult(BaseModel):
    as_of_at: datetime
    lookback_start_at: datetime
    lookback_days: int
    population_counts: dict[str, int]
    summary_stats: dict[str, Any]
    records: list[CustomerFeatureRecord]


def build_features(
    tables: dict[str, pd.DataFrame],
    as_of_at: datetime,
    lookback_days: int = 180,
) -> FeatureBuildResult:
    """
    Build customer features with strict as-of and lookback correctness.
    - Prevents data leakage: only uses records with order/event timestamp < as_of_at.
    - Distinguishes past buyers whose last purchase was outside lookback from prospects.
    - Differentiates verified prospects from unknown history profiles.
    """
    lookback_start = as_of_at - timedelta(days=lookback_days)

    customers_df = tables["customers"].copy()
    orders_df = tables.get("order_lines")
    offerings_df = tables.get("offerings")
    events_df = tables.get("engagement_events")

    # Map offering category
    offering_cat_map: dict[str, str] = {}
    if offerings_df is not None and not offerings_df.empty:
        for _, row in offerings_df.iterrows():
            offering_cat_map[str(row["offering_id"])] = str(row.get("category", "General"))

    # Filter pre-as-of orders
    completed_orders_all: pd.DataFrame = pd.DataFrame()
    completed_orders_lookback: pd.DataFrame = pd.DataFrame()

    if orders_df is not None and not orders_df.empty:
        # Convert order_at to timezone-naive datetime
        orders_clean = orders_df.copy()
        orders_clean["order_dt"] = pd.to_datetime(orders_clean["order_at"], utc=True).dt.tz_localize(None)
        orders_clean["status_clean"] = orders_clean["status"].astype(str).str.lower()
        orders_clean["customer_id_str"] = orders_clean["customer_id"].astype(str)

        # Only completed orders strictly before as_of_at
        completed_orders_all = orders_clean[
            (orders_clean["status_clean"] == "completed") &
            (orders_clean["order_dt"] < as_of_at)
        ]

        completed_orders_lookback = completed_orders_all[
            completed_orders_all["order_dt"] >= lookback_start
        ]

    # Filter pre-as-of events
    events_lookback: pd.DataFrame = pd.DataFrame()
    if events_df is not None and not events_df.empty:
        events_clean = events_df.copy()
        events_clean["event_dt"] = pd.to_datetime(events_clean["event_at"], utc=True).dt.tz_localize(None)
        events_clean["customer_id_str"] = events_clean["customer_id"].astype(str)

        events_lookback = events_clean[
            (events_clean["event_dt"] < as_of_at) &
            (events_clean["event_dt"] >= lookback_start)
        ]

    # Pre-group orders by customer
    all_buyer_cids = set(completed_orders_all["customer_id_str"].unique()) if not completed_orders_all.empty else set()
    orders_by_cust = dict(tuple(completed_orders_lookback.groupby("customer_id_str"))) if not completed_orders_lookback.empty else {}
    events_by_cust = dict(tuple(events_lookback.groupby("customer_id_str"))) if not events_lookback.empty else {}

    # Find overall last order per customer for recency
    last_order_dt_by_cust: dict[str, datetime] = {}
    if not completed_orders_all.empty:
        last_orders = completed_orders_all.groupby("customer_id_str")["order_dt"].max()
        for cid, dt_val in last_orders.items():
            last_order_dt_by_cust[cid] = dt_val.to_pydatetime()

    records: list[CustomerFeatureRecord] = []
    pop_counts = {
        "existing_buyer": 0,
        "verified_prospect": 0,
        "unknown_history": 0,
        "insufficient_evidence": 0,
    }

    for _, c_row in customers_df.iterrows():
        cid = str(c_row["customer_id"]).strip()
        hist_complete = bool(c_row.get("purchase_history_complete", False))

        # Check tenure
        tenure_days: float | None = None
        if pd.notna(c_row.get("signup_at")):
            try:
                s_dt = pd.to_datetime(c_row["signup_at"], utc=True).tz_localize(None).to_pydatetime()
                tenure_days = max(0.0, (as_of_at - s_dt).total_seconds() / 86400.0)
            except Exception:
                tenure_days = None

        has_orders_ever = cid in all_buyer_cids
        cust_lookback_orders = orders_by_cust.get(cid, pd.DataFrame())
        cust_lookback_events = events_by_cust.get(cid, pd.DataFrame())

        # Determine population type
        if has_orders_ever:
            pop_type = "existing_buyer"
        elif hist_complete:
            # Verified never-purchased
            if len(cust_lookback_events) >= 2:
                pop_type = "verified_prospect"
            else:
                pop_type = "insufficient_evidence"
        else:
            pop_type = "unknown_history"

        pop_counts[pop_type] += 1

        # Calculate buyer features
        recency_days: float | None = None
        if cid in last_order_dt_by_cust:
            recency_days = max(0.0, (as_of_at - last_order_dt_by_cust[cid]).total_seconds() / 86400.0)

        orders_lookback = 0
        net_sales_lookback = 0.0
        aov_lookback = None
        purchase_active_days = 0
        discount_share = None
        refund_share = None
        category_shares: dict[str, float] = {}

        if not cust_lookback_orders.empty:
            # Distinct completed orders (NOT order lines!)
            orders_lookback = int(cust_lookback_orders["order_id"].nunique())

            gross = float((cust_lookback_orders["quantity"] * cust_lookback_orders["unit_list_price"]).sum())
            disc = float(cust_lookback_orders.get("discount_amount", 0.0).sum())
            ref = float(cust_lookback_orders.get("refund_amount", 0.0).sum())

            # Line net sales
            line_net = (cust_lookback_orders["quantity"] * cust_lookback_orders["unit_list_price"]) - cust_lookback_orders.get("discount_amount", 0.0) - cust_lookback_orders.get("refund_amount", 0.0)
            net_sales_lookback = max(0.0, float(line_net.sum()))

            if orders_lookback > 0:
                aov_lookback = net_sales_lookback / orders_lookback

            purchase_active_days = int(cust_lookback_orders["order_dt"].dt.date.nunique())

            if gross > 0:
                discount_share = min(1.0, max(0.0, disc / gross))
            post_disc = gross - disc
            if post_disc > 0:
                refund_share = min(1.0, max(0.0, ref / post_disc))

            # Category shares
            cat_sales: dict[str, float] = {}
            for _, o_row in cust_lookback_orders.iterrows():
                off_id = str(o_row["offering_id"])
                cat = offering_cat_map.get(off_id, "General")
                l_net = max(0.0, float((o_row["quantity"] * o_row["unit_list_price"]) - o_row.get("discount_amount", 0.0) - o_row.get("refund_amount", 0.0)))
                cat_sales[cat] = cat_sales.get(cat, 0.0) + l_net

            total_cat_sales = sum(cat_sales.values())
            if total_cat_sales > 0:
                category_shares = {k: round(v / total_cat_sales, 4) for k, v in cat_sales.items()}

        # Calculate engagement features
        engagement_days = 0
        cart_events = 0
        channel_click_shares: dict[str, float] = {}

        if not cust_lookback_events.empty:
            engagement_days = int(cust_lookback_events["event_dt"].dt.date.nunique())
            cart_events = int((cust_lookback_events["event_type"].str.lower() == "add_to_cart").sum())

            # Channel clicks
            clicks = cust_lookback_events[cust_lookback_events["event_type"].str.lower() == "click"]
            total_clicks = len(clicks)
            if total_clicks > 0:
                ch_counts = clicks["channel"].str.lower().value_counts()
                channel_click_shares = {ch: round(float(cnt / total_clicks), 4) for ch, cnt in ch_counts.items()}

        # Numerical vector representation for clustering
        feature_vec: dict[str, float] = {
            "recency_days": float(recency_days) if recency_days is not None else 180.0,
            "orders_lookback": float(orders_lookback),
            "net_sales_lookback": float(net_sales_lookback),
            "aov_lookback": float(aov_lookback) if aov_lookback is not None else 0.0,
            "purchase_active_days": float(purchase_active_days),
            "discount_share": float(discount_share) if discount_share is not None else 0.0,
            "refund_share": float(refund_share) if refund_share is not None else 0.0,
            "engagement_days": float(engagement_days),
            "cart_events": float(cart_events),
        }
        for cat, sh in category_shares.items():
            feature_vec[f"cat_share_{cat.lower()}"] = float(sh)

        records.append(CustomerFeatureRecord(
            customer_id=cid,
            population_type=pop_type,
            recency_days=recency_days,
            orders_lookback=orders_lookback,
            net_sales_lookback=round(net_sales_lookback, 2),
            aov_lookback=round(aov_lookback, 2) if aov_lookback is not None else None,
            tenure_days=round(tenure_days, 1) if tenure_days is not None else None,
            purchase_active_days=purchase_active_days,
            discount_share=discount_share,
            refund_share=refund_share,
            category_shares=category_shares,
            engagement_days=engagement_days,
            channel_click_shares=channel_click_shares,
            cart_events=cart_events,
            feature_vector=feature_vec,
        ))

    # Overall summary stats
    buyer_records = [r for r in records if r.population_type == "existing_buyer"]
    summary_stats = {
        "total_profiles": len(records),
        "existing_buyers": len(buyer_records),
        "median_orders": float(np.median([r.orders_lookback for r in buyer_records])) if buyer_records else 0.0,
        "median_net_sales": float(np.median([r.net_sales_lookback for r in buyer_records])) if buyer_records else 0.0,
        "median_aov": float(np.median([r.aov_lookback for r in buyer_records if r.aov_lookback is not None])) if buyer_records else 0.0,
        "total_net_sales": float(sum(r.net_sales_lookback for r in buyer_records)),
    }

    return FeatureBuildResult(
        as_of_at=as_of_at,
        lookback_start_at=lookback_start,
        lookback_days=lookback_days,
        population_counts=pop_counts,
        summary_stats=summary_stats,
        records=records,
    )
