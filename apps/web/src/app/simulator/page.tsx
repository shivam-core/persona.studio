"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import {
  Calculator,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sliders,
  DollarSign,
  PieChart as PieIcon,
  Layers,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  DeliveryModel,
  CampaignObjective,
  SimulationInputs,
  SimulationResult,
  MonteCarloSummary,
  AllocationResult,
} from "@/lib/types";

export default function SimulatorPage() {
  // Input State
  const [deliveryModel, setDeliveryModel] = useState<DeliveryModel>("paid_cpc");
  const [objective, setObjective] = useState<CampaignObjective>("acquisition");
  const [variableBudget, setVariableBudget] = useState<number>(20000);
  const [fixedCost, setFixedCost] = useState<number>(5000);
  const [cpc, setCpc] = useState<number>(10);
  const [clicksPerPerson, setClicksPerPerson] = useState<number>(1.0);
  const [contactCostDirect, setContactCostDirect] = useState<number>(1.5);
  const [audienceN, setAudienceN] = useState<number>(10000);
  const [conversionProb, setConversionProb] = useState<number>(0.05); // 5%
  const [listPrice, setListPrice] = useState<number>(1000);
  const [discountFraction, setDiscountFraction] = useState<number>(0.0);
  const [refundFraction, setRefundFraction] = useState<number>(0.0);
  const [unitVariableCost, setUnitVariableCost] = useState<number>(400);
  const [fulfillmentCost, setFulfillmentCost] = useState<number>(0);
  const [paymentFeeRate, setPaymentFeeRate] = useState<number>(0.0);
  const [refundHandlingCost, setRefundHandlingCost] = useState<number>(0);
  const [capacityUnits, setCapacityUnits] = useState<number | null>(null);
  const [saturationLambda, setSaturationLambda] = useState<number>(0.0);

  // Counterfactual & Subscription
  const [p0, setP0] = useState<number>(0.0);
  const [isSubscription, setIsSubscription] = useState<boolean>(false);
  const [subHorizon, setSubHorizon] = useState<number>(12);
  const [subChurn, setSubChurn] = useState<number>(0.05);

  // Scenario tabs: 'base' | 'conservative' | 'optimistic'
  const [scenarioTab, setScenarioTab] = useState<"base" | "conservative" | "optimistic">("base");

  // Monte Carlo & Allocator results
  const [mcSummary, setMcSummary] = useState<MonteCarloSummary | null>(null);
  const [isRunningMc, setIsRunningMc] = useState<boolean>(false);
  const [allocationResult, setAllocationResult] = useState<AllocationResult | null>(null);
  const [isRunningAllocation, setIsRunningAllocation] = useState<boolean>(false);

  // Construct current simulation inputs
  const currentInputs: SimulationInputs = {
    delivery_model: deliveryModel,
    objective,
    variable_budget: variableBudget,
    fixed_cost: fixedCost,
    cpc,
    clicks_per_person: clicksPerPerson,
    contact_cost_direct: contactCostDirect,
    audience_n: audienceN,
    conversion_probability:
      scenarioTab === "conservative"
        ? Math.max(0.001, conversionProb * 0.7)
        : scenarioTab === "optimistic"
        ? Math.min(1.0, conversionProb * 1.3)
        : conversionProb,
    list_price: listPrice,
    discount_fraction: discountFraction,
    refund_fraction: refundFraction,
    unit_variable_cost: unitVariableCost,
    fulfillment_cost: fulfillmentCost,
    payment_fee_rate: paymentFeeRate,
    refund_handling_cost: refundHandlingCost,
    capacity_units: capacityUnits,
    saturation_lambda: saturationLambda,
    baseline_conversion_p0: p0 > 0 ? p0 : undefined,
    is_subscription: isSubscription,
    subscription_horizon_months: subHorizon,
    subscription_monthly_churn: subChurn,
  };

  // Preview Query
  const { data: simResult, isLoading: loadingPreview } = useQuery({
    queryKey: ["sim-preview", currentInputs],
    queryFn: () => api.previewSimulation(currentInputs),
  });

  // Run Monte Carlo
  const handleRunMonteCarlo = async () => {
    try {
      setIsRunningMc(true);
      const res = await api.runMonteCarlo(currentInputs, 1000, 42);
      setMcSummary(res);
    } catch (err: any) {
      alert("Monte Carlo simulation failed: " + err.message);
    } finally {
      setIsRunningMc(false);
    }
  };

  // Run Constrained Budget Allocation
  const handleRunAllocation = async () => {
    try {
      setIsRunningAllocation(true);
      const cells = [
        {
          persona_id: "seg_premium",
          persona_name: "Frequent Premium Buyers",
          channel: "Paid Social CPC",
          audience_n: 5000,
          unit_cost: cpc * clicksPerPerson,
          conversion_prob: conversionProb * 1.2,
          margin: (listPrice * (1 - discountFraction)) - unitVariableCost,
        },
        {
          persona_id: "seg_lapsed",
          persona_name: "Lapsed / At-Risk Buyers",
          channel: "Direct Email",
          audience_n: 3000,
          unit_cost: 2.0,
          conversion_prob: conversionProb * 0.8,
          margin: (listPrice * (1 - discountFraction)) - unitVariableCost,
        },
        {
          persona_id: "seg_prospects",
          persona_name: "Verified Prospects",
          channel: "Paid Search Intent",
          audience_n: 2000,
          unit_cost: cpc * 1.4,
          conversion_prob: conversionProb * 0.9,
          margin: (listPrice * (1 - discountFraction)) - unitVariableCost,
        },
      ];

      const res = await api.runAllocation(cells, variableBudget + fixedCost, fixedCost, 0.5);
      setAllocationResult(res);
    } catch (err: any) {
      alert("Budget allocation failed: " + err.message);
    } finally {
      setIsRunningAllocation(false);
    }
  };

  // Profit Waterfall Chart Data
  const waterfallData = simResult
    ? [
        { name: "Net Sales", amount: simResult.net_revenue, fill: "#5146D9" },
        { name: "Var Costs", amount: -simResult.variable_costs, fill: "#B65D18" },
        { name: "Media Spend", amount: -simResult.variable_marketing_spend, fill: "#087F8C" },
        { name: "Fixed Marketing", amount: -simResult.fixed_marketing_cost, fill: "#6B7280" },
        {
          name: "Profit",
          amount: simResult.contribution_profit,
          fill: simResult.contribution_profit >= 0 ? "#16724E" : "#B42335",
        },
      ]
    : [];

  // Budget Saturation Curve Data
  const budgetSteps = [5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000];
  const saturationCurveData = budgetSteps.map((b) => {
    const unitContact = deliveryModel === "paid_cpc" ? cpc * clicksPerPerson : contactCostDirect;
    const cont = Math.min(audienceN, b / unitContact);
    const p = currentInputs.conversion_probability;
    const pur = cont * p;
    const rev = pur * (listPrice * (1 - discountFraction));
    const costs = pur * unitVariableCost;
    const mkt = b + fixedCost;
    const prof = rev - costs - mkt;
    return { budget: b, profit: Math.round(prof), purchasers: Math.round(pur) };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#17233B] tracking-tight">
            CAC & Campaign Economics Simulator
          </h1>
          <p className="text-sm text-[#52617A] mt-1">
            Deterministic unit economics, break-even thresholds, Monte Carlo uncertainty, and model-based budget allocation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Golden Case Presets */}
          <button
            onClick={() => {
              setDeliveryModel("paid_cpc");
              setObjective("acquisition");
              setVariableBudget(20000);
              setFixedCost(5000);
              setCpc(10);
              setClicksPerPerson(1.0);
              setAudienceN(10000);
              setConversionProb(0.05);
              setListPrice(1000);
              setUnitVariableCost(400);
              setDiscountFraction(0);
              setRefundFraction(0);
              setFulfillmentCost(0);
              setPaymentFeeRate(0);
              setRefundHandlingCost(0);
              setCapacityUnits(null);
              setSaturationLambda(0);
              setIsSubscription(false);
            }}
            className="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F2] hover:bg-[#F5F7FB] text-xs font-semibold text-[#17233B] shadow-xs"
          >
            Load Golden Product Case (₹35k Profit / ₹250 CAC)
          </button>
        </div>
      </div>

      {/* 3-Panel Grid: Inputs (Left) | Visualizations & Waterfall (Center) | Allocator (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT PANEL: Inputs & Economic Parameters (4 Cols) */}
        <div className="xl:col-span-4 p-5 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-5 text-xs">
          <div className="flex items-center justify-between border-b border-[#E2E8F2] pb-3">
            <h2 className="text-sm font-bold text-[#17233B] flex items-center gap-2">
              <Sliders className="h-4 w-4 text-[#5146D9]" />
              <span>Model Inputs & Assumptions</span>
            </h2>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase">
              Deterministic Python Authority
            </span>
          </div>

          {/* Delivery & Objective */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#17233B] mb-1">Delivery Model</label>
              <select
                value={deliveryModel}
                onChange={(e) => setDeliveryModel(e.target.value as DeliveryModel)}
                className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
              >
                <option value="paid_cpc">Paid CPC (Ad Clicks)</option>
                <option value="direct_outreach">Direct Outreach (Email/SMS)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#17233B] mb-1">Campaign Objective</label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as CampaignObjective)}
                className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
              >
                <option value="acquisition">Acquisition (CAC)</option>
                <option value="retention">Retention (Repeat Cost)</option>
                <option value="reactivation">Reactivation</option>
              </select>
            </div>
          </div>

          {/* Budgets & Media Costs */}
          <div className="space-y-3 pt-3 border-t border-[#E2E8F2]">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-[#17233B]">
                Variable Media Spend (₹):
              </label>
              <span className="font-bold text-[#5146D9] tabular-nums">
                {formatCurrency(variableBudget)}
              </span>
            </div>
            <input
              type="range"
              min={2000}
              max={100000}
              step={1000}
              value={variableBudget}
              onChange={(e) => setVariableBudget(Number(e.target.value))}
              className="w-full accent-[#5146D9]"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#17233B] mb-1">Fixed Cost F (₹)</label>
                <input
                  type="number"
                  value={fixedCost}
                  onChange={(e) => setFixedCost(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
                />
              </div>

              {deliveryModel === "paid_cpc" ? (
                <div>
                  <label className="block font-semibold text-[#17233B] mb-1">Cost Per Click CPC (₹)</label>
                  <input
                    type="number"
                    value={cpc}
                    onChange={(e) => setCpc(Number(e.target.value))}
                    className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-[#17233B] mb-1">Cost Per Contact c (₹)</label>
                  <input
                    type="number"
                    value={contactCostDirect}
                    onChange={(e) => setContactCostDirect(Number(e.target.value))}
                    className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#17233B] mb-1">Audience Size N</label>
                <input
                  type="number"
                  value={audienceN}
                  onChange={(e) => setAudienceN(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#17233B] mb-1">
                  Conversion Rate (p): {formatPercent(conversionProb)}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={conversionProb}
                  onChange={(e) => setConversionProb(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
                />
              </div>
            </div>
          </div>

          {/* Pricing, COGS, Discounts & Refunds */}
          <div className="space-y-3 pt-3 border-t border-[#E2E8F2]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#17233B] mb-1">List Price (₹)</label>
                <input
                  type="number"
                  value={listPrice}
                  onChange={(e) => setListPrice(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#17233B] mb-1">Unit COGS (₹)</label>
                <input
                  type="number"
                  value={unitVariableCost}
                  onChange={(e) => setUnitVariableCost(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#17233B] mb-1">
                  Discount: {formatPercent(discountFraction)}
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="0.9"
                  value={discountFraction}
                  onChange={(e) => setDiscountFraction(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#17233B] mb-1">
                  Refund Rate: {formatPercent(refundFraction)}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.5"
                  value={refundFraction}
                  onChange={(e) => setRefundFraction(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#17233B] mb-1">
                Fulfillment & Payment Fee Rate (%): {formatPercent(paymentFeeRate)}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="0.1"
                value={paymentFeeRate}
                onChange={(e) => setPaymentFeeRate(Number(e.target.value))}
                className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
              />
            </div>
          </div>

          {/* Capacity & Subscription toggle */}
          <div className="space-y-3 pt-3 border-t border-[#E2E8F2]">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-[#17233B]">Capacity Limit (Units)</label>
              <input
                type="number"
                placeholder="Unconstrained"
                value={capacityUnits ?? ""}
                onChange={(e) => setCapacityUnits(e.target.value ? Number(e.target.value) : null)}
                className="w-32 p-1.5 rounded border border-[#E2E8F2] bg-[#F5F7FB] text-right"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="subToggle"
                checked={isSubscription}
                onChange={(e) => setIsSubscription(e.target.checked)}
                className="rounded text-[#5146D9]"
              />
              <label htmlFor="subToggle" className="font-semibold text-[#17233B]">
                Finite Horizon Subscription Mode (12-Mo)
              </label>
            </div>
          </div>
        </div>

        {/* CENTER PANEL: Results, Waterfall, Scenarios & Monte Carlo (5 Cols) */}
        <div className="xl:col-span-5 space-y-6">
          {/* Scenario Tabs */}
          <div className="flex bg-white p-1 rounded-xl border border-[#E2E8F2] text-xs font-semibold shadow-xs">
            <button
              onClick={() => setScenarioTab("conservative")}
              className={`flex-1 py-1.5 rounded-lg transition-colors ${
                scenarioTab === "conservative"
                  ? "bg-amber-100 text-amber-900"
                  : "text-[#52617A] hover:text-[#17233B]"
              }`}
            >
              Conservative (-30% Conv)
            </button>
            <button
              onClick={() => setScenarioTab("base")}
              className={`flex-1 py-1.5 rounded-lg transition-colors ${
                scenarioTab === "base"
                  ? "bg-[#5146D9] text-white shadow-xs"
                  : "text-[#52617A] hover:text-[#17233B]"
              }`}
            >
              Base Expected
            </button>
            <button
              onClick={() => setScenarioTab("optimistic")}
              className={`flex-1 py-1.5 rounded-lg transition-colors ${
                scenarioTab === "optimistic"
                  ? "bg-emerald-100 text-emerald-900"
                  : "text-[#52617A] hover:text-[#17233B]"
              }`}
            >
              Optimistic (+30% Conv)
            </button>
          </div>

          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F2] shadow-xs">
              <span className="text-[11px] text-[#52617A] font-medium">Purchasers</span>
              <div className="text-xl font-bold text-[#17233B] mt-1 tabular-nums">
                {formatNumber(simResult?.expected_purchasers ?? 0)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F2] shadow-xs">
              <span className="text-[11px] text-[#52617A] font-medium">Net Revenue</span>
              <div className="text-xl font-bold text-[#17233B] mt-1 tabular-nums">
                {formatCurrency(simResult?.net_revenue ?? 0)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F2] shadow-xs">
              <span className="text-[11px] text-[#52617A] font-medium">Marketing Cost</span>
              <div className="text-xl font-bold text-[#17233B] mt-1 tabular-nums">
                {formatCurrency(
                  (simResult?.variable_marketing_spend ?? 0) + (simResult?.fixed_marketing_cost ?? 0)
                )}
              </div>
            </div>

            <div
              className={`p-3.5 rounded-xl border shadow-xs ${
                (simResult?.contribution_profit ?? 0) >= 0
                  ? "bg-emerald-50/50 border-emerald-200"
                  : "bg-rose-50/50 border-rose-200"
              }`}
            >
              <span className="text-[11px] text-[#52617A] font-medium">Contribution Profit</span>
              <div
                className={`text-xl font-bold mt-1 tabular-nums ${
                  (simResult?.contribution_profit ?? 0) >= 0 ? "text-[#16724E]" : "text-[#B42335]"
                }`}
              >
                {formatCurrency(simResult?.contribution_profit ?? 0)}
              </div>
            </div>
          </div>

          {/* Second Row: CAC, ROAS, ROI, Break-even */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white border border-[#E2E8F2]">
              <span className="text-[#52617A]">
                {objective === "acquisition" ? "Campaign CAC:" : "Cost / Repeat Buyer:"}
              </span>
              <div className="text-base font-bold text-[#5146D9] mt-0.5 tabular-nums">
                {objective === "acquisition"
                  ? formatCurrency(simResult?.campaign_cac)
                  : formatCurrency(simResult?.cost_per_repeat_purchaser)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E2E8F2]">
              <span className="text-[#52617A]">Media ROAS:</span>
              <div className="text-base font-bold text-[#17233B] mt-0.5 tabular-nums">
                {simResult?.roas ? `${simResult.roas.toFixed(2)}x` : "—"}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E2E8F2]">
              <span className="text-[#52617A]">Marketing ROI:</span>
              <div className="text-base font-bold text-[#17233B] mt-0.5 tabular-nums">
                {simResult?.marketing_roi ? `${(simResult.marketing_roi * 100).toFixed(1)}%` : "—"}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E2E8F2]">
              <span className="text-[#52617A]">Break-Even Conv:</span>
              <div className="text-base font-bold text-[#17233B] mt-0.5 tabular-nums">
                {simResult?.break_even_conversion
                  ? formatPercent(simResult.break_even_conversion)
                  : "Infeasible"}
              </div>
            </div>
          </div>

          {/* Profit Waterfall Chart */}
          <div className="p-5 rounded-xl bg-white border border-[#E2E8F2] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#17233B]">
                  Analytical Profit Waterfall
                </h3>
                <p className="text-[11px] text-[#52617A]">
                  Step-by-step contribution: Revenue → COGS → Ad Spend → Fixed Cost → Profit
                </p>
              </div>
            </div>

            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52617A" }} stroke="#E2E8F2" />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#52617A" }}
                    stroke="#E2E8F2"
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatCurrency(Number(val)), "Amount"]}
                    contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F2", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Bar dataKey="amount">
                    {waterfallData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monte Carlo 1,000 Draws Panel */}
          <div className="p-5 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2E8F2] pb-2">
              <div>
                <h3 className="text-sm font-bold text-[#17233B]">
                  Monte Carlo Uncertainty Distribution
                </h3>
                <p className="text-[11px] text-[#52617A]">
                  1,000 seeded binomial draws accounting for conversion & cost variance.
                </p>
              </div>
              <button
                onClick={handleRunMonteCarlo}
                disabled={isRunningMc}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5146D9] text-white text-xs font-semibold hover:bg-[#4338CA] transition-colors disabled:opacity-50"
              >
                <Play className={`h-3 w-3 ${isRunningMc ? "animate-spin" : ""}`} />
                <span>{isRunningMc ? "Simulating..." : "Run 1k Draws"}</span>
              </button>
            </div>

            {mcSummary ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded bg-[#F5F7FB] border border-[#E2E8F2]">
                    <span className="text-[#52617A] text-[10px]">Median Profit</span>
                    <div className="font-bold text-[#17233B]">{formatCurrency(mcSummary.median_profit)}</div>
                  </div>
                  <div className="p-2 rounded bg-[#F5F7FB] border border-[#E2E8F2]">
                    <span className="text-[#52617A] text-[10px]">p10 (Downside)</span>
                    <div className="font-bold text-rose-700">{formatCurrency(mcSummary.p10_profit)}</div>
                  </div>
                  <div className="p-2 rounded bg-[#F5F7FB] border border-[#E2E8F2]">
                    <span className="text-[#52617A] text-[10px]">p90 (Upside)</span>
                    <div className="font-bold text-emerald-700">{formatCurrency(mcSummary.p90_profit)}</div>
                  </div>
                  <div className="p-2 rounded bg-emerald-50 border border-emerald-200">
                    <span className="text-emerald-800 text-[10px]">Prob &gt; 0 Profit</span>
                    <div className="font-bold text-emerald-800">{formatPercent(mcSummary.probability_positive_profit)}</div>
                  </div>
                </div>

                <div className="h-[120px] w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mcSummary.histogram} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <XAxis dataKey="bin_min" tick={false} stroke="#E2E8F2" />
                      <YAxis tick={{ fontSize: 10, fill: "#52617A" }} stroke="#E2E8F2" />
                      <Tooltip
                        formatter={(val: any) => [`${val} draws`, "Frequency"]}
                        contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F2", fontSize: "11px" }}
                      />
                      <Bar dataKey="count" fill="#5146D9" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-[#52617A] bg-[#F5F7FB] rounded-lg">
                Click &ldquo;Run 1k Draws&rdquo; to sample binomial purchaser realization distributions.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Model-Based Constrained Allocator (3 Cols) */}
        <div className="xl:col-span-3 p-5 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-[#E2E8F2] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#17233B]">
                Budget Allocation Optimizer
              </h2>
              <p className="text-[11px] text-[#52617A]">
                Constrained marginal contribution optimization across audience cells.
              </p>
            </div>
          </div>

          <button
            onClick={handleRunAllocation}
            disabled={isRunningAllocation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#5146D9] text-white text-xs font-semibold hover:bg-[#4338CA] transition-colors shadow-sm disabled:opacity-50"
          >
            <Play className={`h-3.5 w-3.5 ${isRunningAllocation ? "animate-spin" : ""}`} />
            <span>{isRunningAllocation ? "Optimizing..." : "Solve Optimal Budget"}</span>
          </button>

          {allocationResult ? (
            <div className="space-y-4">
              {/* Recommendation Badge */}
              <div
                className={`p-3 rounded-lg border text-xs ${
                  allocationResult.recommendation === "launch"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 uppercase">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Recommendation: {allocationResult.recommendation.replace("_", " ")}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed">
                  {allocationResult.recommendation_reason}
                </p>
              </div>

              {/* Comparison Table */}
              <div>
                <span className="font-bold text-[#17233B] block mb-1.5">Strategy Comparison</span>
                <div className="space-y-1.5">
                  <div className="p-2 rounded bg-[#F5F7FB] border border-[#E2E8F2] flex justify-between items-center">
                    <span className="text-[#52617A]">Equal Split:</span>
                    <span className="font-semibold text-[#17233B]">
                      {formatCurrency(allocationResult.comparison.equal_split.profit)} profit
                    </span>
                  </div>
                  <div className="p-2 rounded bg-indigo-50 border border-indigo-100 flex justify-between items-center text-[#5146D9] font-bold">
                    <span>Model-Based Optimal:</span>
                    <span>{formatCurrency(allocationResult.comparison.model_based.profit)} profit</span>
                  </div>
                </div>
              </div>

              {/* Allocated Cells */}
              <div>
                <span className="font-bold text-[#17233B] block mb-1.5">Audience Cell Allocation</span>
                <div className="space-y-2">
                  {allocationResult.cells.map((cell, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-[#E2E8F2] space-y-1">
                      <div className="flex justify-between font-semibold text-[#17233B]">
                        <span>{cell.persona_name}</span>
                        <span className="text-[#5146D9] tabular-nums">
                          {formatCurrency(cell.allocated_budget)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-[#52617A]">
                        <span>Channel: {cell.channel}</span>
                        <span>Exp Purchasers: {cell.expected_purchasers}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#F5F7FB] border border-[#E2E8F2] text-[11px] text-[#52617A]">
                Unspent Balance: <strong>{formatCurrency(allocationResult.unspent_budget)}</strong> (unprofitable marginal spend prevented).
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[#52617A] bg-[#F5F7FB] rounded-lg">
              Click &ldquo;Solve Optimal Budget&rdquo; to distribute media spend across deduplicated audience partitions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
