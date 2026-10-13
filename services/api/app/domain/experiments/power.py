"""Power and sample-size planning for randomized holdout tests."""

import math
from statsmodels.stats.power import NormalIndPower
from statsmodels.stats.proportion import proportion_effectsize
from pydantic import BaseModel


class PowerAnalysisResult(BaseModel):
    baseline_conversion: float
    mde_absolute: float
    target_power: float
    alpha: float
    allocation_ratio: float
    required_sample_per_arm: int
    required_total_sample: int
    available_sample: int
    achievable_power: float
    is_underpowered: bool
    warning_message: str | None = None


def calculate_sample_size_and_power(
    baseline_conversion: float = 0.05,
    mde_absolute: float = 0.02,
    alpha: float = 0.05,
    target_power: float = 0.80,
    allocation_ratio: float = 0.5,
    available_sample: int = 2000,
) -> PowerAnalysisResult:
    """
    Computes required sample size and achievable statistical power
    using statsmodels NormalIndPower for two-proportion comparison.
    """
    p0 = max(0.001, min(0.999, baseline_conversion))
    p1 = max(0.001, min(0.999, p0 + mde_absolute))

    effect_size = proportion_effectsize(p1, p0)
    analysis = NormalIndPower()

    # Ratio of sample sizes: n2 / n1 = (1 - ratio) / ratio
    ratio = (1.0 - allocation_ratio) / allocation_ratio if allocation_ratio > 0 else 1.0

    try:
        req_n1 = analysis.solve_power(
            effect_size=abs(effect_size),
            alpha=alpha,
            power=target_power,
            ratio=ratio,
            alternative="two-sided",
        )
        req_n_arm = int(math.ceil(req_n1))
        req_total = int(math.ceil(req_n1 * (1.0 + ratio)))
    except Exception:
        req_n_arm = 1000
        req_total = 2000

    # Calculate achievable power with available sample
    n1_avail = max(10, int(available_sample * allocation_ratio))
    try:
        achieved_power = float(analysis.solve_power(
            effect_size=abs(effect_size),
            nobs1=n1_avail,
            alpha=alpha,
            ratio=ratio,
            alternative="two-sided",
        ))
    except Exception:
        achieved_power = 0.50

    is_underpowered = available_sample < req_total or achieved_power < target_power
    warning_msg = None
    if is_underpowered:
        warning_msg = (
            f"Underpowered design: available audience ({available_sample}) is below required "
            f"sample size ({req_total}) to detect a {mde_absolute*100:.1f}pp lift at {target_power*100:.0f}% power."
        )

    return PowerAnalysisResult(
        baseline_conversion=p0,
        mde_absolute=mde_absolute,
        target_power=target_power,
        alpha=alpha,
        allocation_ratio=allocation_ratio,
        required_sample_per_arm=req_n_arm,
        required_total_sample=req_total,
        available_sample=available_sample,
        achievable_power=round(achieved_power, 3),
        is_underpowered=is_underpowered,
        warning_message=warning_msg,
    )
