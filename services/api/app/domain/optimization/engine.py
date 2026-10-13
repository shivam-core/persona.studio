"""Model-based constrained budget allocation engine."""

import math
from typing import Any
from pydantic import BaseModel, Field


class AllocationCellInput(BaseModel):
    cell_id: str
    persona_id: str
    persona_name: str
    channel: str
    audience_n: int = Field(ge=0)
    cost_per_contact: float = Field(gt=0)
    baseline_conversion: float = Field(ge=0, le=1)
    contribution_per_purchaser: float
    saturation_lambda: float = Field(default=0.0, ge=0)
    min_budget: float = Field(default=0.0, ge=0)
    max_budget: float | None = Field(default=None, ge=0)


class CellAllocationResult(BaseModel):
    cell_id: str
    persona_id: str
    persona_name: str
    channel: str
    allocated_spend: float
    expected_contacts: float
    expected_purchasers: float
    contribution_before_marketing: float
    net_cell_contribution_profit: float
    share_of_variable_spend: float


class AllocationResult(BaseModel):
    total_budget: float
    fixed_cost: float
    spendable_variable_budget: float
    allocated_variable_spend: float
    unspent_budget: float
    total_expected_purchasers: float
    total_contribution_profit: float
    recommended_action: str  # "launch", "do_not_launch"
    recommendation_reason: str
    cell_allocations: list[CellAllocationResult]
    comparison: dict[str, Any]  # Current vs Equal Split vs Model-Based


def allocate_budget(
    cells: list[AllocationCellInput],
    total_budget: float,
    fixed_cost: float = 0.0,
    shared_capacity_units: int | None = None,
    num_steps: int = 100,
) -> AllocationResult:
    """
    Greedy marginal allocation across 100 budget increments under saturation curves.
    Evaluates Do Not Launch baseline if total campaign profit < 0.
    """
    spendable_budget = max(0.0, total_budget - fixed_cost)
    if spendable_budget <= 0 or not cells:
        return AllocationResult(
            total_budget=total_budget,
            fixed_cost=fixed_cost,
            spendable_variable_budget=0.0,
            allocated_variable_spend=0.0,
            unspent_budget=total_budget,
            total_expected_purchasers=0.0,
            total_contribution_profit=-fixed_cost,
            recommended_action="do_not_launch",
            recommendation_reason="Fixed cost exceeds or equals total budget.",
            cell_allocations=[],
            comparison={},
        )

    # Calculate purchasers function for a given spend on a cell
    def _cell_purchasers(cell: AllocationCellInput, spend: float) -> float:
        contacts = min(float(cell.audience_n), spend / cell.cost_per_contact)
        if cell.saturation_lambda > 0 and cell.audience_n > 0:
            return cell.baseline_conversion * (cell.audience_n / cell.saturation_lambda) * (
                1.0 - math.exp(-cell.saturation_lambda * contacts / cell.audience_n)
            )
        return contacts * cell.baseline_conversion

    step_size = spendable_budget / num_steps

    # Initialize allocations with mandatory minimums
    allocated_spend: dict[str, float] = {c.cell_id: min(c.min_budget, spendable_budget) for c in cells}
    current_total_spend = sum(allocated_spend.values())

    # Greedy allocation on remaining budget
    remaining_steps = int((spendable_budget - current_total_spend) / step_size)

    for _ in range(max(0, remaining_steps)):
        best_cell = None
        best_marginal_gain = 0.0

        for cell in cells:
            curr_s = allocated_spend[cell.cell_id]
            next_s = curr_s + step_size

            # Check bounds
            if cell.max_budget is not None and next_s > cell.max_budget:
                continue

            max_contacts = curr_s / cell.cost_per_contact
            if max_contacts >= cell.audience_n:
                continue  # Audience saturated

            # Purchasers diff
            q_curr = _cell_purchasers(cell, curr_s)
            q_next = _cell_purchasers(cell, next_s)
            dq = q_next - q_curr

            # Marginal profit gain = dq * m - step_size
            marginal_gain = dq * cell.contribution_per_purchaser - step_size

            if marginal_gain > best_marginal_gain:
                best_marginal_gain = marginal_gain
                best_cell = cell

        if best_cell is None or best_marginal_gain <= 0:
            # Stop if no positive marginal gain remains
            break

        allocated_spend[best_cell.cell_id] += step_size

    # Build results
    results_list: list[CellAllocationResult] = []
    total_var_spend = sum(allocated_spend.values())
    total_purchasers = 0.0
    total_contrib_before_mkt = 0.0

    for cell in cells:
        s = allocated_spend[cell.cell_id]
        q_purch = _cell_purchasers(cell, s)
        total_purchasers += q_purch
        contrib = q_purch * cell.contribution_per_purchaser
        total_contrib_before_mkt += contrib

        results_list.append(CellAllocationResult(
            cell_id=cell.cell_id,
            persona_id=cell.persona_id,
            persona_name=cell.persona_name,
            channel=cell.channel,
            allocated_spend=round(s, 2),
            expected_contacts=round(min(float(cell.audience_n), s / cell.cost_per_contact), 1),
            expected_purchasers=round(q_purch, 1),
            contribution_before_marketing=round(contrib, 2),
            net_cell_contribution_profit=round(contrib - s, 2),
            share_of_variable_spend=round(s / total_var_spend, 4) if total_var_spend > 0 else 0.0,
        ))

    total_profit = total_contrib_before_mkt - total_var_spend - fixed_cost
    unspent = round(spendable_budget - total_var_spend, 2)

    if total_profit > 0:
        action = "launch"
        reason = f"Allocated budget produces positive estimated contribution profit of ₹{total_profit:,.0f}."
    else:
        action = "do_not_launch"
        reason = f"Estimated campaign contribution profit is negative (-₹{abs(total_profit):,.0f}) after fixed costs. Do not launch under current assumptions."

    # Comparison: Equal Split vs Model-Based
    equal_spend = spendable_budget / len(cells) if cells else 0.0
    equal_purchasers = sum(_cell_purchasers(c, equal_spend) for c in cells)
    equal_contrib = sum(_cell_purchasers(c, equal_spend) * c.contribution_per_purchaser for c in cells)
    equal_profit = equal_contrib - spendable_budget - fixed_cost

    comparison = {
        "model_based": {
            "spend": round(total_var_spend, 2),
            "purchasers": round(total_purchasers, 1),
            "profit": round(total_profit, 2),
        },
        "equal_split": {
            "spend": round(spendable_budget, 2),
            "purchasers": round(equal_purchasers, 1),
            "profit": round(equal_profit, 2),
        },
    }

    return AllocationResult(
        total_budget=round(total_budget, 2),
        fixed_cost=round(fixed_cost, 2),
        spendable_variable_budget=round(spendable_budget, 2),
        allocated_variable_spend=round(total_var_spend, 2),
        unspent_budget=unspent,
        total_expected_purchasers=round(total_purchasers, 1),
        total_contribution_profit=round(total_profit, 2),
        recommended_action=action,
        recommendation_reason=reason,
        cell_allocations=results_list,
        comparison=comparison,
    )
