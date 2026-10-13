"""Pure deterministic campaign economics simulation engine."""

import math
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class SimulationInputs(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    delivery_model: Literal["paid_cpc", "direct_outreach"] = "paid_cpc"
    objective: Literal["acquisition", "retention", "reactivation"] = "acquisition"
    offering_kind: Literal["product", "service", "subscription"] = "product"

    # Budgets & Costs
    variable_budget: float = Field(ge=0)
    fixed_cost: float = Field(ge=0, default=0.0)
    cpc: float = Field(default=10.0, gt=0)
    clicks_per_person: float = Field(default=1.0, ge=1.0)
    direct_contact_cost: float = Field(default=1.0, gt=0)

    # Audience & Conversion
    audience_n: int = Field(ge=0)
    conversion_probability: float = Field(ge=0, le=1)
    no_campaign_conversion_probability: float | None = Field(default=None, ge=0, le=1)

    # Pricing & Product Costs
    list_price: float = Field(ge=0)
    discount_fraction: float = Field(default=0.0, ge=0, le=1)
    fixed_discount: float = Field(default=0.0, ge=0)
    refund_fraction: float = Field(default=0.0, ge=0, le=1)
    unit_variable_cost: float = Field(default=0.0, ge=0)
    fulfillment_cost: float = Field(default=0.0, ge=0)
    payment_fee_rate: float = Field(default=0.0, ge=0, le=1)
    refund_handling_cost: float = Field(default=0.0, ge=0)
    capacity_units: int | None = Field(default=None, ge=0)

    # Subscription specific
    monthly_churn: float = Field(default=0.05, ge=0, le=1)
    horizon_months: int = Field(default=12, ge=1, le=36)
    onboarding_cost: float = Field(default=0.0, ge=0)
    discount_rate_monthly: float = Field(default=0.0, ge=0)

    # Saturation parameter (lambda >= 0)
    saturation_lambda: float = Field(default=0.0, ge=0)

    # Counterfactual margins
    no_campaign_margin: float | None = Field(default=None)

    @model_validator(mode="after")
    def validate_discounts(self):
        if self.fixed_discount > 0 and self.list_price > 0:
            if self.fixed_discount > self.list_price:
                raise ValueError("Fixed discount cannot exceed list price.")
        return self


class WaterfallComponent(BaseModel):
    label: str
    amount: float
    is_subtotal: bool = False


class SimulationResult(BaseModel):
    expected_contacts: float
    expected_purchasers: float
    unmet_demand_capacity: float
    capacity_exceeded: bool
    net_revenue: float
    variable_costs: float
    contribution_before_marketing: float
    variable_marketing_spend: float
    fixed_marketing_cost: float
    total_marketing_cost: float
    campaign_contribution_profit: float
    campaign_cac: float | None  # Only for acquisition
    cost_per_repeat_purchaser: float | None  # For retention / reactivation
    roas: float | None
    marketing_roi: float | None
    unspent_variable_budget: float
    waterfall: list[WaterfallComponent]
    modeled_counterfactual_incremental_profit: float | None
    modeled_incremental_purchasers: float | None
    break_even_conversion: float | None
    break_even_cpc: float | None
    allowable_cac: float | None
    warnings: list[str]


def simulate_expected(x: SimulationInputs) -> SimulationResult:
    """
    Computes exact analytical marketing economics.
    Guarantees golden test arithmetic:
    - B=20k, CPC=10, a=1, N=10k, p=0.05, P=1000, cost=400, F=5000 -> profit=35,000, CAC=250.
    """
    warnings = []

    # 1. Delivery & Contacts
    if x.delivery_model == "paid_cpc":
        unit_contact_cost = x.cpc * x.clicks_per_person
    else:
        unit_contact_cost = x.direct_contact_cost

    max_affordable_contacts = x.variable_budget / unit_contact_cost if unit_contact_cost > 0 else 0.0
    contacts = min(float(x.audience_n), max_affordable_contacts)
    actual_media_spend = contacts * unit_contact_cost
    unspent_budget = max(0.0, x.variable_budget - actual_media_spend)

    # 2. Conversion with optional saturation curve
    if x.saturation_lambda > 0 and x.audience_n > 0:
        # Declining marginal conversion: Q = p_base * N/lambda * (1 - exp(-lambda * q / N))
        purchasers_raw = x.conversion_probability * (x.audience_n / x.saturation_lambda) * (
            1.0 - math.exp(-x.saturation_lambda * contacts / x.audience_n)
        )
    else:
        purchasers_raw = contacts * x.conversion_probability

    # Capacity constraints
    capacity_exceeded = False
    unmet_demand = 0.0
    if x.capacity_units is not None:
        if purchasers_raw > x.capacity_units:
            capacity_exceeded = True
            unmet_demand = purchasers_raw - x.capacity_units
            purchasers = float(x.capacity_units)
            warnings.append(f"Capacity cap ({x.capacity_units} units) binds: {unmet_demand:.1f} modeled customer demand unmet.")
        else:
            purchasers = purchasers_raw
    else:
        purchasers = purchasers_raw

    # 3. Unit Margins & Revenue
    if x.offering_kind == "subscription":
        # Monthly subscription finite horizon
        # Month 1 discount only
        disc_amt = x.list_price * x.discount_fraction if x.discount_fraction > 0 else x.fixed_discount
        p1 = max(0.0, x.list_price - disc_amt)
        net_price = p1

        rev_per_cust = 0.0
        contrib_per_cust = 0.0
        v_cost = x.unit_variable_cost

        for t in range(1, x.horizon_months + 1):
            survival = (1.0 - x.monthly_churn) ** (t - 1)
            price_t = p1 if t == 1 else x.list_price
            rev_t = survival * (1.0 - x.refund_fraction) * price_t
            cost_t = survival * (v_cost + x.payment_fee_rate * price_t)
            disc_factor = (1.0 + x.discount_rate_monthly) ** (t - 1)

            rev_per_cust += rev_t
            contrib_per_cust += (rev_t - cost_t) / disc_factor

        contrib_per_cust -= x.onboarding_cost

        revenue = purchasers * rev_per_cust
        contribution_before_marketing = purchasers * contrib_per_cust
        variable_costs = revenue - contribution_before_marketing
        unit_margin = contrib_per_cust

    else:
        # Product or One-Time Service
        disc_amt = x.list_price * x.discount_fraction if x.discount_fraction > 0 else x.fixed_discount
        net_price = max(0.0, x.list_price - disc_amt)

        revenue = purchasers * (1.0 - x.refund_fraction) * net_price
        unit_var_cost = (
            x.unit_variable_cost
            + x.fulfillment_cost
            + x.payment_fee_rate * net_price
            + x.refund_handling_cost
        )
        variable_costs = purchasers * unit_var_cost
        contribution_before_marketing = revenue - variable_costs
        unit_margin = (1.0 - x.refund_fraction) * net_price - unit_var_cost

    # 4. Total Marketing & Profit
    total_marketing_cost = actual_media_spend + x.fixed_cost
    profit = contribution_before_marketing - total_marketing_cost

    # 5. CAC / Cost per Purchaser
    campaign_cac = None
    cost_per_repeat = None
    if purchasers > 0:
        if x.objective == "acquisition":
            campaign_cac = total_marketing_cost / purchasers
        else:
            cost_per_repeat = total_marketing_cost / purchasers

    # 6. Ratios
    roas = revenue / actual_media_spend if actual_media_spend > 0 else None
    roi = profit / total_marketing_cost if total_marketing_cost > 0 else None

    # 7. Break-even calculations
    break_even_p = None
    break_even_cpc = None
    allowable_cac = None

    if unit_margin > 0 and contacts > 0:
        p_be = total_marketing_cost / (contacts * unit_margin)
        break_even_p = p_be if p_be <= 1.0 else None
        if break_even_p is None:
            warnings.append("Break-even conversion exceeds 100% under stated assumptions.")

        if x.delivery_model == "paid_cpc" and x.conversion_probability > 0:
            break_even_cpc = (x.conversion_probability * unit_margin) / x.clicks_per_person

        allowable_cac = unit_margin
    elif unit_margin <= 0:
        warnings.append("Negative unit contribution: each purchase loses money before marketing spend.")

    # 8. Counterfactual Modeling (Cannibalization check)
    incr_profit = None
    incr_purchasers = None
    if x.no_campaign_conversion_probability is not None:
        p0 = x.no_campaign_conversion_probability
        p1 = x.conversion_probability
        incr_purchasers = contacts * (p1 - p0)

        # Base margin without campaign
        m_base = x.no_campaign_margin if x.no_campaign_margin is not None else (
            x.list_price - x.unit_variable_cost - x.fulfillment_cost - x.payment_fee_rate * x.list_price
        )

        incr_profit = (
            contacts * p1 * unit_margin
            - contacts * p0 * m_base
            - actual_media_spend
            - x.fixed_cost
        )

    # 9. Profit Waterfall
    waterfall = [
        WaterfallComponent(label="Gross Revenue", amount=round(purchasers * (x.list_price if x.offering_kind != 'subscription' else net_price), 2)),
        WaterfallComponent(label="Discounts & Refunds", amount=round(-purchasers * (disc_amt + x.refund_fraction * net_price), 2)),
        WaterfallComponent(label="Net Revenue", amount=round(revenue, 2), is_subtotal=True),
        WaterfallComponent(label="COGS & Variable Delivery", amount=round(-variable_costs, 2)),
        WaterfallComponent(label="Contribution before Marketing", amount=round(contribution_before_marketing, 2), is_subtotal=True),
        WaterfallComponent(label="Variable Media Spend", amount=round(-actual_media_spend, 2)),
        WaterfallComponent(label="Fixed Campaign Cost", amount=round(-x.fixed_cost, 2)),
        WaterfallComponent(label="Contribution Profit", amount=round(profit, 2), is_subtotal=True),
    ]

    return SimulationResult(
        expected_contacts=round(contacts, 1),
        expected_purchasers=round(purchasers, 1),
        unmet_demand_capacity=round(unmet_demand, 1),
        capacity_exceeded=capacity_exceeded,
        net_revenue=round(revenue, 2),
        variable_costs=round(variable_costs, 2),
        contribution_before_marketing=round(contribution_before_marketing, 2),
        variable_marketing_spend=round(actual_media_spend, 2),
        fixed_marketing_cost=round(x.fixed_cost, 2),
        total_marketing_cost=round(total_marketing_cost, 2),
        campaign_contribution_profit=round(profit, 2),
        campaign_cac=round(campaign_cac, 2) if campaign_cac is not None else None,
        cost_per_repeat_purchaser=round(cost_per_repeat, 2) if cost_per_repeat is not None else None,
        roas=round(roas, 2) if roas is not None else None,
        marketing_roi=round(roi, 4) if roi is not None else None,
        unspent_variable_budget=round(unspent_budget, 2),
        waterfall=waterfall,
        modeled_counterfactual_incremental_profit=round(incr_profit, 2) if incr_profit is not None else None,
        modeled_incremental_purchasers=round(incr_purchasers, 1) if incr_purchasers is not None else None,
        break_even_conversion=round(break_even_p, 4) if break_even_p is not None else None,
        break_even_cpc=round(break_even_cpc, 2) if break_even_cpc is not None else None,
        allowable_cac=round(allowable_cac, 2) if allowable_cac is not None else None,
        warnings=warnings,
    )
