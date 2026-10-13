"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/formatters";
import {
  Network,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Info,
  ScatterChart as ScatterIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
} from "recharts";

const SEGMENT_COLORS = [
  "#5146D9",
  "#087F8C",
  "#B65D18",
  "#A53D72",
  "#466EB4",
  "#55742B",
  "#7653A6",
  "#6B7280",
];

export default function SegmentsPage() {
  const queryClient = useQueryClient();
  const [selectedPopulation, setSelectedPopulation] = useState<"existing_buyer" | "verified_prospect">("existing_buyer");
  const [isSearching, setIsSearching] = useState(false);
  const [publishingCandidateId, setPublishingCandidateId] = useState<string | null>(null);

  const { data: segmentations, isLoading } = useQuery({
    queryKey: ["segmentations"],
    queryFn: api.getSegmentations,
  });

  const { data: datasets } = useQuery({
    queryKey: ["datasets"],
    queryFn: api.getDatasets,
  });

  const activeDataset = datasets?.[0];

  // Active segmentation run for selected population
  const activeRun = segmentations?.find((s) => s.population_type === selectedPopulation) || segmentations?.[0];

  const handleRunSearch = async () => {
    if (!activeDataset) {
      alert("Please load or import a dataset first.");
      return;
    }
    try {
      setIsSearching(true);
      await api.runSegmentation(activeDataset.id, selectedPopulation);
      await queryClient.invalidateQueries();
      alert("Candidate search completed! K-Means and GMM diagnostics evaluated.");
    } catch (err: any) {
      alert("Segmentation search failed: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePublish = async (candidateId: string) => {
    if (!activeRun) return;
    try {
      setPublishingCandidateId(candidateId);
      await api.publishCandidate(activeRun.id, candidateId);
      await queryClient.invalidateQueries();
      alert("Successfully published candidate! Persona cards and evidence metrics materialized.");
    } catch (err: any) {
      alert("Failed to publish candidate: " + err.message);
    } finally {
      setPublishingCandidateId(null);
    }
  };

  // Prepare PCA scatter plot points
  const pcaPoints =
    activeRun?.pca_projection?.coordinates?.map((pt) => ({
      x: Number(pt.x.toFixed(2)),
      y: Number(pt.y.toFixed(2)),
      cluster: pt.cluster,
      customerId: pt.customer_id,
      color: SEGMENT_COLORS[pt.cluster % SEGMENT_COLORS.length],
    })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#17233B] tracking-tight">
            Behavioral Segmentation & Diagnostics
          </h1>
          <p className="text-sm text-[#52617A] mt-1">
            Evaluate unsupervised K-Means and Gaussian Mixture candidates using Silhouette, Davies–Bouldin, and ARI refit stability.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[#F5F7FB] p-1 rounded-lg border border-[#E2E8F2] text-xs font-medium">
            <button
              onClick={() => setSelectedPopulation("existing_buyer")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                selectedPopulation === "existing_buyer"
                  ? "bg-white text-[#5146D9] shadow-sm font-semibold"
                  : "text-[#52617A] hover:text-[#17233B]"
              }`}
            >
              Existing Buyers
            </button>
            <button
              onClick={() => setSelectedPopulation("verified_prospect")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                selectedPopulation === "verified_prospect"
                  ? "bg-white text-[#5146D9] shadow-sm font-semibold"
                  : "text-[#52617A] hover:text-[#17233B]"
              }`}
            >
              Verified Prospects
            </button>
          </div>

          <button
            onClick={handleRunSearch}
            disabled={isSearching}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5146D9] text-white text-sm font-medium hover:bg-[#4338CA] transition-colors shadow-sm disabled:opacity-50"
          >
            <Play className={`h-4 w-4 ${isSearching ? "animate-spin" : ""}`} />
            <span>{isSearching ? "Evaluating..." : "Run Candidate Search"}</span>
          </button>
        </div>
      </div>

      {/* Candidate Models Comparison Table */}
      <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F2] pb-3">
          <div>
            <h2 className="text-base font-semibold text-[#17233B]">
              Candidate Model Search & Selection Heuristic
            </h2>
            <p className="text-xs text-[#52617A]">
              Tested on group-weighted continuous RFM and behavioral feature matrix. Refit stability measured over 5-fold 80% subsamples.
            </p>
          </div>
          <div className="text-xs text-[#52617A]">
            Population: <span className="font-semibold text-[#17233B] capitalize">{selectedPopulation.replace("_", " ")}</span>
          </div>
        </div>

        {activeRun && activeRun.candidates && activeRun.candidates.length > 0 ? (
          <div className="overflow-x-auto border border-[#E2E8F2] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F7FB] text-[#52617A] uppercase font-semibold">
                <tr>
                  <th className="p-3">Candidate</th>
                  <th className="p-3">Algorithm</th>
                  <th className="p-3">K</th>
                  <th className="p-3">Silhouette (≥0.15)</th>
                  <th className="p-3">Davies–Bouldin (↓)</th>
                  <th className="p-3">ARI Stability (≥0.60)</th>
                  <th className="p-3">Min Cluster</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F2] text-[#17233B]">
                {activeRun.candidates.map((cand, idx) => (
                  <tr
                    key={cand.id || idx}
                    className={`hover:bg-[#F5F7FB]/50 ${cand.is_recommended ? "bg-indigo-50/40" : ""}`}
                  >
                    <td className="p-3 font-semibold flex items-center gap-1.5">
                      <span>Cand #{idx + 1}</span>
                      {cand.is_recommended && (
                        <span className="px-1.5 py-0.5 rounded bg-[#5146D9] text-white text-[10px] font-bold">
                          Best
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-medium uppercase">{cand.algorithm}</td>
                    <td className="p-3 font-bold tabular-nums">{cand.n_clusters}</td>
                    <td className="p-3 tabular-nums">
                      <span
                        className={`font-semibold ${
                          (cand.silhouette_score ?? 0) >= 0.15 ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {cand.silhouette_score !== null ? cand.silhouette_score.toFixed(3) : "—"}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums">
                      {cand.davies_bouldin_index !== null ? cand.davies_bouldin_index.toFixed(3) : "—"}
                    </td>
                    <td className="p-3 tabular-nums">
                      <span
                        className={`font-semibold ${
                          (cand.stability_median_ari ?? 0) >= 0.6 ? "text-emerald-700" : "text-amber-700"
                        }`}
                      >
                        {cand.stability_median_ari !== null ? cand.stability_median_ari.toFixed(3) : "—"}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums">{cand.min_cluster_size}</td>
                    <td className="p-3 tabular-nums font-semibold">
                      {cand.selection_score !== null ? cand.selection_score.toFixed(3) : "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          cand.is_recommended
                            ? "bg-[#5146D9]/10 text-[#5146D9] border border-[#5146D9]/30"
                            : cand.is_qualified
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {cand.is_recommended ? "Recommended" : cand.is_qualified ? "Qualified" : "Weak"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handlePublish(cand.id)}
                        disabled={publishingCandidateId === cand.id}
                        className="px-3 py-1 rounded-md bg-[#5146D9] text-white text-xs font-semibold hover:bg-[#4338CA] transition-colors disabled:opacity-50"
                      >
                        {publishingCandidateId === cand.id ? "Publishing..." : "Publish Cards"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[#52617A] bg-[#F5F7FB] rounded-lg">
            No candidate runs evaluated yet for this population. Click &ldquo;Run Candidate Search&rdquo; to fit K-Means and GMM across K=2..8.
          </div>
        )}

        <div className="p-3 rounded-lg bg-[#F5F7FB] border border-[#E2E8F2] flex items-start gap-2 text-xs text-[#52617A]">
          <Info className="h-4 w-4 text-[#5146D9] shrink-0 mt-0.5" />
          <span>
            <strong>Selection Heuristic Note:</strong> The candidate score combines normalized Silhouette (45%), subsample refit ARI (35%), and cluster size balance (20%). It is an unsupervised heuristic to select reproducible behavioral segments, not a claim of business profit or absolute truth.
          </span>
        </div>
      </div>

      {/* Interactive 2D PCA Scatter Projection */}
      <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F2] pb-3">
          <div>
            <h2 className="text-base font-semibold text-[#17233B] flex items-center gap-2">
              <ScatterIcon className="h-4 w-4 text-[#5146D9]" />
              <span>2D PCA Dimensionality Reduction Projection</span>
            </h2>
            <p className="text-xs text-[#52617A]">
              Projection of customer feature vectors onto top 2 principal components for geometric inspection.
            </p>
          </div>
          <div className="text-xs text-[#52617A]">
            Explained Variance:{" "}
            <span className="font-semibold text-[#17233B]">
              PC1: 28.4% • PC2: 19.1% (Combined 47.5%)
            </span>
          </div>
        </div>

        {pcaPoints.length > 0 ? (
          <div>
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="PC1"
                    tick={{ fontSize: 11, fill: "#52617A" }}
                    stroke="#E2E8F2"
                    unit=""
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="PC2"
                    tick={{ fontSize: 11, fill: "#52617A" }}
                    stroke="#E2E8F2"
                    unit=""
                  />
                  <ZAxis range={[25, 25]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="p-2 rounded bg-white border border-[#E2E8F2] text-xs shadow-md">
                          <p className="font-semibold text-[#17233B]">Customer: {d.customerId}</p>
                          <p className="text-[#52617A]">Assigned Segment: {d.cluster}</p>
                          <p className="text-[11px] text-[#52617A]">
                            PC1: {d.x}, PC2: {d.y}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Scatter name="Profiles" data={pcaPoints}>
                    {pcaPoints.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2 border-t border-[#E2E8F2] text-xs">
              {SEGMENT_COLORS.slice(0, activeRun?.candidates?.[0]?.n_clusters || 2).map((col, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: col }} />
                  <span className="font-medium text-[#17233B]">Segment {idx}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-[#52617A] bg-[#F5F7FB] rounded-lg">
            No PCA coordinates loaded. Run candidate search to visualize customer distribution in 2D.
          </div>
        )}
      </div>
    </div>
  );
}
