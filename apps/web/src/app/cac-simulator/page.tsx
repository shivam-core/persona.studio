"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent, formatNumber, formatPersonaName } from "@/lib/formatters";
import {
  Calculator,
  TrendingUp,
  Target,
  ArrowRight,
  Download,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Users,
  ShoppingBag,
  Zap,
  Layers,
  ArrowUpRight,
  Compass,
  Database,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { SimulationInputs, PersonaCard, Offering } from "@/lib/types";
import { NotionAnalyst } from "@/components/illustrations/NotionIllustrations";
import { useTheme } from "@/components/providers/ThemeProvider";

// Common acquisition channel benchmarks
interface ChannelBenchmark {
  id: string;
  name: string;
  defaultCpc: number;
  defaultConvRate: number;
  clicksPerContact: number;
  description: string;
}

const CHANNELS: ChannelBenchmark[] = [
  {
    id: "meta_social",
    name: "Meta Ads (Instagram & Facebook)",
    defaultCpc: 12.0,
    defaultConvRate: 0.038,
    clicksPerContact: 1.2,
    description: "Visual social discovery with persona interest targeting.",
  },
  {
    id: "google_search",
    name: "Google Ads (High-Intent Search)",
    defaultCpc: 24.0,
    defaultConvRate: 0.065,
    clicksPerContact: 1.1,
    description: "High purchase intent keyword matching.",
  },
  {
    id: "email_outreach",
    name: "Direct Email & Retention Outreach",
    defaultCpc: 2.5,
    defaultConvRate: 0.082,
    clicksPerContact: 1.0,
    description: "Warm subscribers and historical store visitors.",
  },
  {
    id: "influencer_partner",
    name: "Creator & Influencer Endorsement",
    defaultCpc: 18.0,
    defaultConvRate: 0.045,
    clicksPerContact: 1.3,
    description: "Niche creator campaigns with affiliate attribution.",
  },
];

export default function CACSimulatorPage() {
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

  // Query personas and offerings from backend
  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: api.getPersonas,
  });

  const { data: offerings } = useQuery({
    queryKey: ["offerings"],
    queryFn: api.getOfferings,
  });

  // Selected persona and offering alignments
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("meta_social");
  const [activeTab, setActiveTab] = useState<"sensitivity" | "unit_econ" | "channels" | "diagnosis">("sensitivity");

  // Core Simulation Inputs - Initialized to 0 by default until dataset is loaded
  const [variableBudget, setVariableBudget] = useState<number>(0);
  const [fixedCost, setFixedCost] = useState<number>(0);
  const [cpc, setCpc] = useState<number>(0);
  const [clicksPerPerson, setClicksPerPerson] = useState<number>(0);
  const [conversionProb, setConversionProb] = useState<number>(0);
  const [listPrice, setListPrice] = useState<number>(0);
  const [unitVariableCost, setUnitVariableCost] = useState<number>(0);
  const [discountFraction, setDiscountFraction] = useState<number>(0);
  const [refundFraction, setRefundFraction] = useState<number>(0);
  const [fulfillmentCost, setFulfillmentCost] = useState<number>(0);
  const [paymentFeeRate, setPaymentFeeRate] = useState<number>(0);
  const [ltvMultiplier, setLtvMultiplier] = useState<number>(0);

  // Auto-hydrate realistic parameters once a dataset exists
  useEffect(() => {
    if (hasData && variableBudget === 0) {
      setVariableBudget(50000);
      setFixedCost(5000);
      setCpc(12.0);
      setClicksPerPerson(1.2);
      setConversionProb(0.04);
      setListPrice(2500);
      setUnitVariableCost(850);
      setDiscountFraction(0.10);
      setRefundFraction(0.02);
      setFulfillmentCost(50);
      setPaymentFeeRate(0.02);
      setLtvMultiplier(1.6);
    } else if (!hasData && variableBudget > 0) {
      setVariableBudget(0);
      setFixedCost(0);
      setCpc(0);
      setClicksPerPerson(0);
      setConversionProb(0);
      setListPrice(0);
      setUnitVariableCost(0);
      setDiscountFraction(0);
      setRefundFraction(0);
      setFulfillmentCost(0);
      setPaymentFeeRate(0);
      setLtvMultiplier(0);
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

  // Selected entities
  const activePersona: PersonaCard | undefined = personas?.find((p) => p.id === selectedPersonaId) || personas?.[0];
  const activeOffering: Offering | undefined = offerings?.find((o) => o.id === selectedOfferingId) || offerings?.[0];
  const activeChannel = CHANNELS.find((c) => c.id === selectedChannelId) || CHANNELS[0];

  // Handle persona selection (auto-hydrates audience N, baseline conversion, and spend)
  const handleSelectPersona = (personaId: string) => {
    setSelectedPersonaId(personaId);
    const p = personas?.find((item) => item.id === personaId);
    if (p) {
      // Hydrate historical AOV if present in fingerprint
      const aov = p.fingerprint_json?.raw_values?.aov_lookback;
      if (aov && aov > 0) {
        setListPrice(Math.round(aov));
      }
      // Slightly adjust baseline conversion based on cluster
      if (p.audience_share > 0.4) {
        setConversionProb(0.045);
      } else {
        setConversionProb(0.035);
      }
    }
  };

  // Handle offering selection (auto-hydrates list price, COGS, category)
  const handleSelectOffering = (offeringId: string) => {
    setSelectedOfferingId(offeringId);
    const o = offerings?.find((item) => item.id === offeringId);
    if (o) {
      setListPrice(o.list_price);
      setUnitVariableCost(o.unit_variable_cost);
      if (o.fixed_campaign_cost_default) {
        setFixedCost(o.fixed_campaign_cost_default);
      }
    }
  };

  // Handle channel selection (updates benchmark CPC and CTR)
  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    const ch = CHANNELS.find((c) => c.id === channelId);
    if (ch) {
      setCpc(ch.defaultCpc);
      setConversionProb(ch.defaultConvRate);
      setClicksPerPerson(ch.clicksPerContact);
    }
  };

  // Apply scenario presets
  const applyPreset = (preset: "conservative" | "baseline" | "aggressive") => {
    if (preset === "conservative") {
      setCpc(Math.round(cpc * 1.5 * 10) / 10);
      setConversionProb(Math.max(0.01, Math.round(conversionProb * 0.7 * 1000) / 1000));
      setDiscountFraction(0.15);
    } else if (preset === "baseline") {
      setCpc(12.0);
      setConversionProb(0.04);
      setDiscountFraction(0.10);
      setVariableBudget(50000);
    } else if (preset === "aggressive") {
      setCpc(Math.max(4.0, Math.round(cpc * 0.8 * 10) / 10));
      setConversionProb(Math.min(0.12, Math.round(conversionProb * 1.35 * 1000) / 1000));
      setVariableBudget(150000);
    }
  };

  // Construct SimulationInputs
  const currentInputs: SimulationInputs = useMemo(() => ({
    delivery_model: activeChannel.id === "email_outreach" ? "direct_outreach" : "paid_cpc",
    objective: "acquisition",
    variable_budget: variableBudget,
    fixed_cost: fixedCost,
    cpc: cpc,
    clicks_per_person: clicksPerPerson,
    contact_cost_direct: cpc * clicksPerPerson,
    audience_n: activePersona?.audience_count ? activePersona.audience_count * 10 : 25000,
    conversion_probability: conversionProb,
    list_price: listPrice,
    discount_fraction: discountFraction,
    refund_fraction: refundFraction,
    unit_variable_cost: unitVariableCost,
    fulfillment_cost: fulfillmentCost,
    payment_fee_rate: paymentFeeRate,
    refund_handling_cost: 30,
    capacity_units: null,
    saturation_lambda: 0.3,
  }), [
    activeChannel.id,
    variableBudget,
    fixedCost,
    cpc,
    clicksPerPerson,
    activePersona?.audience_count,
    conversionProb,
    listPrice,
    discountFraction,
    refundFraction,
    unitVariableCost,
    fulfillmentCost,
    paymentFeeRate,
  ]);

  // Preview Query from Backend API
  const { data: simResult, isLoading: isSimulating } = useQuery({
    queryKey: ["cac-simulation-preview", currentInputs],
    queryFn: () => api.previewSimulation(currentInputs),
    enabled: hasData && variableBudget > 0,
  });

  // Core Derived CAC Metrics - Strictly 0 when no dataset is loaded
  const unitNetPrice = hasData ? listPrice * (1 - discountFraction) : 0;
  const unitProductCosts = hasData ? unitVariableCost + fulfillmentCost + (unitNetPrice * paymentFeeRate) : 0;
  const unitGrossMargin = hasData ? unitNetPrice - unitProductCosts : 0;
  const allowableCac = hasData ? (simResult?.allowable_cac ?? unitGrossMargin) : 0;

  // LTV modeling based on repeat orders
  const customerLTV = hasData ? unitGrossMargin * ltvMultiplier : 0;
  const modeledCac = hasData
    ? (simResult?.campaign_cac ?? (simResult?.expected_purchasers && simResult.expected_purchasers > 0
        ? (variableBudget + fixedCost) / simResult.expected_purchasers
        : 0))
    : 0;

  const ltvCacRatio = (hasData && modeledCac > 0) ? customerLTV / modeledCac : 0;
  const cacHealthStatus = !hasData
    ? { label: "Waiting for Dataset (0)", badgeClass: "studio-badge", color: "#64748B" }
    : ltvCacRatio >= 3.0
    ? { label: "Exceptional (LTV:CAC ≥ 3x)", badgeClass: "studio-badge-success", color: "#34D399" }
    : ltvCacRatio >= 2.0
    ? { label: "Healthy (LTV:CAC 2-3x)", badgeClass: "studio-badge text-sky-400 border-sky-500/30 bg-sky-500/10", color: "#38BDF8" }
    : ltvCacRatio >= 1.0
    ? { label: "Tight Margin (1-2x)", badgeClass: "studio-badge text-amber-400 border-amber-500/30 bg-amber-500/10", color: "#F59E0B" }
    : { label: "Cash Burning (CAC > Margin)", badgeClass: "studio-badge text-rose-400 border-rose-500/30 bg-rose-500/10", color: "#F43F5E" };

  const breakevenCpc = (hasData && clicksPerPerson > 0)
    ? (simResult?.break_even_cpc ?? (allowableCac * conversionProb) / clicksPerPerson)
    : 0;
  const breakevenConversion = (hasData && cpc > 0 && clicksPerPerson > 0 && allowableCac > 0 && variableBudget > 0)
    ? (simResult?.break_even_conversion ?? ((variableBudget + fixedCost) / ((variableBudget / (cpc * clicksPerPerson)) * allowableCac)))
    : 0;
  const expectedCustomers = hasData ? Math.round(simResult?.expected_purchasers ?? 0) : 0;
  const netContributionProfit = hasData ? (simResult?.contribution_profit ?? 0) : 0;

  // Sensitivity Matrix Grid: CPCs (Rows) vs Conversion Rates (Cols)
  const sensitivityCols = [0.015, 0.025, 0.040, 0.060, 0.085];
  const sensitivityRows = hasData
    ? [
        Math.round(cpc * 0.5 * 10) / 10,
        Math.round(cpc * 0.75 * 10) / 10,
        cpc,
        Math.round(cpc * 1.35 * 10) / 10,
        Math.round(cpc * 1.8 * 10) / 10,
      ]
    : [0, 0, 0, 0, 0];

  // Unit Economics Waterfall Chart Data
  const unitEconChartData = [
    { step: "Gross Price", amount: listPrice, color: "#6366F1" },
    { step: "Discount & Tax", amount: -(listPrice * discountFraction), color: "#F43F5E" },
    { step: "Product COGS", amount: -unitVariableCost, color: "#FB7185" },
    { step: "Fulfill & Fees", amount: -(fulfillmentCost + unitNetPrice * paymentFeeRate), color: "#F43F5E" },
    { step: "Allowable CAC", amount: allowableCac, color: "#38BDF8" },
    { step: "Modeled CAC", amount: -modeledCac, color: "#A855F7" },
    { step: "Net Profit / Buyer", amount: allowableCac - modeledCac, color: allowableCac >= modeledCac ? "#34D399" : "#F43F5E" },
  ];

  // Export CAC Analysis as CSV
  const handleExportCSV = () => {
    const rows = [
      ["Metric", "Value"],
      ["Persona", activePersona?.display_name || "Custom Target"],
      ["Offering", activeOffering?.name || "Curated Catalog"],
      ["Marketing Channel", activeChannel.name],
      ["Variable Ad Budget", `INR ${variableBudget}`],
      ["Fixed Campaign Cost", `INR ${fixedCost}`],
      ["Cost Per Click (CPC)", `INR ${cpc}`],
      ["Funnel Conversion Rate", `${(conversionProb * 100).toFixed(2)}%`],
      ["Product List Price", `INR ${listPrice}`],
      ["Unit COGS", `INR ${unitVariableCost}`],
      ["Unit Gross Margin (Allowable CAC)", `INR ${allowableCac.toFixed(2)}`],
      ["Modeled Customer Acquisition Cost (CAC)", `INR ${modeledCac.toFixed(2)}`],
      ["LTV : CAC Ratio", `${ltvCacRatio.toFixed(2)}x`],
      ["Maximum Breakeven CPC", `INR ${breakevenCpc.toFixed(2)}`],
      ["Minimum Breakeven Conversion", `${(breakevenConversion * 100).toFixed(2)}%`],
      ["Expected Acquired Customers", expectedCustomers],
      ["Projected Net Contribution Profit", `INR ${netContributionProfit.toFixed(2)}`],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cac_simulation_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Zero State Callout Banner with Notion Analyst Illustration */}
      {!hasData && (
        <div className="notion-callout border border-amber-300/80 dark:border-amber-500/30 bg-[#FBF8EF] dark:bg-[#252015] p-5 rounded-xl flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                CAC Simulator Zero State (No Records Loaded)
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed max-w-xl">
                CAC metrics, unit economics waterfall, and sensitivity models are initialized at zero. Upload a CSV file or click to load real store transaction records to unlock CAC modeling.
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
            <NotionAnalyst className="w-36 h-auto opacity-90" />
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--notion-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🧮</span>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>CAC Simulator</span>
              <span className="notion-pill-blue text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                Unit Economics Model
              </span>
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
            Model Customer Acquisition Costs (CAC), evaluate Allowable CAC thresholds against LTV, and discover maximum breakeven bidding limits across audience personas and channels.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="notion-btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
            title="Export simulation summary to CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <Link
            href={`/campaigns?offeringId=${activeOffering?.id || ""}&personaId=${activePersona?.id || ""}&budget=${variableBudget}`}
            className="notion-btn-primary text-xs flex items-center gap-1.5 py-1 px-2.5"
          >
            <span>Plan Campaign</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Top Metric Cards: 5 KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Modeled CAC */}
        <div className="notion-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Modeled CAC</span>
            <Target className="h-4 w-4 text-[#2383E2]" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
            {formatCurrency(modeledCac)}
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className={cacHealthStatus.badgeClass}>
              {modeledCac <= allowableCac ? "Profitable" : "Exceeds Margin"}
            </span>
          </div>
        </div>

        {/* Allowable CAC */}
        <div className="notion-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Allowable CAC (Cap)</span>
            <Calculator className="h-4 w-4 text-[#448361]" />
          </div>
          <div className="text-2xl font-bold text-[#448361] dark:text-[#529E72] tabular-nums">
            {formatCurrency(allowableCac)}
          </div>
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
            Unit contribution margin
          </div>
        </div>

        {/* LTV : CAC Ratio */}
        <div className="notion-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">LTV : CAC Ratio</span>
            <TrendingUp className="h-4 w-4 text-[#D9730D]" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
            {ltvCacRatio > 0 ? `${ltvCacRatio.toFixed(1)}x` : "0.0x"}
          </div>
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
            {ltvCacRatio >= 3.0 ? "Strong (Target ≥ 3x)" : "Payback: 1st Order"}
          </div>
        </div>

        {/* Breakeven CPC */}
        <div className="notion-card p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Breakeven CPC (Max)</span>
            <Zap className="h-4 w-4 text-[#CB912F]" />
          </div>
          <div className="text-2xl font-bold text-[#CB912F] dark:text-[#E7C15C] tabular-nums">
            {formatCurrency(breakevenCpc)}
          </div>
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
            Current: {formatCurrency(cpc)} ({breakevenCpc > cpc ? `${Math.round(((breakevenCpc - cpc) / breakevenCpc) * 100)}% buffer` : "0% buffer"})
          </div>
        </div>

        {/* Breakeven Conversion */}
        <div className="notion-card p-4 space-y-1 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Breakeven Conv.</span>
            <Compass className="h-4 w-4 text-[#9065B0]" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
            {formatPercent(breakevenConversion)}
          </div>
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
            Current: {formatPercent(conversionProb)}
          </div>
        </div>
      </div>

      {/* Main Simulator Workspace: Left Controls (5 cols) & Right Intelligence (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Input Controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* Alignment Selector Panel */}
          <div className="notion-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--notion-border)] pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#2383E2]" />
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Targeting & Scenario Setup</h2>
              </div>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Select studio assets</span>
            </div>

            {/* Quick Scenario Presets */}
            <div>
              <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Scenario Presets
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset("conservative")}
                  className="py-1.5 px-2 rounded-md border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 transition-colors text-center"
                >
                  Conservative
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("baseline")}
                  className="py-1.5 px-2 rounded-md border border-blue-500/30 bg-blue-50 dark:bg-blue-900/20 text-[11px] font-medium text-blue-700 dark:text-blue-300 transition-colors text-center"
                >
                  Target Baseline
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("aggressive")}
                  className="py-1.5 px-2 rounded-md border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 transition-colors text-center"
                >
                  Aggressive Scale
                </button>
              </div>
            </div>

            {/* Persona Studio Alignment */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[#2383E2]" />
                  Target Customer Persona
                </label>
                {activePersona && (
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    {formatNumber(activePersona.audience_count)} buyers
                  </span>
                )}
              </div>
              <select
                value={selectedPersonaId}
                onChange={(e) => handleSelectPersona(e.target.value)}
                className="w-full notion-input text-xs"
              >
                <option value="">Choose Audience Persona...</option>
                {personas?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatPersonaName(p.display_name)} ({p.audience_count} customers)
                  </option>
                ))}
              </select>
            </div>

            {/* Store Catalog / Offering Alignment */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-[#448361]" />
                  Store Product / Collection
                </label>
                {activeOffering && (
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    COGS: {formatCurrency(activeOffering.unit_variable_cost)}
                  </span>
                )}
              </div>
              <select
                value={selectedOfferingId}
                onChange={(e) => handleSelectOffering(e.target.value)}
                className="w-full notion-input text-xs"
              >
                <option value="">Choose Store Offering...</option>
                {offerings?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — {formatCurrency(o.list_price)}
                  </option>
                ))}
              </select>
            </div>

            {/* Channel Selection */}
            <div>
              <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Primary Marketing Channel
              </label>
              <select
                value={selectedChannelId}
                onChange={(e) => handleSelectChannel(e.target.value)}
                className="w-full notion-input text-xs"
              >
                {CHANNELS.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name} (Bench: {formatCurrency(ch.defaultCpc)} CPC, {(ch.defaultConvRate * 100).toFixed(1)}% CR)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Traffic & Bidding Controls Panel */}
          <div className="notion-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 border-b border-[var(--notion-border)] pb-3">
              Media Spend & Traffic Funnel
            </h2>

            {/* Budget Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Ad Campaign Budget</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
                  {formatCurrency(variableBudget)}
                </span>
              </div>
              <input
                type="range"
                min={10000}
                max={500000}
                step={5000}
                value={variableBudget}
                onChange={(e) => setVariableBudget(Number(e.target.value))}
                className="w-full accent-[#2383E2] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>₹10,000</span>
                <span>₹2,50,000</span>
                <span>₹5,00,000</span>
              </div>
            </div>

            {/* CPC Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Cost Per Click (CPC)</span>
                <span className="font-semibold text-[#D9730D] tabular-nums">
                  {formatCurrency(cpc)}
                </span>
              </div>
              <input
                type="range"
                min={2.0}
                max={60.0}
                step={0.5}
                value={cpc}
                onChange={(e) => setCpc(Number(e.target.value))}
                className="w-full accent-[#D9730D] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>₹2.00</span>
                <span>₹30.00</span>
                <span>₹60.00</span>
              </div>
            </div>

            {/* Funnel Conversion Rate Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Funnel Conversion Rate (CR)</span>
                <span className="font-semibold text-[#448361] dark:text-[#529E72] tabular-nums">
                  {formatPercent(conversionProb)}
                </span>
              </div>
              <input
                type="range"
                min={0.005}
                max={0.12}
                step={0.001}
                value={conversionProb}
                onChange={(e) => setConversionProb(Number(e.target.value))}
                className="w-full accent-[#448361] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>0.5%</span>
                <span>6.0%</span>
                <span>12.0%</span>
              </div>
            </div>

            {/* Clicks Per Person */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                  Clicks per Buyer
                </label>
                <input
                  type="number"
                  min={1.0}
                  max={5.0}
                  step={0.1}
                  value={clicksPerPerson}
                  onChange={(e) => setClicksPerPerson(Number(e.target.value))}
                  className="w-full notion-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                  Fixed Campaign Ops
                </label>
                <input
                  type="number"
                  min={0}
                  max={50000}
                  step={1000}
                  value={fixedCost}
                  onChange={(e) => setFixedCost(Number(e.target.value))}
                  className="w-full notion-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Unit Margins & LTV Horizon Panel */}
          <div className="notion-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 border-b border-[var(--notion-border)] pb-3">
              Unit Economics & Retention Horizon
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                  Product Price (AOV)
                </label>
                <input
                  type="number"
                  min={100}
                  max={50000}
                  step={50}
                  value={listPrice}
                  onChange={(e) => setListPrice(Number(e.target.value))}
                  className="w-full notion-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                  Product COGS (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30000}
                  step={50}
                  value={unitVariableCost}
                  onChange={(e) => setUnitVariableCost(Number(e.target.value))}
                  className="w-full notion-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                  Promotional Discount
                </label>
                <select
                  value={discountFraction}
                  onChange={(e) => setDiscountFraction(Number(e.target.value))}
                  className="w-full notion-input text-xs"
                >
                  <option value={0}>0% (No Discount)</option>
                  <option value={0.05}>5% Off</option>
                  <option value={0.10}>10% Off</option>
                  <option value={0.15}>15% Off</option>
                  <option value={0.20}>20% Off</option>
                  <option value={0.30}>30% Off</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                  LTV Orders Multiplier
                </label>
                <select
                  value={ltvMultiplier}
                  onChange={(e) => setLtvMultiplier(Number(e.target.value))}
                  className="w-full notion-input text-xs"
                >
                  <option value={1.0}>1.0x (1st Order Only)</option>
                  <option value={1.3}>1.3x (Low Repeat)</option>
                  <option value={1.6}>1.6x (Store Average)</option>
                  <option value={2.2}>2.2x (Loyal Shoppers)</option>
                  <option value={3.5}>3.5x (VIP Cohort)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visual CAC Intelligence (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* CAC Health & Quick Diagnosis Banner */}
          <div className="notion-card p-5 border-l-4" style={{ borderLeftColor: cacHealthStatus.color }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cacHealthStatus.badgeClass}>
                    {cacHealthStatus.label}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">
                    Net Profit per Customer: <strong className="text-neutral-900 dark:text-neutral-100">{formatCurrency(allowableCac - modeledCac)}</strong>
                  </span>
                </div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mt-1.5">
                  {modeledCac <= allowableCac
                    ? `CAC of ${formatCurrency(modeledCac)} is safely within your ${formatCurrency(allowableCac)} Allowable Cap.`
                    : `Warning: Modeled CAC of ${formatCurrency(modeledCac)} exceeds the ${formatCurrency(allowableCac)} margin threshold.`}
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                  {modeledCac <= allowableCac
                    ? `At current bids, you generate ${formatCurrency(netContributionProfit)} in net contribution profit across ${expectedCustomers} acquired customers with a ${ltvCacRatio.toFixed(1)}x LTV:CAC multiplier.`
                    : `You lose ${formatCurrency(modeledCac - allowableCac)} on each acquired customer. Lower CPC to below ${formatCurrency(breakevenCpc)} or increase conversion rate above ${formatPercent(breakevenConversion)} to reach breakeven.`}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400">Projected Net Profit</div>
                <div className={`text-xl font-bold tabular-nums ${netContributionProfit >= 0 ? "text-[#448361] dark:text-[#529E72]" : "text-[#E03E3E]"}`}>
                  {formatCurrency(netContributionProfit)}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {expectedCustomers} buyers acquired
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs for Analysis Views */}
          <div className="flex border-b border-[var(--notion-border)] text-xs font-medium">
            <button
              onClick={() => setActiveTab("sensitivity")}
              className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "sensitivity"
                  ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 font-semibold"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              <Target className="h-3.5 w-3.5" />
              <span>Sensitivity Matrix (Heatmap)</span>
            </button>

            <button
              onClick={() => setActiveTab("unit_econ")}
              className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "unit_econ"
                  ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 font-semibold"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>LTV vs CAC Waterfall</span>
            </button>

            <button
              onClick={() => setActiveTab("channels")}
              className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "channels"
                  ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 font-semibold"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Channel Benchmarks</span>
            </button>

            <button
              onClick={() => setActiveTab("diagnosis")}
              className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "diagnosis"
                  ? "border-neutral-900 dark:border-neutral-100 text-neutral-900 dark:text-neutral-100 font-semibold"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Advisory Insights</span>
            </button>
          </div>

          {/* Tab 1: Sensitivity Matrix (Heatmap) */}
          {activeTab === "sensitivity" && (
            <div className="notion-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--notion-border)] pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    CAC Sensitivity Heatmap (CPC vs Conversion Rate)
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Modeled CAC across bidding costs and funnel efficiency. Green indicates profit; Red indicates loss.
                  </p>
                </div>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Allowable Cap: {formatCurrency(allowableCac)}
                </span>
              </div>

              {/* Heatmap Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--notion-border)] text-[11px] text-neutral-500 dark:text-neutral-400">
                      <th className="p-2 font-medium">Bidding (CPC)</th>
                      {sensitivityCols.map((colCr) => (
                        <th key={colCr} className="p-2 text-center font-medium">
                          {(colCr * 100).toFixed(1)}% Conv
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--notion-border)] font-mono text-xs">
                    {sensitivityRows.map((rowCpc) => {
                      const isCurrentRow = Math.abs(rowCpc - cpc) < 0.1;

                      return (
                        <tr key={rowCpc} className={isCurrentRow ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}>
                          <td className="p-2 font-sans font-semibold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                            {formatCurrency(rowCpc)}
                            {isCurrentRow && (
                              <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                Current
                              </span>
                            )}
                          </td>
                          {sensitivityCols.map((colCr) => {
                            // Calculate CAC for this specific cell
                            const cellCac = (rowCpc * clicksPerPerson) / colCr;
                            const isCellProfitable = cellCac <= allowableCac;
                            const ratio = allowableCac > 0 ? cellCac / allowableCac : 2;
                            const isCurrentCell = isCurrentRow && Math.abs(colCr - conversionProb) < 0.005;

                            let cellBg = "bg-[#FFE2DD] dark:bg-[#522E2A] text-[#D44040] dark:text-[#FF8080] border-[#FFC7BD] dark:border-[#6B3B36]";
                            if (ratio < 0.6) {
                              cellBg = "bg-[#DBEDDB] dark:bg-[#1C3829] text-[#287042] dark:text-[#70C090] border-[#C3E4C3] dark:border-[#274F3A]";
                            } else if (ratio <= 0.85) {
                              cellBg = "bg-[#EBF5EB] dark:bg-[#183022] text-[#34804E] dark:text-[#82CF9E] border-[#D4EDD4] dark:border-[#214331]";
                            } else if (ratio <= 1.0) {
                              cellBg = "bg-[#FDECC8] dark:bg-[#4D3A1B] text-[#A66C00] dark:text-[#E8BA60] border-[#FCE1A8] dark:border-[#664D24]";
                            }

                            return (
                              <td key={colCr} className="p-1.5 text-center">
                                <div
                                  className={`py-1.5 px-2 rounded border font-semibold tabular-nums transition-all ${cellBg} ${
                                    isCurrentCell ? "ring-2 ring-blue-500 scale-105 shadow-md" : ""
                                  }`}
                                  title={`CPC: ₹${rowCpc}, CR: ${(colCr * 100).toFixed(1)}% -> CAC: ₹${Math.round(cellCac)}`}
                                >
                                  {formatCurrency(cellCac)}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Heatmap Legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--notion-border)] text-[11px] text-neutral-500 dark:text-neutral-400">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded bg-[#448361]" />
                    <span>High Profit (&lt;60% Cap)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded bg-[#CB912F]" />
                    <span>Breakeven Buffer (85-100%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded bg-[#E03E3E]" />
                    <span>Loss Making (&gt;100% Cap)</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[#2383E2]">
                  <span className="h-2 w-2 rounded-full border border-[#2383E2]" />
                  <span>Active Position Highlighted</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: LTV vs CAC Unit Economics Waterfall */}
          {activeTab === "unit_econ" && (
            <div className="notion-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--notion-border)] pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Per-Customer Unit Economics (Order Value to Net Profit)
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Shows exactly where customer revenue goes before and after marketing acquisition costs.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">12-Month LTV:</span>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums text-xs">
                    {formatCurrency(customerLTV)}
                  </div>
                </div>
              </div>

              {/* Waterfall Bar Chart */}
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={unitEconChartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                    <XAxis
                      dataKey="step"
                      stroke="#888888"
                      fontSize={10}
                      tickLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(val) => `₹${Math.abs(val)}`}
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
                      {unitEconChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--notion-border)] text-center text-xs">
                <div className="p-2.5 rounded-lg bg-[var(--notion-sidebar-bg)] border border-[var(--notion-border)]">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Gross Margin %</span>
                  <div className="font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                    {formatPercent(unitNetPrice > 0 ? allowableCac / unitNetPrice : 0)}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--notion-sidebar-bg)] border border-[var(--notion-border)]">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">CAC % of Order Value</span>
                  <div className="font-bold text-[#2383E2] mt-0.5">
                    {formatPercent(unitNetPrice > 0 ? modeledCac / unitNetPrice : 0)}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--notion-sidebar-bg)] border border-[var(--notion-border)]">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Net Profit Margin %</span>
                  <div className={`font-bold mt-0.5 ${allowableCac >= modeledCac ? "text-[#448361] dark:text-[#529E72]" : "text-[#E03E3E]"}`}>
                    {formatPercent(unitNetPrice > 0 ? (allowableCac - modeledCac) / unitNetPrice : 0)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Channel Benchmarks */}
          {activeTab === "channels" && (
            <div className="notion-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--notion-border)] pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Cross-Channel CAC & Customer Yield
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Projections across acquisition channels with a ₹{formatNumber(variableBudget)} media budget.
                  </p>
                </div>
                <span className="notion-pill-blue text-[10px] px-2 py-0.5 rounded font-medium">
                  4 Channels Benchmarked
                </span>
              </div>

              <div className="space-y-3">
                {CHANNELS.map((ch) => {
                  const chCostPerContact = ch.defaultCpc * ch.clicksPerContact;
                  const chContacts = variableBudget / chCostPerContact;
                  const chBuyers = Math.round(chContacts * ch.defaultConvRate);
                  const chCac = chBuyers > 0 ? (variableBudget + fixedCost) / chBuyers : 0;
                  const isChProfitable = chCac <= allowableCac;
                  const isCurrent = ch.id === selectedChannelId;

                  return (
                    <div
                      key={ch.id}
                      onClick={() => handleSelectChannel(ch.id)}
                      className={`p-3.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        isCurrent
                          ? "border-[#2383E2] bg-blue-50/60 dark:bg-blue-950/30 shadow-sm"
                          : "border-[var(--notion-border)] bg-[var(--notion-card-bg)] hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">{ch.name}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-[#2383E2] text-[10px] font-bold">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-neutral-500 dark:text-neutral-400">CAC:</span>
                          <span className={`font-bold text-sm ${isChProfitable ? "text-[#448361] dark:text-[#529E72]" : "text-[#E03E3E]"}`}>
                            {formatCurrency(chCac)}
                          </span>
                        </div>
                      </div>

                      <p className="text-neutral-500 dark:text-neutral-400 text-[11px] mt-1">{ch.description}</p>

                      <div className="grid grid-cols-4 gap-2 pt-2.5 mt-2.5 border-t border-[var(--notion-border)] text-[11px]">
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400">Avg CPC:</span>
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(ch.defaultCpc)}</div>
                        </div>
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400">Conv. Rate:</span>
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100">{(ch.defaultConvRate * 100).toFixed(1)}%</div>
                        </div>
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400">Expected Buyers:</span>
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100">{chBuyers} buyers</div>
                        </div>
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400">Status:</span>
                          <div className={`font-semibold ${isChProfitable ? "text-[#448361] dark:text-[#529E72]" : "text-[#E03E3E]"}`}>
                            {isChProfitable ? "Profitable" : "Unprofitable"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 4: Advisory Insights & Levers */}
          {activeTab === "diagnosis" && (
            <div className="notion-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--notion-border)] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#D9730D]" />
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    CAC Optimization Levers & Advisory Diagnosis
                  </h3>
                </div>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Automated Strategy Review</span>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                {/* Insight 1: Bidding Ceiling */}
                <div className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-1">
                  <div className="flex items-center gap-1.5 text-[#D9730D] font-semibold">
                    <Zap className="h-3.5 w-3.5" />
                    <span>Maximum Safe Bidding Ceiling: {formatCurrency(breakevenCpc)}</span>
                  </div>
                  <p className="text-neutral-700 dark:text-neutral-300">
                    Your allowable gross margin per buyer is {formatCurrency(allowableCac)}. Given your {formatPercent(conversionProb)} conversion rate, paying more than <strong>{formatCurrency(breakevenCpc)} per click</strong> will cause immediate cash loss on customer acquisition.
                  </p>
                </div>

                {/* Insight 2: Conversion Impact */}
                <div className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-1">
                  <div className="flex items-center gap-1.5 text-[#448361] dark:text-[#529E72] font-semibold">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Conversion Rate Sensitivity (+1% Impact)</span>
                  </div>
                  <p className="text-neutral-700 dark:text-neutral-300">
                    Increasing your funnel conversion rate from {formatPercent(conversionProb)} to {formatPercent(conversionProb + 0.01)} will reduce your CAC from {formatCurrency(modeledCac)} to <strong>{formatCurrency((cpc * clicksPerPerson) / (conversionProb + 0.01))}</strong>, adding approximately <strong>+{Math.round(expectedCustomers * 0.25)} extra buyers</strong> without spending an additional rupee on ads.
                  </p>
                </div>

                {/* Insight 3: Persona Target Affinity */}
                <div className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-1">
                  <div className="flex items-center gap-1.5 text-[#2383E2] font-semibold">
                    <Users className="h-3.5 w-3.5" />
                    <span>Audience Persona Alignment</span>
                  </div>
                  <p className="text-neutral-700 dark:text-neutral-300">
                    Currently targeting <strong>{formatPersonaName(activePersona?.display_name)}</strong> with <strong>{activeOffering?.name || "Curated Products"}</strong>. High-affinity matches historical repeat rates by {ltvMultiplier}x, expanding your allowable CAC headroom to {formatCurrency(customerLTV)}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Hand-Off Integration Bar */}
          <div className="notion-callout p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-[#2383E2] shrink-0" />
              <span className="text-neutral-700 dark:text-neutral-300">
                Ready to execute this budget and acquisition model in an active marketing brief?
              </span>
            </div>

            <Link
              href={`/campaigns?offeringId=${activeOffering?.id || ""}&personaId=${activePersona?.id || ""}&budget=${variableBudget}`}
              className="notion-btn-primary text-xs shrink-0 flex items-center gap-1.5 py-1 px-3 self-end sm:self-auto"
            >
              <span>Transfer to Campaign Planner</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
