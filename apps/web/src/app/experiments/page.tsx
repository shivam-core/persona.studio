"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent, formatPersonaName } from "@/lib/formatters";
import {
  FlaskConical,
  Play,
  Download,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Layers,
  Sparkles,
  BarChart3,
  Percent,
  Database,
  AlertCircle,
} from "lucide-react";
import { NotionHeroTrio } from "@/components/illustrations/NotionIllustrations";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { Experiment, ExperimentAnalysis, Offering } from "@/lib/types";

export default function ExperimentsPage() {
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

  const [selectedExperimentId, setSelectedExperimentId] = useState<string>("");
  const [expName, setExpName] = useState("Holiday VIP Reactivation Lift Test");
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [targetMDE, setTargetMDE] = useState<number>(0.025);
  const [baselineConversion, setBaselineConversion] = useState<number>(0.05);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isGeneratingOutcomes, setIsGeneratingOutcomes] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Auto-dismiss notification after 4s
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  const { data: experiments, isLoading: isLoadingExperiments } = useQuery({
    queryKey: ["experiments"],
    queryFn: api.getExperiments,
  });

  const { data: offerings } = useQuery({
    queryKey: ["offerings"],
    queryFn: api.getOfferings,
  });

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: api.getPersonas,
  });

  // Select active experiment
  const activeExperiment: Experiment | undefined =
    experiments?.find((e) => e.id === selectedExperimentId) || experiments?.[0];

  useEffect(() => {
    if (activeExperiment && !selectedExperimentId) {
      setSelectedExperimentId(activeExperiment.id);
    }
  }, [activeExperiment, selectedExperimentId]);

  const { data: analysis, isLoading: isLoadingAnalysis } = useQuery<ExperimentAnalysis | null>({
    queryKey: ["experiment-analysis", activeExperiment?.id],
    queryFn: () => (activeExperiment ? api.getExperimentAnalysis(activeExperiment.id) : null),
    enabled: !!activeExperiment?.id,
  });

  // Sample size calculation per arm
  const p = baselineConversion;
  const d = Math.max(0.005, targetMDE);
  const calculatedSampleSizePerArm = hasData
    ? Math.max(100, Math.round((16 * p * (1 - p)) / (d * d)))
    : 0;

  const handleRegisterExperiment = async () => {
    try {
      setIsRegistering(true);
      const res = await api.createExperiment({
        name: expName,
        offering_id: selectedOfferingId || offerings?.[0]?.id || "",
        persona_ids: personas?.[0]?.id ? [personas[0].id] : [],
        baseline_conversion: baselineConversion,
        target_mde: targetMDE,
        alpha: 0.05,
        target_power: 0.8,
      });
      await queryClient.invalidateQueries({ queryKey: ["experiments"] });
      setSelectedExperimentId(res.id);
      setNotification({
        type: "success",
        message: `Created test "${expName}" with 50/50 test & control split!`,
      });
    } catch (err: any) {
      setNotification({
        type: "error",
        message: "Failed to create test: " + err.message,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSeedSyntheticOutcomes = async (
    effectType: "positive" | "zero" | "negative"
  ) => {
    if (!activeExperiment) return;
    try {
      setIsGeneratingOutcomes(true);
      const res = await api.seedSyntheticOutcomes(activeExperiment.id, effectType);
      await queryClient.invalidateQueries({ queryKey: ["experiment-analysis", activeExperiment.id] });
      await queryClient.invalidateQueries({ queryKey: ["experiments"] });
      setNotification({
        type: "success",
        message: res.message || `Recorded ${effectType} lift test outcome!`,
      });
    } catch (err: any) {
      setNotification({
        type: "error",
        message: "Failed to record outcome: " + err.message,
      });
    } finally {
      setIsGeneratingOutcomes(false);
    }
  };

  const handleAnalyze = async () => {
    if (!activeExperiment) return;
    try {
      setIsAnalyzing(true);
      await api.analyzeExperiment(activeExperiment.id);
      await queryClient.invalidateQueries({ queryKey: ["experiment-analysis", activeExperiment.id] });
      setNotification({
        type: "success",
        message: "Incremental lift analysis recalculated with latest purchase logs!",
      });
    } catch (err: any) {
      setNotification({
        type: "error",
        message: "Analysis calculation failed: " + err.message,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Treatment vs Control Comparison Chart Data
  const rateComparisonData = analysis
    ? [
        {
          name: "Control Group",
          rate: (analysis.control_rate ?? 0) * 100,
          fill: "#64748B",
          count: analysis.control_assigned ?? 500,
          converters: analysis.control_converters ?? 0,
        },
        {
          name: "Campaign Group",
          rate: (analysis.treatment_rate ?? 0) * 100,
          fill: "#6366F1",
          count: analysis.treatment_assigned ?? 500,
          converters: analysis.treatment_converters ?? 0,
        },
      ]
    : [];

  const absLift = analysis?.absolute_lift_pp ?? 0;
  const relUplift = analysis?.relative_uplift_pct;
  const ciLow = analysis?.ci_lower_pp ?? 0;
  const ciUp = analysis?.ci_upper_pp ?? 0;

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
                A/B Lift Tests Zero State (No Dataset Loaded)
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed max-w-xl">
                A/B lift tests, holdout randomization, and incremental impact metrics are initialized at zero. Upload a CSV file or click to load our preloaded retail dataset to execute causal experiments.
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
            <NotionHeroTrio className="w-48 h-auto opacity-90" />
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-lg border flex items-center justify-between text-xs transition-all ${
            notification.type === "success"
              ? "bg-[#DBEDDB] dark:bg-[#1C3829] border-[#C3E4C3] dark:border-[#274F3A] text-[#287042] dark:text-[#70C090]"
              : notification.type === "error"
              ? "bg-[#FFE2DD] dark:bg-[#522E2A] border-[#FFC7BD] dark:border-[#6B3B36] text-[#D44040] dark:text-[#FF8080]"
              : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40 text-[#2383E2]"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" && <CheckCircle2 className="h-4 w-4 text-[#448361]" />}
            {notification.type === "error" && <AlertTriangle className="h-4 w-4 text-[#E03E3E]" />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--notion-border)]">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-2xl">🧪</span>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>A/B Lift Tests</span>
              <span className="notion-pill-green text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                Holdout Verification
              </span>
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
            Run controlled audience split tests to measure true incremental revenue and conversion lift.
          </p>
        </div>

        {activeExperiment && (
          <div className="flex items-center gap-2.5">
            {experiments && experiments.length > 1 && (
              <select
                value={selectedExperimentId}
                onChange={(e) => setSelectedExperimentId(e.target.value)}
                className="notion-input text-xs py-1 px-2.5"
              >
                {experiments.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.name}
                  </option>
                ))}
              </select>
            )}

            <a
              href={`/api/v1/experiments/${activeExperiment.id}/assignments.csv`}
              download
              className="notion-btn-secondary text-xs flex items-center gap-1.5 py-1 px-3"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Audience List</span>
            </a>
          </div>
        )}
      </div>

      {/* Grid: Left Test Setup (4 cols) | Right Active Test & Results (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Test Setup & Audience Sizing */}
        <div className="lg:col-span-4 notion-card p-6 space-y-5 text-xs">
          <div className="border-b border-[var(--notion-border)] pb-3">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Test Setup & Sizing
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              50/50 test and control group distribution
            </p>
          </div>

          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Test Name</label>
            <input
              type="text"
              value={expName}
              onChange={(e) => setExpName(e.target.value)}
              className="w-full notion-input text-xs"
              placeholder="e.g. VIP Reactivation Split Test"
            />
          </div>

          <div>
            <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Promoted Store Product</label>
            <select
              value={selectedOfferingId || offerings?.[0]?.id || ""}
              onChange={(e) => setSelectedOfferingId(e.target.value)}
              className="w-full notion-input text-xs"
            >
              {offerings?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.kind}) — {formatCurrency(o.list_price)}
                </option>
              ))}
            </select>
          </div>

          {/* Sizing Parameters */}
          <div className="p-4 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-3">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
              Audience Sizing Parameters
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-neutral-500 dark:text-neutral-400">Baseline Conv Rate:</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.005"
                  max="0.5"
                  value={baselineConversion}
                  onChange={(e) => setBaselineConversion(Number(e.target.value))}
                  className="w-full notion-input text-xs mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-500 dark:text-neutral-400">Target Lift (+%):</label>
                <input
                  type="number"
                  step="0.005"
                  min="0.005"
                  max="0.2"
                  value={targetMDE}
                  onChange={(e) => setTargetMDE(Number(e.target.value))}
                  className="w-full notion-input text-xs mt-1"
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] pt-2 border-t border-[var(--notion-border)]">
              <span className="text-neutral-500 dark:text-neutral-400">Confidence: 95%</span>
              <span className="font-semibold text-[#2383E2]">50/50 Control Split</span>
            </div>

            <div className="p-3 rounded-md bg-[var(--notion-card-bg)] border border-[var(--notion-border)] flex justify-between items-center">
              <span className="text-neutral-500 dark:text-neutral-400">Min Audience per Group:</span>
              <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 tabular-nums">
                {formatNumber(calculatedSampleSizePerArm)} customers
              </span>
            </div>
          </div>

          <button
            onClick={handleRegisterExperiment}
            disabled={isRegistering || !hasData}
            className="w-full notion-btn-primary flex items-center justify-center gap-1.5"
          >
            <FlaskConical className="h-4 w-4" />
            <span>{isRegistering ? "Creating Test..." : "Create A/B Lift Test"}</span>
          </button>
        </div>

        {/* Right Column: Active Test, Scenarios & Analysis */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Test Card */}
          {activeExperiment ? (
            <div className="notion-card p-6 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--notion-border)] pb-4 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="notion-pill-green text-[10px] px-2 py-0.5 rounded font-medium">
                      Active Test
                    </span>
                    <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      {activeExperiment.name}
                    </h2>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Enrolled Customers: {formatNumber(activeExperiment.total_assigned || 0)} (Campaign Group: {formatNumber(activeExperiment.treatment_count || 0)} • Control Group: {formatNumber(activeExperiment.control_count || 0)})
                  </p>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="notion-btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{isAnalyzing ? "Updating..." : "Recalculate Lift"}</span>
                </button>
              </div>

              {/* Test Evaluation Scenarios */}
              <div className="p-4 rounded-lg bg-[var(--notion-sidebar-bg)] border border-[var(--notion-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                    Evaluation Scenarios
                  </span>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Instant Simulation
                  </span>
                </div>
                <p className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                  Simulate different measured response scenarios to evaluate incremental revenue:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => handleSeedSyntheticOutcomes("positive")}
                    disabled={isGeneratingOutcomes}
                    className="px-3 py-1.5 rounded-md bg-[#DBEDDB] dark:bg-[#1C3829] text-[#287042] dark:text-[#70C090] border border-[#C3E4C3] dark:border-[#274F3A] hover:opacity-90 font-medium transition-all flex items-center gap-1.5"
                  >
                    <span>Positive Lift (+3.0%)</span>
                  </button>
                  <button
                    onClick={() => handleSeedSyntheticOutcomes("zero")}
                    disabled={isGeneratingOutcomes}
                    className="px-3 py-1.5 rounded-md bg-[var(--notion-card-bg)] text-neutral-700 dark:text-neutral-300 border border-[var(--notion-border)] hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium transition-all flex items-center gap-1.5"
                  >
                    <span>Neutral (No Effect)</span>
                  </button>
                  <button
                    onClick={() => handleSeedSyntheticOutcomes("negative")}
                    disabled={isGeneratingOutcomes}
                    className="px-3 py-1.5 rounded-md bg-[#FFE2DD] dark:bg-[#522E2A] text-[#D44040] dark:text-[#FF8080] border border-[#FFC7BD] dark:border-[#6B3B36] hover:opacity-90 font-medium transition-all flex items-center gap-1.5"
                  >
                    <span>Below Average (-1.5%)</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="notion-card p-10 text-center text-xs space-y-3">
              <FlaskConical className="h-10 w-10 text-neutral-400 mx-auto" />
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">No Active A/B Lift Tests</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                Configure an experiment using the setup panel on the left once a customer dataset is loaded.
              </p>
            </div>
          )}

          {/* Analysis Results Card */}
          {analysis ? (
            <div className="notion-card p-6 space-y-6 text-xs">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#2383E2]" />
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      Measured Incremental Lift Results
                    </h3>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                      analysis.is_statistically_significant
                        ? "notion-pill-green"
                        : "notion-pill-yellow"
                    }`}
                  >
                    {analysis.is_statistically_significant ? "Statistically Verified" : "Inconclusive"}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                  {analysis.conclusion_text}
                </p>
              </div>

              {/* 4 Impact Metric Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)]">
                  <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">Absolute Lift:</span>
                  <div className={`text-xl font-bold mt-1 tabular-nums ${absLift >= 0 ? "text-[#2383E2]" : "text-[#E03E3E]"}`}>
                    {absLift >= 0 ? "+" : ""}
                    {absLift.toFixed(2)}%
                  </div>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Percentage points</span>
                </div>

                <div className="p-4 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)]">
                  <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">Relative Uplift:</span>
                  <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 tabular-nums">
                    {relUplift !== null && relUplift !== undefined
                      ? `${relUplift >= 0 ? "+" : ""}${relUplift.toFixed(1)}%`
                      : "—"}
                  </div>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Over control group</span>
                </div>

                <div className="p-4 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)]">
                  <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">Confidence Range:</span>
                  <div className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-1 tabular-nums">
                    [{ciLow.toFixed(2)}%, {ciUp.toFixed(2)}%]
                  </div>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">95% statistical range</span>
                </div>

                <div className="p-4 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)]">
                  <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">Statistical p-value:</span>
                  <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 tabular-nums">
                    {analysis.p_value !== undefined && analysis.p_value !== null
                      ? analysis.p_value < 0.001
                        ? "<0.001"
                        : analysis.p_value.toFixed(3)
                      : "—"}
                  </div>
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400">Confidence check</span>
                </div>
              </div>

              {/* Rate Comparison Bar Chart */}
              <div className="p-4 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Purchase Conversion Rate: Campaign vs. Control
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Control: {((analysis.control_rate ?? 0) * 100).toFixed(1)}% • Campaign: {((analysis.treatment_rate ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rateComparisonData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                      <XAxis dataKey="name" stroke="var(--notion-text)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--notion-text)" fontSize={11} tickFormatter={(val) => `${val}%`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--notion-card-bg)",
                          borderColor: "var(--notion-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "var(--notion-text)",
                        }}
                        formatter={(value: any, name: any, item: any) => [
                          `${Number(value).toFixed(2)}% (${item.payload.converters} buyers of ${item.payload.count})`,
                          "Conversion Rate",
                        ]}
                      />
                      <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                        {rateComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Persona Breakdown Table */}
              {analysis.strata_breakdown && analysis.strata_breakdown.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase mb-2.5">
                    PERFORMANCE BY CUSTOMER PERSONA
                  </h4>

                  <div className="border border-[var(--notion-border)] rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-[var(--notion-sidebar-bg)] text-neutral-500 dark:text-neutral-400 text-[11px] font-semibold border-b border-[var(--notion-border)]">
                        <tr>
                          <th className="p-3">Customer Persona</th>
                          <th className="p-3">Campaign Group Rate</th>
                          <th className="p-3">Control Group Rate</th>
                          <th className="p-3">Net Lift</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--notion-border)] text-neutral-900 dark:text-neutral-100">
                        {analysis.strata_breakdown.map((s, idx) => (
                          <tr key={idx} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                            <td className="p-3 font-medium">{formatPersonaName(s.stratum_name, idx)}</td>
                            <td className="p-3 tabular-nums">{formatPercent(s.treatment_rate ?? 0)}</td>
                            <td className="p-3 tabular-nums">{formatPercent(s.control_rate ?? 0)}</td>
                            <td className={`p-3 tabular-nums font-semibold ${(s.lift_pp ?? 0) >= 0 ? "text-[#2383E2]" : "text-[#E03E3E]"}`}>
                              {(s.lift_pp ?? 0) >= 0 ? "+" : ""}
                              {(s.lift_pp ?? 0).toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Incremental Profit Contribution */}
              <div className="notion-callout p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">Verified Incremental Profit Contribution:</span>
                  <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1 tabular-nums">
                    {formatCurrency(analysis.incremental_net_contribution ?? 0)}
                  </div>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {analysis.incremental_purchasers ?? 0} incremental customers generated directly by this campaign
                  </span>
                </div>

                {analysis.incremental_cac !== null && analysis.incremental_cac !== undefined && (
                  <div className="text-left sm:text-right">
                    <span className="text-neutral-500 dark:text-neutral-400">Incremental CAC:</span>
                    <div className="text-lg font-bold text-[#448361] dark:text-[#529E72] tabular-nums">
                      {formatCurrency(analysis.incremental_cac)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-neutral-500 dark:text-neutral-400 notion-card space-y-2">
              <FlaskConical className="h-8 w-8 mx-auto text-neutral-400 opacity-60" />
              <p className="font-medium text-neutral-900 dark:text-neutral-100">Select or create a test to evaluate lift</p>
              <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                Click any evaluation scenario above to simulate measured purchase outcomes and calculate true causal uplift.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
