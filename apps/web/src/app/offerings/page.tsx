"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent, formatPersonaName } from "@/lib/formatters";
import Link from "next/link";
import {
  Package,
  Sparkles,
  Info,
  CheckCircle2,
  Megaphone,
  ArrowRight,
  TrendingUp,
  Database,
  AlertCircle,
} from "lucide-react";
import { NotionGirlCreator } from "@/components/illustrations/NotionIllustrations";
import { Offering, OfferingFitScore, PersonaCard } from "@/lib/types";

export default function OfferingsPage() {
  const queryClient = useQueryClient();
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);
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

  const { data: offerings, isLoading: loadingOfferings } = useQuery({
    queryKey: ["offerings"],
    queryFn: api.getOfferings,
  });

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: api.getPersonas,
  });

  const activeOffering =
    offerings?.find((o) => o.id === selectedOfferingId) || offerings?.[0];

  const { data: fitScores } = useQuery({
    queryKey: ["offering-fit", activeOffering?.id],
    queryFn: () => (activeOffering ? api.getOfferingFit(activeOffering.id) : null),
    enabled: !!activeOffering?.id,
  });

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
                Product Catalog Zero State (No Dataset Loaded)
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed max-w-xl">
                Product catalog items and customer persona affinity scores are initialized at zero. Upload a CSV file or click to load our preloaded retail dataset to view product fit matrices.
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
            <NotionGirlCreator className="w-32 h-auto opacity-90" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--notion-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">📦</span>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>Product Catalog & Audience Fit</span>
              <span className="notion-pill-blue text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                Affinity Matrix
              </span>
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
            Store offerings and subscription services matched with customer persona purchase affinity.
          </p>
        </div>

        {activeOffering && (
          <Link
            href={`/campaigns?offeringId=${activeOffering.id}`}
            className="notion-btn-primary text-xs flex items-center gap-1.5 py-1 px-3"
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span>Plan Campaign for {activeOffering.name}</span>
          </Link>
        )}
      </div>

      {/* Grid: Left Offering List, Right Fit Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Offerings List */}
        <div className="p-6 notion-card space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--notion-border)] pb-3">
            <div>
              <div className="text-[10px] font-bold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase mb-1">CATALOG ITEMS</div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Store Products ({offerings?.length || 0})
              </h2>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Click to inspect</span>
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {offerings && offerings.length > 0 ? (
              offerings.map((offering) => {
                const isSelected = offering.id === activeOffering?.id;
                const unitMargin = offering.list_price - offering.unit_variable_cost;
                const marginPct = offering.list_price > 0 ? unitMargin / offering.list_price : 0;

                return (
                  <div
                    key={offering.id}
                    onClick={() => setSelectedOfferingId(offering.id)}
                    className={`p-4 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "border-[#2383E2] bg-blue-50/60 dark:bg-blue-950/30 shadow-sm"
                        : "border-[var(--notion-border)] bg-[var(--notion-card-bg)] hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-neutral-900 dark:text-neutral-100">
                      <span>{offering.name}</span>
                      <span className="notion-pill-gray text-[10px] uppercase font-mono px-1.5 py-0.5 rounded">
                        {offering.kind}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mt-2">
                      <span>Category: {offering.category}</span>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
                        {formatCurrency(offering.list_price)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5 pt-1.5 border-t border-[var(--notion-border)]">
                      <span>Product COGS: {formatCurrency(offering.unit_variable_cost)}</span>
                      <span className="text-[#448361] dark:text-[#529E72] font-medium">
                        Margin: {formatPercent(marginPct)} ({formatCurrency(unitMargin)})
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-neutral-500 dark:text-neutral-400 border border-dashed border-[var(--notion-border)] rounded-lg">
                No store products found. Load dataset to inspect product catalog items.
              </div>
            )}
          </div>
        </div>

        {/* Right 2 Cols: Persona Fit Breakdown */}
        <div className="lg:col-span-2 p-6 notion-card space-y-6">
          {activeOffering ? (
            <>
              {/* Active Offering Header */}
              <div className="border-b border-[var(--notion-border)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="notion-pill-blue uppercase text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                      {activeOffering.kind}
                    </span>
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{activeOffering.name}</h2>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">{activeOffering.description}</p>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">List Price:</span>
                    <div className="font-semibold text-base text-neutral-900 dark:text-neutral-100 tabular-nums">
                      {formatCurrency(activeOffering.list_price)}
                    </div>
                  </div>
                  {activeOffering.capacity_units && (
                    <div>
                      <span className="text-neutral-500 dark:text-neutral-400">Capacity Cap:</span>
                      <div className="font-semibold text-base text-neutral-900 dark:text-neutral-100 tabular-nums">
                        {activeOffering.capacity_units} units
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Persona Fit Cards */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-bold tracking-wider text-neutral-500 dark:text-neutral-400 uppercase">
                    AUDIENCE COMPATIBILITY ACROSS PERSONAS
                  </h3>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Category Affinity (45%) • Spend (25%) • Recency (20%) • Activity (10%)
                  </span>
                </div>

                {fitScores && fitScores.length > 0 ? (
                  <div className="space-y-4">
                    {fitScores.map((score) => {
                      const persona = personas?.find((p) => p.id === score.persona_card_id);

                      return (
                        <div
                          key={score.persona_card_id}
                          className="p-4 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: persona?.color_hex || "#2383E2" }}
                              />
                              <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                                {formatPersonaName(persona?.display_name)}
                              </span>
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                ({persona?.audience_count} customers)
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                  score.fit_label === "High"
                                    ? "notion-pill-green"
                                    : score.fit_label === "Moderate"
                                    ? "notion-pill-blue"
                                    : "notion-pill-orange"
                                }`}
                              >
                                {score.fit_label} Fit
                              </span>
                              <span className="text-base font-semibold text-[#2383E2] tabular-nums">
                                {formatPercent(score.fit_score)}
                              </span>
                            </div>
                          </div>

                          {/* Fit Score Progress Bar */}
                          <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#2383E2] rounded-full"
                              style={{ width: `${score.fit_score * 100}%` }}
                            />
                          </div>

                          {/* Breakdown Components */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                            <div>
                              <span>Category Affinity:</span>
                              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                                {formatPercent(score.breakdown?.category_affinity ?? 0)}
                              </div>
                            </div>
                            <div>
                              <span>Spend Compatibility:</span>
                              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                                {score.breakdown?.spend_compatibility !== null && score.breakdown?.spend_compatibility !== undefined
                                  ? formatPercent(score.breakdown.spend_compatibility)
                                  : "N/A (Prospects)"}
                              </div>
                            </div>
                            <div>
                              <span>Recency Engagement:</span>
                              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                                {formatPercent(score.breakdown?.recency_engagement ?? 0)}
                              </div>
                            </div>
                            <div>
                              <span>Category Activity:</span>
                              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                                {formatPercent(score.breakdown?.category_activity ?? 0)}
                              </div>
                            </div>
                          </div>

                          {/* Plain-Language Explanation */}
                          <p className="text-xs text-neutral-600 dark:text-neutral-300 italic bg-[var(--notion-card-bg)] p-3 rounded-lg border border-[var(--notion-border)]">
                            &ldquo;{score.explanation || "Heuristic category affinity match based on historical order volume."}&rdquo;
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-neutral-500 dark:text-neutral-400 bg-[var(--notion-card-bg)] rounded-lg border border-[var(--notion-border)]">
                    Loading fit metrics for this product...
                  </div>
                )}
              </div>

              {/* Informational Note */}
              <div className="notion-callout p-3.5 rounded-lg flex items-start gap-2.5 text-xs text-neutral-600 dark:text-neutral-300">
                <Info className="h-4 w-4 text-[#2383E2] shrink-0 mt-0.5" />
                <span>
                  <strong>Audience Fit Guide:</strong> Product compatibility is determined by customer category purchases, price tier alignment, and store visit recency.
                </span>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-neutral-500 dark:text-neutral-400 space-y-2">
              <Package className="h-10 w-10 text-neutral-400 mx-auto" />
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">No Store Products Available</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto">
                Load or upload a store dataset to view catalog products and audience fit scores.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
