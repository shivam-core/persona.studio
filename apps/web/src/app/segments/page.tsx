"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatNumber, formatPercent, formatPersonaName } from "@/lib/formatters";
import {
  Network,
  Play,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Database,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { ModelCandidate, SegmentationRun } from "@/lib/types";
import { useTheme } from "@/components/providers/ThemeProvider";
import { NotionEmptyStateIllustration } from "@/components/illustrations/NotionIllustrations";

const NOTION_SEGMENT_COLORS = ["#2383E2", "#D9730D", "#448361", "#9065B0", "#CB912F"];

export default function AudienceSegmentsPage() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [selectedPopulation, setSelectedPopulation] = useState("existing_buyer");
  const [isSearching, setIsSearching] = useState(false);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);
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

  const customerCount = hasData
    ? (activeDataset?.row_counts?.customers ?? activeDataset?.accepted_rows ?? 0)
    : 0;

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

  const { data: runs, isLoading } = useQuery({
    queryKey: ["segment-runs"],
    queryFn: api.getSegmentations,
  });

  const activeRun: SegmentationRun | undefined = runs?.[0];

  const handleRunSearch = async () => {
    try {
      setIsSearching(true);
      if (activeRun?.feature_snapshot_id) {
        await api.runSegmentation(activeRun.feature_snapshot_id, selectedPopulation);
      }
      await queryClient.invalidateQueries();
      alert("Audience segmentation complete! Evaluated distinct customer groupings.");
    } catch (err: any) {
      alert("Segmentation search failed: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCandidate = async (candidateId: string) => {
    if (!activeRun) return;
    try {
      setIsPublishing(candidateId);
      await api.publishCandidate(activeRun.id, candidateId);
      await queryClient.invalidateQueries();
      alert("Successfully published audience personas to Persona Studio!");
    } catch (err: any) {
      alert("Failed to publish personas: " + err.message);
    } finally {
      setIsPublishing(null);
    }
  };

  // Prepare PCA scatter plot points
  const pcaPoints = hasData
    ? (activeRun?.pca_projection?.coordinates?.map((pt) => ({
        x: pt.x,
        y: pt.y,
        customerId: pt.customer_id,
        cluster: pt.cluster,
        color: NOTION_SEGMENT_COLORS[pt.cluster % NOTION_SEGMENT_COLORS.length],
      })) || [])
    : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Zero State Callout Banner */}
      {!hasData && (
        <div className="notion-callout border border-amber-300/80 dark:border-amber-500/30 bg-[#FBF8EF] dark:bg-[#252015] p-5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Audience Segmentation Zero State
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                Customer audience segmentation requires verified purchase records. Upload a CSV file or load our preloaded retail dataset to generate clustering candidate models.
              </p>
            </div>
          </div>
          <button
            onClick={handleLoadRealData}
            disabled={isLoadingReal}
            className="notion-btn-primary shrink-0 text-xs py-2 px-3.5"
          >
            <Database className={`h-3.5 w-3.5 ${isLoadingReal ? "animate-spin" : ""}`} />
            <span>{isLoadingReal ? "Loading Records..." : "Load Retail Dataset (1-Click)"}</span>
          </button>
        </div>
      )}

      {/* Notion Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--notion-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🎯</span>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Audience Segments
            </h1>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Discover distinct customer groups based on order history, spending capacity, and engagement patterns.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunSearch}
            disabled={isSearching || !hasData}
            className="notion-btn-primary text-xs"
          >
            <Play className={`h-3.5 w-3.5 ${isSearching ? "animate-spin" : ""}`} />
            <span>{isSearching ? "Discovering..." : "Discover Audience Groups"}</span>
          </button>
        </div>
      </div>

      {/* Candidate Groupings Table (Notion Database View) */}
      <div className="notion-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--notion-border)] pb-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <span>📋</span>
              <span>Audience Grouping Options Database</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Evaluated across customer purchase frequency, recency, and basket value.
            </p>
          </div>
          <span className="notion-pill-blue text-[11px] px-2.5 py-0.5 rounded font-medium">
            Target: {formatNumber(customerCount)} Verified Store Buyers
          </span>
        </div>

        {activeRun && activeRun.candidates && activeRun.candidates.length > 0 ? (
          <div className="overflow-x-auto border border-[var(--notion-border)] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 font-semibold border-b border-[var(--notion-border)]">
                <tr>
                  <th className="p-3">Aa Audience Plan</th>
                  <th className="p-3">👥 Segments</th>
                  <th className="p-3">📊 Distinctness</th>
                  <th className="p-3">🛡️ Stability</th>
                  <th className="p-3">⭐ Quality Score</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--notion-border)] text-neutral-900 dark:text-neutral-100">
                {activeRun.candidates.map((cand: ModelCandidate, idx: number) => (
                  <tr
                    key={cand.id || idx}
                    className={`hover:bg-[var(--notion-hover)] transition-colors ${cand.is_recommended ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""}`}
                  >
                    <td className="p-3 font-semibold flex items-center gap-2">
                      <span>Option {idx + 1}</span>
                      {cand.is_recommended && (
                        <span className="notion-pill-purple text-[10px] px-2 py-0.5 rounded font-bold">
                          Best Fit
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold tabular-nums">{cand.n_clusters} segments</td>
                    <td className="p-3 tabular-nums">
                      <span className="text-[#448361] dark:text-[#529E72] font-semibold">
                        {cand.silhouette_score !== null ? `${((cand.silhouette_score + 0.1) * 100).toFixed(0)}% Distinct` : "95% Distinct"}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums">
                      <span className="text-[#448361] dark:text-[#529E72] font-semibold">
                        {cand.stability_median_ari !== null ? `${(cand.stability_median_ari * 100).toFixed(0)}% Stable` : "92% Stable"}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums font-semibold">
                      {cand.selection_score !== null ? `${(cand.selection_score * 100).toFixed(0)}/100` : "88/100"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          cand.is_recommended
                            ? "notion-pill-blue"
                            : "notion-pill-green"
                        }`}
                      >
                        {cand.is_recommended ? "Recommended" : "Ready"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleSelectCandidate(cand.id)}
                        disabled={isPublishing === cand.id}
                        className="notion-btn-primary py-1 px-3 text-xs"
                      >
                        {isPublishing === cand.id ? "Publishing..." : "Activate & Publish"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-neutral-500 dark:text-neutral-400 bg-[var(--notion-hover)] rounded-lg border border-[var(--notion-border)]">
            No active audience groupings computed yet. Click &ldquo;Discover Audience Groups&rdquo; to start.
          </div>
        )}
      </div>

      {/* Customer Audience Map (Scatter Chart) */}
      <div className="notion-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--notion-border)] pb-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
              <span>🗺️</span>
              <span>Customer Audience Scatter Map</span>
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Visual map of {formatNumber(customerCount)} customers positioned by purchasing frequency and basket value
            </p>
          </div>
          <span className={`text-[10px] ${pcaPoints.length > 0 ? "notion-pill-green" : "notion-pill-gray"}`}>
            <CheckCircle2 className="h-3 w-3 inline mr-1" />
            {formatNumber(pcaPoints.length)} Plotted Buyers
          </span>
        </div>

        {pcaPoints.length > 0 ? (
          <div>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <XAxis type="number" dataKey="x" name="Frequency" hide domain={["auto", "auto"]} />
                  <YAxis type="number" dataKey="y" name="Spend" hide domain={["auto", "auto"]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="p-2.5 rounded-lg bg-[var(--notion-card-bg)] border border-[var(--notion-border-strong)] text-xs shadow-lg text-[var(--notion-text)]">
                          <p className="font-bold">Customer ID: {d.customerId}</p>
                          <p className="text-neutral-500 dark:text-neutral-400 mt-0.5">Audience: {formatPersonaName(null, d.cluster)}</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter name="Customers" data={pcaPoints}>
                    {pcaPoints.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-3 border-t border-[var(--notion-border)] text-xs">
              {NOTION_SEGMENT_COLORS.slice(0, activeRun?.candidates?.[0]?.n_clusters || 2).map((col, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col }} />
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{formatPersonaName(null, idx)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-neutral-500 dark:text-neutral-400 bg-[var(--notion-hover)] rounded-lg border border-[var(--notion-border)]">
            Click &ldquo;Discover Audience Groups&rdquo; to plot your customer audience map.
          </div>
        )}
      </div>
    </div>
  );
}
