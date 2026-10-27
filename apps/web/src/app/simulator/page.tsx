"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import {
  TrendingUp,
  Sliders,
  Play,
  CheckCircle2,
  PieChart as PieIcon,
  Calculator,
  ArrowRight,
  Database,
  AlertCircle,
} from "lucide-react";
import { NotionAnalyst } from "@/components/illustrations/NotionIllustrations";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import {
  DeliveryModel,
  CampaignObjective,
  SimulationInputs,
  MonteCarloSummary,
  AllocationResult,
} from "@/lib/types";

export default function SimulatorPage() {
  const queryClient = useQueryClient();
  const [isLoadingReal, setIsLoadingReal] = useState(false);

  const { data: datasets } = useQuery({
    queryKey: ["datasets"],
    queryFn: api.getDatasets,
  });

  const activeDataset = datasets?.[0];
  const hasData = Boolean(
    activeDataset &&
      (activeDataset.accepted_rows > 0 ||
        (activeDataset.row_counts?.customers ?? 0) > 0)
  );

  // Core Economic Inputs - Default to 0 when no dataset is loaded
  const [deliveryModel, setDeliveryModel] = useState<DeliveryModel>("paid_cpc");
  const [objective, setObjective] = useState<CampaignObjective>("acquisition");
  const [variableBudget, setVariableBudget] = useState<number>(0);
  const [fixedCost, setFixedCost] = useState<number>(0);
  const [cpc, setCpc] = useState<number>(0);
  const [clicksPerPerson, setClicksPerPerson] = useState<number>(0);
  const [audienceN, setAudienceN] = useState<number>(0);
  const [conversionProb, setConversionProb] = useState<number>(0);
  const [listPrice, setListPrice] = useState<number>(0);
  const [discountFraction, setDiscountFraction] = useState<number>(0);
  const [unitVariableCost, setUnitVariableCost] = useState<number>(0);

  // Auto-hydrate realistic parameters once a dataset exists
  useEffect(() => {
    if (hasData && variableBudget === 0) {
      setVariableBudget(35000);
      setFixedCost(5000);
      setCpc(12);
      setClicksPerPerson(1.0);
      setAudienceN(10000);
      setConversionProb(0.045);
      setListPrice(1500);
      setDiscountFraction(0.1);
      setUnitVariableCost(550);
    } else if (!hasData && variableBudget > 0) {
      setVariableBudget(0);
      setFixedCost(0);
      setCpc(0);
      setClicksPerPerson(0);
      setAudienceN(0);
      setConversionProb(0);
      setListPrice(0);
      setDiscountFraction(0);
      setUnitVariableCost(0);
    }
  }, [hasData]);

  const handleLoadRealData = async () => {
    try {
      setIsLoadingReal(true);
      await api.importRealBundle();
      await queryClient.invalidateQueries();
    } catch (err: any) {
      alert("Failed to load dataset: " + err.message);
    } finally {
      setIsLoadingReal(false);
    }
  };

  // Scenario selection: 'base' | 'conservative' | 'optimistic'
  const [scenarioTab, setScenarioTab] = useState<"base" | "conservative" | "optimistic">("base");

  // Forecast results
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
    contact_cost_direct: 2.5,
    audience_n: audienceN,
    conversion_probability:
      scenarioTab === "conservative"
        ? Math.max(0.001, conversionProb * 0.7)
        : scenarioTab === "optimistic"
        ? Math.min(1.0, conversionProb * 1.3)
        : conversionProb,
    list_price: listPrice,
    discount_fraction: discountFraction,
    refund_fraction: 0.02,
    unit_variable_cost: unitVariableCost,
    fulfillment_cost: 50,
    payment_fee_rate: 0.02,
    refund_handling_cost: 30,
    capacity_units: null,
    saturation_lambda: 0.5,
  };

  // Preview Query
  const { data: simResult } = useQuery({
    queryKey: ["sim-preview", currentInputs],
    queryFn: () => api.previewSimulation(currentInputs),
    enabled: hasData && variableBudget > 0 && audienceN > 0,
  });

  // Run Forecast Distribution
  const handleRunForecast = async () => {
    try {
      setIsRunningMc(true);
      const res = await api.runMonteCarlo(currentInputs, 1000, 42);
      setMcSummary(res);
    } catch (err: any) {
      alert("Forecast calculation failed: " + err.message);
    } finally {
      setIsRunningMc(false);
    }
  };

  // Run Smart Budget Allocation
  const handleRunAllocation = async () => {
    try {
      setIsRunningAllocation(true);
      const cells = [
        {
          cell_id: "cell_1",
          persona_id: "seg_core",
          persona_name: "Core Frequent Shoppers",
          channel: "Paid Social CPC",
          audience_n: 5000,
          cost_per_contact: cpc * clicksPerPerson,
          unit_cost: cpc * clicksPerPerson,
          baseline_conversion: conversionProb,
          conversion_prob: conversionProb,
          margin: listPrice * (1 - discountFraction) - unitVariableCost,
        },
        {
          cell_id: "cell_2",
          persona_id: "seg_luxury",
          persona_name: "High-AOV Luxury Buyers",
          channel: "Direct Email Outreach",
          audience_n: 2000,
          cost_per_contact: 2.5,
          unit_cost: 2.5,
          baseline_conversion: conversionProb * 1.5,
          conversion_prob: conversionProb * 1.5,
          margin: listPrice * 1.6 - unitVariableCost * 1.2,
        },
      ];

      const res = await api.runAllocation(cells, variableBudget + fixedCost, fixedCost);
      setAllocationResult(res);
    } catch (err: any) {
      alert("Allocation failed: " + err.message);
    } finally {
      setIsRunningAllocation(false);
    }
  };

  // Waterfall Chart Data
  const waterfallData = simResult
    ? [
        { step: "Gross Revenue", amount: simResult.net_revenue, color: "#6366F1" },
        { step: "Cost of Goods", amount: simResult.variable_costs, color: "#F43F5E" },
        { step: "Gross Margin", amount: Math.abs(simResult.contribution_before_marketing), color: "#38BDF8" },
        { step: "Ad Spend", amount: simResult.variable_marketing_spend, color: "#F43F5E" },
        { step: "Fixed Ops", amount: simResult.fixed_marketing_cost, color: "#FB7185" },
        { step: "Net Profit", amount: Math.abs(simResult.contribution_profit), color: simResult.contribution_profit >= 0 ? "#34D399" : "#F43F5E" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Zero State Callout Banner with Notion Illustration */}
      {!hasData && (
        <div className="notion-callout border border-amber-300/80 dark:border-amber-500/30 bg-[#FBF8EF] dark:bg-[#252015] p-5 rounded-xl flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Revenue Forecast Zero State (No Dataset Loaded)
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed max-w-xl">
                Financial forecast models, conversion assumptions, and return estimates are initialized at zero. Upload a CSV file or click to load our preloaded retail dataset to forecast campaign revenue.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleLoadRealData}
                  disabled={isLoadingReal}
                  className="notion-btn-primary text-xs py-1.5 px-3"
                >
                  <Database className={`h-3.5 w-3.5 ${isLoadingReal ? "animate-spin" : ""}`} />
                  <span>{isLoadingReal ? "Loading Records..." : "Load Retail Dataset (1-Click)"}</span>
                </button>
              </div>
            </div>
          </div>
          <div className="shrink-0 flex justify-center">
            <NotionAnalyst className="w-32 h-auto opacity-90" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--notion-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📈</span>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>Revenue & Profit Forecast</span>
              <span className="notion-pill-green text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                Monte Carlo Engine
              </span>
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
            Model campaign acquisition costs, expected conversion rates, profit margins, and return on investment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/cac-simulator"
            className="notion-btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
          >
            <Calculator className="h-3.5 w-3.5 text-[#2383E2]" />
            <span>Dedicated CAC Simulator</span>
          </Link>
          <button
            onClick={() => {
              setVariableBudget(35000);
              setCpc(12);
              setConversionProb(0.045);
              setListPrice(1500);
              setUnitVariableCost(550);
              setDiscountFraction(0.1);
            }}
            className="notion-btn-secondary text-xs py-1 px-2.5"
          >
            Reset Benchmark
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Inputs & Assumptions (5 Cols) */}
        <div className="lg:col-span-5 notion-card p-6 space-y-5 text-xs">
          <div className="border-b border-[var(--notion-border)] pb-3">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Campaign Assumptions
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Cost per contact, audience sizing, and product pricing
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Channel Model</label>
              <select
                value={deliveryModel}
                onChange={(e) => setDeliveryModel(e.target.value as DeliveryModel)}
                className="w-full notion-input text-xs"
              >
                <option value="paid_cpc">Paid CPC (Social Ads)</option>
                <option value="direct_outreach">Direct (Email/SMS)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Campaign Goal</label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as CampaignObjective)}
                className="w-full notion-input text-xs"
              >
                <option value="acquisition">Acquisition</option>
                <option value="retention">Retention</option>
                <option value="reactivation">Winback</option>
              </select>
            </div>
          </div>

          {/* Budget Range */}
          <div className="space-y-2 pt-2 border-t border-[var(--notion-border)]">
            <div className="flex justify-between items-center">
              <label className="font-medium text-neutral-700 dark:text-neutral-300">
                Marketing Media Budget:
              </label>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {formatCurrency(variableBudget)}
              </span>
            </div>
            <input
              type="range"
              min={5000}
              max={150000}
              step={5000}
              value={variableBudget}
              onChange={(e) => setVariableBudget(Number(e.target.value))}
              className="w-full accent-[#2383E2] cursor-pointer"
            />
          </div>

          {/* Key Parameters */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--notion-border)]">
            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Cost Per Click (₹)
              </label>
              <input
                type="number"
                value={cpc}
                onChange={(e) => setCpc(Number(e.target.value))}
                className="w-full notion-input text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Conversion Rate (%)
              </label>
              <input
                type="number"
                step="0.005"
                value={conversionProb}
                onChange={(e) => setConversionProb(Number(e.target.value))}
                className="w-full notion-input text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Product Price (₹)
              </label>
              <input
                type="number"
                value={listPrice}
                onChange={(e) => setListPrice(Number(e.target.value))}
                className="w-full notion-input text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Product Cost COGS (₹)
              </label>
              <input
                type="number"
                value={unitVariableCost}
                onChange={(e) => setUnitVariableCost(Number(e.target.value))}
                className="w-full notion-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Projected Returns & Scenarios (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Scenario Tabs & Tiles */}
          <div className="notion-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--notion-border)] pb-4">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Projected Financial Return
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Expected sales volume and net contribution
                </p>
              </div>

              {/* Scenario Toggle */}
              <div className="flex bg-[var(--notion-sidebar-bg)] p-1 rounded-md border border-[var(--notion-border)] text-xs font-medium">
                <button
                  onClick={() => setScenarioTab("conservative")}
                  className={`px-2.5 py-1 rounded transition-all ${
                    scenarioTab === "conservative" ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm font-semibold" : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  Conservative
                </button>
                <button
                  onClick={() => setScenarioTab("base")}
                  className={`px-2.5 py-1 rounded transition-all ${
                    scenarioTab === "base" ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm font-semibold" : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  Expected
                </button>
                <button
                  onClick={() => setScenarioTab("optimistic")}
                  className={`px-2.5 py-1 rounded transition-all ${
                    scenarioTab === "optimistic" ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm font-semibold" : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  Optimistic
                </button>
              </div>
            </div>

            {/* 4 Metric Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)]">
                <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">New Buyers</span>
                <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 tabular-nums">
                  {formatNumber(simResult?.expected_purchasers ?? 0)}
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)]">
                <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">Net Revenue</span>
                <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 tabular-nums">
                  {formatCurrency(simResult?.net_revenue ?? 0)}
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)]">
                <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">Total Ad Spend</span>
                <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 tabular-nums">
                  {formatCurrency(
                    (simResult?.variable_marketing_spend ?? 0) + (simResult?.fixed_marketing_cost ?? 0)
                  )}
                </div>
              </div>

              <div
                className={`p-3.5 rounded-lg border ${
                  (simResult?.contribution_profit ?? 0) >= 0
                    ? "bg-[#DBEDDB] dark:bg-[#1C3829] border-[#C3E4C3] dark:border-[#274F3A]"
                    : "bg-[#FFE2DD] dark:bg-[#522E2A] border-[#FFC7BD] dark:border-[#6B3B36]"
                }`}
              >
                <span className="text-neutral-600 dark:text-neutral-300 text-[11px]">Projected Profit</span>
                <div
                  className={`text-xl font-bold mt-1 tabular-nums ${
                    (simResult?.contribution_profit ?? 0) >= 0 ? "text-[#287042] dark:text-[#70C090]" : "text-[#D44040] dark:text-[#FF8080]"
                  }`}
                >
                  {formatCurrency(simResult?.contribution_profit ?? 0)}
                </div>
              </div>
            </div>

            {/* Profit Waterfall Chart */}
            <div className="pt-2">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block mb-2">
                Profit Breakdown (Revenue to Net Contribution)
              </span>
              <div className="h-[160px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <XAxis dataKey="step" tick={{ fontSize: 10, fill: "var(--notion-text)" }} stroke="var(--notion-border)" />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--notion-text)" }}
                      stroke="var(--notion-border)"
                      tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), "Amount"]}
                      contentStyle={{
                        backgroundColor: "var(--notion-card-bg)",
                        borderColor: "var(--notion-border)",
                        borderRadius: "8px",
                        color: "var(--notion-text)",
                        fontSize: "11px",
                      }}
                    />
                    <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                      {waterfallData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Scenario Distribution & Risk Bounds */}
          <div className="notion-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--notion-border)] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Projected Return Distribution
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Calculates conservative, expected, and growth upside outcomes
                </p>
              </div>
              <button
                onClick={handleRunForecast}
                disabled={isRunningMc}
                className="notion-btn-primary text-xs"
              >
                <Play className={`h-3 w-3 ${isRunningMc ? "animate-spin" : ""}`} />
                <span>{isRunningMc ? "Calculating..." : "Run Forecast"}</span>
              </button>
            </div>

            {mcSummary ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[var(--notion-sidebar-bg)] border border-[var(--notion-border)]">
                  <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Expected Profit</span>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">{formatCurrency(mcSummary.median_profit)}</div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--notion-sidebar-bg)] border border-[var(--notion-border)]">
                  <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Conservative Bound</span>
                  <div className="font-semibold text-[#E03E3E] mt-0.5">{formatCurrency(mcSummary.p10_profit)}</div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--notion-sidebar-bg)] border border-[var(--notion-border)]">
                  <span className="text-neutral-500 dark:text-neutral-400 text-[10px]">Growth Upside</span>
                  <div className="font-semibold text-[#448361] dark:text-[#529E72] mt-0.5">{formatCurrency(mcSummary.p90_profit)}</div>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40">
                  <span className="text-[#448361] dark:text-[#529E72] text-[10px]">Profitable Probability</span>
                  <div className="font-semibold text-[#448361] dark:text-[#529E72] mt-0.5">{formatPercent(mcSummary.probability_positive_profit)}</div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-neutral-500 dark:text-neutral-400 bg-[var(--notion-sidebar-bg)] rounded-lg border border-[var(--notion-border)]">
                Click &ldquo;Run Forecast&rdquo; to simulate risk distribution and calculate conservative bounds.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
