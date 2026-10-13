"""Monte Carlo uncertainty simulator with 1,000 seeded draws."""

import numpy as np
from pydantic import BaseModel, Field
from app.domain.simulation.engine import SimulationInputs, simulate_expected, WaterfallComponent


class UncertaintyResult(BaseModel):
    draws: int
    profit_median: float
    profit_p10: float
    profit_p90: float
    prob_positive_profit: float
    purchasers_median: float
    purchasers_p10: float
    purchasers_p90: float
    cac_median: float | None = None
    roas_median: float | None = None
    waterfall_median: list[WaterfallComponent]
    profit_distribution_samples: list[float]


def simulate_uncertainty(
    base_inputs: SimulationInputs,
    seed: int = 42,
    draws: int = 1000,
    conversion_min: float | None = None,
    conversion_max: float | None = None,
    cpc_min: float | None = None,
    cpc_max: float | None = None,
) -> UncertaintyResult:
    """
    Run 1,000 Monte Carlo draws sampling conversion, costs, and binomial realization.
    """
    rng = np.random.RandomState(seed)

    # Conversion bounds (triangular around mode)
    p_mode = base_inputs.conversion_probability
    p_min = conversion_min if conversion_min is not None else max(0.001, p_mode * 0.6)
    p_max = conversion_max if conversion_max is not None else min(1.0, p_mode * 1.5)

    # CPC bounds
    cpc_mode = base_inputs.cpc
    cpc_low = cpc_min if cpc_min is not None else max(1.0, cpc_mode * 0.7)
    cpc_high = cpc_max if cpc_max is not None else cpc_mode * 1.4

    profits = []
    purchasers_list = []
    cacs = []
    roas_list = []
    all_waterfalls = []

    for _ in range(draws):
        # Sample parameters
        p_sample = float(rng.triangular(p_min, p_mode, p_max))
        cpc_sample = float(rng.triangular(cpc_low, cpc_mode, cpc_high))

        # Copy inputs with sampled values
        draw_inputs = base_inputs.model_copy(update={
            "conversion_probability": p_sample,
            "cpc": cpc_sample,
        })

        res = simulate_expected(draw_inputs)

        # Binomial realization on integer contacts
        contacts_int = int(res.expected_contacts)
        if contacts_int > 0 and 0.0 <= p_sample <= 1.0:
            purchasers_sampled = int(rng.binomial(contacts_int, p_sample))
            if base_inputs.capacity_units is not None:
                purchasers_sampled = min(purchasers_sampled, base_inputs.capacity_units)
        else:
            purchasers_sampled = 0

        # Adjust profit for binomial purchaser realization
        unit_rev = (res.net_revenue / res.expected_purchasers) if res.expected_purchasers > 0 else 0.0
        unit_vcost = (res.variable_costs / res.expected_purchasers) if res.expected_purchasers > 0 else 0.0
        sampled_contrib = purchasers_sampled * (unit_rev - unit_vcost)
        sampled_profit = sampled_contrib - res.total_marketing_cost

        profits.append(sampled_profit)
        purchasers_list.append(purchasers_sampled)
        if res.campaign_cac is not None:
            cacs.append(res.total_marketing_cost / purchasers_sampled if purchasers_sampled > 0 else None)
        if res.roas is not None:
            roas_list.append(purchasers_sampled * unit_rev / res.variable_marketing_spend if res.variable_marketing_spend > 0 else None)

        all_waterfalls.append(res.waterfall)

    profits_arr = np.array(profits)
    purchasers_arr = np.array(purchasers_list)

    median_profit = float(np.median(profits_arr))
    p10_profit = float(np.percentile(profits_arr, 10))
    p90_profit = float(np.percentile(profits_arr, 90))
    prob_pos = float((profits_arr > 0).mean())

    med_purchasers = float(np.median(purchasers_arr))
    p10_purchasers = float(np.percentile(purchasers_arr, 10))
    p90_purchasers = float(np.percentile(purchasers_arr, 90))

    valid_cacs = [c for c in cacs if c is not None]
    med_cac = float(np.median(valid_cacs)) if valid_cacs else None

    valid_roas = [r for r in roas_list if r is not None]
    med_roas = float(np.median(valid_roas)) if valid_roas else None

    # Take waterfall from the draw closest to median profit for arithmetic consistency
    median_idx = int(np.argmin(np.abs(profits_arr - median_profit)))
    representative_waterfall = all_waterfalls[median_idx]

    # Sample 100 points for distribution chart
    step = max(1, draws // 100)
    distribution_samples = [round(float(p), 1) for p in profits[::step][:100]]

    return UncertaintyResult(
        draws=draws,
        profit_median=round(median_profit, 2),
        profit_p10=round(p10_profit, 2),
        profit_p90=round(p90_profit, 2),
        prob_positive_profit=round(prob_pos, 4),
        purchasers_median=round(med_purchasers, 1),
        purchasers_p10=round(p10_purchasers, 1),
        purchasers_p90=round(p90_purchasers, 1),
        cac_median=round(med_cac, 2) if med_cac is not None else None,
        roas_median=round(med_roas, 2) if med_roas is not None else None,
        waterfall_median=representative_waterfall,
        profit_distribution_samples=distribution_samples,
    )
