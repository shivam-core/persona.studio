"""Stratified customer bootstrap for intention-to-treat effect confidence intervals."""

import numpy as np
import pandas as pd


class BootstrapConfidenceIntervals:
    def __init__(
        self,
        lift_pp_ci: tuple[float, float],
        relative_uplift_ci: tuple[float, float] | None,
        incremental_converters_ci: tuple[float, float],
        incremental_profit_ci: tuple[float, float],
        bootstrap_p_value: float,
    ):
        self.lift_pp_ci = lift_pp_ci
        self.relative_uplift_ci = relative_uplift_ci
        self.incremental_converters_ci = incremental_converters_ci
        self.incremental_profit_ci = incremental_profit_ci
        self.bootstrap_p_value = bootstrap_p_value

    def to_dict(self) -> dict:
        return {
            "lift_percentage_points_ci_95": [round(self.lift_pp_ci[0], 4), round(self.lift_pp_ci[1], 4)],
            "relative_uplift_ci_95": [round(self.relative_uplift_ci[0], 4), round(self.relative_uplift_ci[1], 4)] if self.relative_uplift_ci else None,
            "incremental_converters_ci_95": [round(self.incremental_converters_ci[0], 1), round(self.incremental_converters_ci[1], 1)],
            "incremental_profit_ci_95": [round(self.incremental_profit_ci[0], 2), round(self.incremental_profit_ci[1], 2)],
            "p_value": round(self.bootstrap_p_value, 4),
        }


def compute_stratified_bootstrap(
    data_df: pd.DataFrame,
    stratum_col: str = "stratum",
    arm_col: str = "arm",
    converted_col: str = "converted",
    revenue_col: str = "net_revenue",
    cost_col: str = "variable_cost",
    actual_campaign_cost: float = 0.0,
    seed: int = 42,
    resamples: int = 2000,
) -> BootstrapConfidenceIntervals:
    """
    Resamples customers independently within each stratum and arm.
    Computes overall weighted standardized lift, relative uplift, and contribution impact.
    """
    rng = np.random.RandomState(seed)
    total_assigned = len(data_df)

    strata = data_df[stratum_col].unique()

    # Pre-index indices by (stratum, arm)
    cells = {}
    stratum_weights = {}
    treatment_sizes = {}

    for s in strata:
        s_df = data_df[data_df[stratum_col] == s]
        stratum_weights[s] = len(s_df) / total_assigned

        t_idx = s_df[s_df[arm_col] == "treatment"].index.values
        c_idx = s_df[s_df[arm_col] == "control"].index.values

        cells[(s, "treatment")] = t_idx
        cells[(s, "control")] = c_idx
        treatment_sizes[s] = len(t_idx)

    # Convert columns to numpy for speed
    conv_arr = data_df[converted_col].astype(float).values
    contrib_arr = (data_df[revenue_col].astype(float) - data_df[cost_col].astype(float)).values

    boot_deltas = []
    boot_rel_uplifts = []
    boot_incr_converters = []
    boot_incr_profits = []

    for _ in range(resamples):
        w_delta = 0.0
        w_control = 0.0
        w_incr_conv = 0.0
        w_incr_contrib = 0.0

        for s in strata:
            t_indices = cells[(s, "treatment")]
            c_indices = cells[(s, "control")]

            # Resample within stratum and arm
            if len(t_indices) > 0:
                t_sampled = rng.choice(t_indices, size=len(t_indices), replace=True)
                rate_t = np.mean(conv_arr[t_sampled])
                mean_contrib_t = np.mean(contrib_arr[t_sampled])
            else:
                rate_t = 0.0
                mean_contrib_t = 0.0

            if len(c_indices) > 0:
                c_sampled = rng.choice(c_indices, size=len(c_indices), replace=True)
                rate_c = np.mean(conv_arr[c_sampled])
                mean_contrib_c = np.mean(contrib_arr[c_sampled])
            else:
                rate_c = 0.0
                mean_contrib_c = 0.0

            diff_s = rate_t - rate_c
            w_s = stratum_weights[s]
            n_t_s = treatment_sizes[s]

            w_delta += w_s * diff_s
            w_control += w_s * rate_c
            w_incr_conv += n_t_s * diff_s
            w_incr_contrib += n_t_s * (mean_contrib_t - mean_contrib_c)

        boot_deltas.append(w_delta)
        boot_incr_converters.append(w_incr_conv)
        boot_incr_profits.append(w_incr_contrib - actual_campaign_cost)
        if w_control > 0:
            boot_rel_uplifts.append(w_delta / w_control)

    deltas_arr = np.array(boot_deltas)
    lift_ci = (float(np.percentile(deltas_arr, 2.5)), float(np.percentile(deltas_arr, 97.5)))

    rel_ci = None
    if boot_rel_uplifts:
        rel_arr = np.array(boot_rel_uplifts)
        rel_ci = (float(np.percentile(rel_arr, 2.5)), float(np.percentile(rel_arr, 97.5)))

    incr_conv_arr = np.array(boot_incr_converters)
    incr_conv_ci = (float(np.percentile(incr_conv_arr, 2.5)), float(np.percentile(incr_conv_arr, 97.5)))

    incr_prof_arr = np.array(boot_incr_profits)
    incr_prof_ci = (float(np.percentile(incr_prof_arr, 2.5)), float(np.percentile(incr_prof_arr, 97.5)))

    # Bootstrap two-sided p-value against null of delta=0
    prob_less = float((deltas_arr <= 0).mean())
    p_val = 2.0 * min(prob_less, 1.0 - prob_less)
    p_val = max(0.0001, min(1.0, p_val))

    return BootstrapConfidenceIntervals(
        lift_pp_ci=lift_ci,
        relative_uplift_ci=rel_ci,
        incremental_converters_ci=incr_conv_ci,
        incremental_profit_ci=incr_prof_ci,
        bootstrap_p_value=p_val,
    )
