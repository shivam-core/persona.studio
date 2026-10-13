"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import {
  FlaskConical,
  Play,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Info,
  TrendingUp,
  Percent,
  Layers,
  ArrowRight,
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
import { Experiment, ExperimentAnalysis, PersonaCard, Offering } from "@/lib/types";

export default function ExperimentsPage() {
  const queryClient = useQueryClient();

  // Registration & Power Calculator State
  const [expName, setExpName] = useState("Festival Collection Randomized Holdout Test");
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [baselineConversion, setBaselineConversion] = useState<number>(0.05); // 5%
  const [targetMDE, setTargetMDE] = useState<number>(0.02); // 2 pp
  const [alpha, setAlpha] = useState<number>(0.05);
  const [targetPower, setTargetPower] = useState<number>(0.80);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);

  // Loading states
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [isGeneratingOutcomes, setIsGeneratingOutcomes] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const { data: offerings } = useQuery({
    queryKey: ["offerings"],
    queryFn: api.getOfferings,
  });

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: api.getPersonas,
  });

  const { data: experiments, isLoading: loadingExperiments } = useQuery({
    queryKey: ["experiments"],
    queryFn: api.getExperiments,
  });

  const activeExperiment =
    experiments?.find((e) => e.id === selectedExperimentId) || experiments?.[0];

  const { data: analysis } = useQuery({
    queryKey: ["experiment-analysis", activeExperiment?.id],
    queryFn: () => (activeExperiment ? api.getExperimentAnalysis(activeExperiment.id) : null),
    enabled: !!activeExperiment?.id,
  });

  // Approximate Power calculation: Sample size per arm
  // n = 2 * (z_alpha/2 + z_beta)^2 * p * (1 - p) / MDE^2
  const pBar = baselineConversion + targetMDE / 2;
  const zScore = 1.96 + 0.84; // alpha 0.05 + power 0.80
  const calculatedSampleSizePerArm = Math.round(
    (2 * Math.pow(zScore, 2) * pBar * (1 - pBar)) / Math.pow(targetMDE, 2)
  );

  const handleRegisterExperiment = async () => {
    if (!offerings || offerings.length === 0) {
      alert("Please ensure offerings catalog is loaded.");
      return;
    }
    try {
      setIsRegistering(true);
      const res = await api.createExperiment({
        name: expName,
        offering_id: selectedOfferingId || offerings[0].id,
        persona_ids: personas?.map((p) => p.id) || [],
        primary_metric: "conversion_rate",
        target_mde: targetMDE,
        alpha,
        target_power: targetPower,
        baseline_conversion: baselineConversion,
      });
      await queryClient.invalidateQueries();
      setSelectedExperimentId(res.id);
      alert("Experiment pre-registered with 50/50 stratified randomized holdout assignment!");
    } catch (err: any) {
      alert("Registration failed: " + err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSeedSyntheticOutcomes = async (
    effectType: "positive" | "zero" | "negative" | "incomplete"
  ) => {
    if (!activeExperiment) return;
    try {
      setIsGeneratingOutcomes(true);
      await api.seedSyntheticOutcomes(activeExperiment.id, effectType);
      await api.analyzeExperiment(activeExperiment.id);
      await queryClient.invalidateQueries();
      alert(`Synthetic outcomes (${effectType} effect) generated and analyzed!`);
    } catch (err: any) {
      alert("Failed to generate outcomes: " + err.message);
    } finally {
      setIsGeneratingOutcomes(false);
    }
  };

  const handleAnalyze = async () => {
    if (!activeExperiment) return;
    try {
      setIsAnalyzing(true);
      await api.analyzeExperiment(activeExperiment.id);
      await queryClient.invalidateQueries();
      alert("Impact analysis completed with 2,000-draw stratified bootstrap CIs!");
    } catch (err: any) {
      alert("Analysis failed: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Treatment vs Control Chart Data
  const rateComparisonData = analysis
    ? [
        { name: "Holdout Control", rate: analysis.control_rate, fill: "#6B7280" },
        { name: "Campaign Treatment", rate: analysis.treatment_rate, fill: "#5146D9" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#17233B] tracking-tight">
            Experiments & Measured Impact
          </h1>
          <p className="text-sm text-[#52617A] mt-1">
            Pre-register randomized holdout experiments, export frozen assignments, and analyze intention-to-treat (ITT) uplift with 95% bootstrap CIs.
          </p>
        </div>

        {activeExperiment && (
          <div className="flex items-center gap-2">
            <a
              href={`/api/v1/experiments/${activeExperiment.id}/assignments.csv`}
              download
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-[#E2E8F2] hover:bg-[#F5F7FB] text-xs font-semibold text-[#17233B] shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-[#5146D9]" />
              <span>Export Assignments CSV</span>
            </a>
          </div>
        )}
      </div>

      {/* Grid: Left Pre-Registration & Power Calculator | Right Active Experiment & Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Pre-Registration & Power Planning */}
        <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-5 text-xs">
          <div className="flex items-center justify-between border-b border-[#E2E8F2] pb-3">
            <h2 className="text-sm font-bold text-[#17233B] flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-[#5146D9]" />
              <span>Pre-Registration & Power Planning</span>
            </h2>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Holdout Design
            </span>
          </div>

          <div>
            <label className="block font-semibold text-[#17233B] mb-1">Experiment Name</label>
            <input
              type="text"
              value={expName}
              onChange={(e) => setExpName(e.target.value)}
              className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#17233B] mb-1">Catalog Offering</label>
            <select
              value={selectedOfferingId}
              onChange={(e) => setSelectedOfferingId(e.target.value)}
              className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
            >
              {offerings?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.kind}) — {formatCurrency(o.list_price)}
                </option>
              ))}
            </select>
          </div>

          {/* Statistical Power Parameters */}
          <div className="p-3.5 rounded-xl border border-[#E2E8F2] bg-[#F5F7FB]/50 space-y-3">
            <span className="font-bold text-[#17233B] block">
              Sample Size Planner (NormalIndPower)
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[#52617A]">Baseline Rate (p0):</label>
                <input
                  type="number"
                  step="0.01"
                  value={baselineConversion}
                  onChange={(e) => setBaselineConversion(Number(e.target.value))}
                  className="w-full p-1.5 rounded border border-[#E2E8F2] bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#52617A]">Target MDE (+pp):</label>
                <input
                  type="number"
                  step="0.005"
                  value={targetMDE}
                  onChange={(e) => setTargetMDE(Number(e.target.value))}
                  className="w-full p-1.5 rounded border border-[#E2E8F2] bg-white"
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-[#E2E8F2]">
              <span className="text-[#52617A]">Alpha = 0.05 • Power = 80%</span>
              <span className="font-bold text-[#5146D9]">50/50 Stratified Holdout</span>
            </div>

            <div className="p-2 rounded bg-white border border-[#E2E8F2] flex justify-between items-center">
              <span className="text-[#52617A]">Required N / Arm:</span>
              <span className="font-bold text-base text-[#17233B] tabular-nums">
                {formatNumber(calculatedSampleSizePerArm)}
              </span>
            </div>
          </div>

          <button
            onClick={handleRegisterExperiment}
            disabled={isRegistering}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#5146D9] text-white text-xs font-semibold hover:bg-[#4338CA] transition-colors shadow-sm disabled:opacity-50"
          >
            <span>{isRegistering ? "Pre-Registering..." : "Pre-Register Holdout Test"}</span>
          </button>
        </div>

        {/* Right 2 Cols: Active Experiment, Synthetic Scenarios & Analysis */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Experiment Header & Scenario Generator */}
          <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E2E8F2] pb-3 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                    Status: {activeExperiment?.status || "pre_registered"}
                  </span>
                  <h2 className="text-base font-bold text-[#17233B]">
                    {activeExperiment?.name || "No Experiment Selected"}
                  </h2>
                </div>
                <p className="text-xs text-[#52617A] mt-0.5">
                  Assigned Customers: {formatNumber(activeExperiment?.total_assigned || 2000)} (Treatment: {activeExperiment?.treatment_count || 1000} • Control: {activeExperiment?.control_count || 1000})
                </p>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F2] hover:bg-[#F5F7FB] text-xs font-semibold text-[#17233B] shadow-xs"
              >
                {isAnalyzing ? "Computing CIs..." : "Re-Run Analysis"}
              </button>
            </div>

            {/* Synthetic Outcome Generator Pills */}
            <div className="p-3.5 rounded-xl bg-[#F5F7FB] border border-[#E2E8F2] space-y-2">
              <span className="font-semibold text-[#17233B] block">
                Demonstration Outcome Importers (Ground-Truth Testing)
              </span>
              <p className="text-[#52617A] text-[11px]">
                Import seeded customer outcomes to evaluate positive uplift, flat zero effect, negative lift, or incomplete coverage:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => handleSeedSyntheticOutcomes("positive")}
                  disabled={isGeneratingOutcomes}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-semibold"
                >
                  Positive Effect (+3.0 pp Lift)
                </button>
                <button
                  onClick={() => handleSeedSyntheticOutcomes("zero")}
                  disabled={isGeneratingOutcomes}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100 font-semibold"
                >
                  Flat Zero Effect (Inconclusive)
                </button>
                <button
                  onClick={() => handleSeedSyntheticOutcomes("negative")}
                  disabled={isGeneratingOutcomes}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 font-semibold"
                >
                  Negative Effect (-1.5 pp Drop)
                </button>
                <button
                  onClick={() => handleSeedSyntheticOutcomes("incomplete")}
                  disabled={isGeneratingOutcomes}
                  className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-semibold"
                >
                  Incomplete Data (Suppresses Causal)
                </button>
              </div>
            </div>
          </div>

          {/* Analysis Results Card */}
          {analysis ? (
            <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-6 text-xs">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#17233B]">
                    Intention-to-Treat (ITT) Uplift & Confidence Intervals
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      analysis.is_statistically_significant
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {analysis.is_statistically_significant ? "Statistically Significant" : "Inconclusive"}
                  </span>
                </div>
                <p className="text-xs text-[#52617A] mt-0.5">{analysis.conclusion_text}</p>
              </div>

              {/* 4 Impact Metric Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#F5F7FB] border border-[#E2E8F2]">
                  <span className="text-[#52617A]">Absolute Lift:</span>
                  <div className="text-2xl font-bold text-[#5146D9] mt-1 tabular-nums">
                    {analysis.absolute_lift_pp >= 0 ? "+" : ""}
                    {analysis.absolute_lift_pp.toFixed(2)} pp
                  </div>
                  <span className="text-[10px] text-[#52617A]">Percentage points</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F5F7FB] border border-[#E2E8F2]">
                  <span className="text-[#52617A]">Relative Uplift:</span>
                  <div className="text-2xl font-bold text-[#17233B] mt-1 tabular-nums">
                    {analysis.relative_uplift_pct !== null
                      ? `${analysis.relative_uplift_pct >= 0 ? "+" : ""}${analysis.relative_uplift_pct.toFixed(1)}%`
                      : "—"}
                  </div>
                  <span className="text-[10px] text-[#52617A]">Over holdout baseline</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F5F7FB] border border-[#E2E8F2]">
                  <span className="text-[#52617A]">95% Bootstrap CI:</span>
                  <div className="text-base font-bold text-[#17233B] mt-1 tabular-nums">
                    [{analysis.ci_lower_pp.toFixed(2)} pp, {analysis.ci_upper_pp.toFixed(2)} pp]
                  </div>
                  <span className="text-[10px] text-[#52617A]">2,000 resamples</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F5F7FB] border border-[#E2E8F2]">
                  <span className="text-[#52617A]">p-value:</span>
                  <div className="text-2xl font-bold text-[#17233B] mt-1 tabular-nums">
                    {analysis.p_value < 0.001 ? "<0.001" : analysis.p_value.toFixed(3)}
                  </div>
                  <span className="text-[10px] text-[#52617A]">Permutation test</span>
                </div>
              </div>

              {/* Conversion Rate Comparison Bar Chart */}
              <div className="p-4 rounded-xl border border-[#E2E8F2] bg-[#F5F7FB]/50">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold text-[#17233B]">
                    Observed Conversion Rates by Arm
                  </span>
                  <span className="text-[11px] text-[#52617A]">
                    Treatment ({analysis.treatment_converters}/{analysis.treatment_assigned}) vs Control ({analysis.control_converters}/{analysis.control_assigned})
                  </span>
                </div>

                <div className="h-[140px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rateComparisonData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#52617A" }} stroke="#E2E8F2" />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#52617A" }}
                        stroke="#E2E8F2"
                        tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                      />
                      <Tooltip
                        formatter={(val: any) => [formatPercent(Number(val)), "Conversion Rate"]}
                        contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F2", fontSize: "12px" }}
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

              {/* Exploratory Strata Breakdown */}
              {analysis.strata_breakdown && analysis.strata_breakdown.length > 0 && (
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-[#52617A] mb-2 flex items-center justify-between">
                    <span>Exploratory Persona Strata Breakdown</span>
                    <span className="text-[10px] font-normal">Pre-Stratified Randomization</span>
                  </h4>

                  <div className="border border-[#E2E8F2] rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-[#F5F7FB] text-[#52617A] text-[11px] font-semibold">
                        <tr>
                          <th className="p-2.5">Persona Stratum</th>
                          <th className="p-2.5">Treatment Rate</th>
                          <th className="p-2.5">Control Rate</th>
                          <th className="p-2.5">Stratum Lift</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F2]">
                        {analysis.strata_breakdown.map((s, idx) => (
                          <tr key={idx} className="hover:bg-[#F5F7FB]/50">
                            <td className="p-2.5 font-medium text-[#17233B]">{s.stratum_name}</td>
                            <td className="p-2.5 tabular-nums">{formatPercent(s.treatment_rate)}</td>
                            <td className="p-2.5 tabular-nums">{formatPercent(s.control_rate)}</td>
                            <td className="p-2.5 tabular-nums font-semibold text-[#5146D9]">
                              {s.lift_pp >= 0 ? "+" : ""}
                              {s.lift_pp.toFixed(2)} pp
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Incremental Financial Contribution */}
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[#17233B]">Measured Incremental Contribution:</span>
                  <div className="text-xl font-bold text-[#5146D9] mt-0.5 tabular-nums">
                    {formatCurrency(analysis.incremental_net_contribution)}
                  </div>
                  <span className="text-[10px] text-[#52617A]">
                    {analysis.incremental_purchasers} incremental purchasers at test treatment scale
                  </span>
                </div>

                {analysis.incremental_cac !== null && (
                  <div className="text-right">
                    <span className="text-[#52617A]">Incremental CAC:</span>
                    <div className="text-lg font-bold text-[#16724E] tabular-nums">
                      {formatCurrency(analysis.incremental_cac)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-[#52617A] bg-white rounded-xl border border-[#E2E8F2]">
              Select or pre-register an experiment, then import outcomes to calculate intention-to-treat uplift.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
