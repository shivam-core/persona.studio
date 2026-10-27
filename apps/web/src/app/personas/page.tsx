"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatPersonaName,
  formatSegmentBadge,
  humanizePersonaSummary,
} from "@/lib/formatters";
import Link from "next/link";
import {
  Users,
  Eye,
  Megaphone,
  CheckCircle2,
  X,
  ArrowRight,
  TrendingUp,
  ShoppingBag,
  Clock,
  Sparkles,
  Calculator,
  Database,
  AlertCircle,
  FileText,
} from "lucide-react";
import { PersonaCard } from "@/lib/types";
import { NotionEmptyStateIllustration, NotionGirlCreator } from "@/components/illustrations/NotionIllustrations";

const PERSONA_EMOJIS = ["👤", "💎", "🛍️", "🎯", "⚡", "🌟"];

export default function PersonaStudioPage() {
  const queryClient = useQueryClient();
  const [selectedEvidenceCard, setSelectedEvidenceCard] = useState<PersonaCard | null>(null);
  const [comparisonCardIds, setComparisonCardIds] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
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

  const { data: personas, isLoading } = useQuery({
    queryKey: ["personas"],
    queryFn: api.getPersonas,
  });

  const { data: evidenceMetrics } = useQuery({
    queryKey: ["persona-evidence", selectedEvidenceCard?.id],
    queryFn: () => (selectedEvidenceCard ? api.getPersonaEvidence(selectedEvidenceCard.id) : null),
    enabled: !!selectedEvidenceCard?.id,
  });

  const { data: personaMembers } = useQuery({
    queryKey: ["persona-members", selectedEvidenceCard?.id],
    queryFn: () => (selectedEvidenceCard ? api.getPersonaMembers(selectedEvidenceCard.id) : null),
    enabled: !!selectedEvidenceCard?.id,
  });

  const handleToggleComparison = (id: string) => {
    setComparisonCardIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 3) {
        alert("You can compare up to 3 persona cards side-by-side.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const comparedCards = personas?.filter((p) => comparisonCardIds.includes(p.id)) || [];

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
                Persona Studio Zero State (No Personas Generated)
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                Customer personas, spending fingerprints, and purchase evidence are initialized at zero. Upload a CSV file or load our preloaded retail dataset to generate behavioral personas.
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
            <span className="text-2xl">👥</span>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Persona Studio
            </h1>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Audience behavioral profiles synthesized from verified store purchase records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {comparisonCardIds.length > 0 && (
            <button
              onClick={() => setIsComparing(true)}
              className="notion-btn-secondary text-xs"
            >
              <span>Compare ({comparisonCardIds.length})</span>
            </button>
          )}
          <Link
            href="/segments"
            className="notion-btn-primary text-xs"
          >
            <span>Audience Segments</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Persona Cards Grid (Notion Gallery Cards) */}
      {personas && personas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {personas.map((card, idx) => {
            const isSelectedForComp = comparisonCardIds.includes(card.id);
            const emoji = PERSONA_EMOJIS[idx % PERSONA_EMOJIS.length];

            // Extract fingerprint values safely
            const fp = (card as any).fingerprint ?? (card as any).fingerprint_json;
            const rawOrders = fp?.raw_values?.orders_lookback ?? fp?.order_frequency?.raw ?? 2;
            const rawAov = fp?.raw_values?.aov_lookback ?? fp?.average_order_value?.raw ?? 3000;
            const rawRec = fp?.raw_values?.recency_days ?? fp?.recency_recency?.raw ?? 95;

            return (
              <div
                key={card.id}
                className="notion-card p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-all group"
              >
                <div>
                  {/* Notion Header with Icon & Segment Badge */}
                  <div className="flex items-center justify-between text-xs mb-2.5">
                    <span className="text-2xl p-1.5 rounded-md bg-[var(--notion-hover)]">
                      {emoji}
                    </span>
                    <span className="notion-pill-purple text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                      {formatSegmentBadge(card.stable_segment_id, idx)}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight group-hover:text-[#2383E2] transition-colors">
                    {formatPersonaName(card.display_name, idx)}
                  </h2>

                  {/* Summary Callout */}
                  <div className="notion-callout mt-2 text-xs py-2 px-2.5 text-neutral-600 dark:text-neutral-300 min-h-[46px]">
                    {humanizePersonaSummary(card.summary_text)}
                  </div>

                  {/* Audience Reach Block */}
                  <div className="mt-3 p-2.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-hover)] flex items-center justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">Audience Reach:</span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                      {formatNumber(card.audience_count)} shoppers{" "}
                      <span className="font-normal text-neutral-500 dark:text-neutral-400">
                        ({formatPercent(card.audience_share)})
                      </span>
                    </span>
                  </div>

                  {/* Purchase Profile Signals */}
                  <div className="mt-4 space-y-2.5 pt-2 border-t border-[var(--notion-border)]">
                    <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                      <span>PURCHASE SIGNALS</span>
                      <span className="font-normal">180d Lookback</span>
                    </div>

                    {/* Order Frequency */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 dark:text-neutral-400">Order Frequency:</span>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
                        {rawOrders} orders
                      </span>
                    </div>

                    {/* Average Order Value */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 dark:text-neutral-400">Average Basket:</span>
                      <span className="font-semibold text-[#2383E2] tabular-nums">
                        {formatCurrency(rawAov)}
                      </span>
                    </div>

                    {/* Recency */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 dark:text-neutral-400">Last Seen:</span>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
                        {rawRec} days ago
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-[var(--notion-border)] flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedEvidenceCard(card)}
                    className="flex-1 notion-btn-secondary text-xs py-1 px-2"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Audit</span>
                  </button>

                  <Link
                    href={`/cac-simulator?personaId=${card.id}`}
                    className="notion-btn-secondary text-xs py-1 px-2"
                    title="Simulate CAC for this persona"
                  >
                    <Calculator className="h-3.5 w-3.5 text-[#2383E2]" />
                    <span>CAC</span>
                  </Link>

                  <button
                    onClick={() => handleToggleComparison(card.id)}
                    className={`notion-btn-secondary text-xs py-1 px-2 ${
                      isSelectedForComp
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold"
                        : ""
                    }`}
                  >
                    {isSelectedForComp ? "Selected" : "Compare"}
                  </button>

                  <Link
                    href={`/campaigns?personaId=${card.id}`}
                    className="notion-btn-primary text-xs py-1 px-2"
                  >
                    <span>Plan</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 notion-card text-center space-y-4">
          <NotionEmptyStateIllustration className="w-32 h-auto mx-auto opacity-80" />
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              No Active Persona Cards
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Load our preloaded store dataset or run audience segmentation to generate verified customer personas.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2.5">
            {!hasData && (
              <button
                onClick={handleLoadRealData}
                disabled={isLoadingReal}
                className="notion-btn-primary text-xs"
              >
                <Database className={`h-3.5 w-3.5 ${isLoadingReal ? "animate-spin" : ""}`} />
                <span>{isLoadingReal ? "Loading Records..." : "Load Retail Dataset (1-Click)"}</span>
              </button>
            )}
            <Link
              href="/segments"
              className="notion-btn-secondary text-xs"
            >
              Go to Audience Segments →
            </Link>
          </div>
        </div>
      )}

      {/* AUDIT DETAILS DRAWER (Notion Database Page Slideover) */}
      {selectedEvidenceCard && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[var(--notion-card-bg)] border-l border-[var(--notion-border)] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[var(--notion-border)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {formatPersonaName(selectedEvidenceCard.display_name)}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Verified Purchase Evidence • {formatSegmentBadge(selectedEvidenceCard.stable_segment_id)}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvidenceCard(null)}
                className="p-1.5 rounded-md hover:bg-[var(--notion-hover)] text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 p-5 overflow-y-auto space-y-6 text-xs">
              {/* Evidence Metrics Table */}
              <div>
                <h4 className="notion-kicker mb-3">
                  OBSERVED PURCHASE SIGNALS
                </h4>

                {evidenceMetrics && evidenceMetrics.length > 0 ? (
                  <div className="space-y-2.5">
                    {evidenceMetrics.map((em) => (
                      <div
                        key={em.id}
                        className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-hover)] space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">{em.display_label}</span>
                          <span className="font-bold text-[#2383E2] text-sm tabular-nums">
                            {em.unit === "currency"
                              ? formatCurrency(em.value)
                              : em.unit === "fraction"
                              ? formatPercent(em.value)
                              : em.value?.toString() ?? "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                          <span>
                            Store Baseline:{" "}
                            {em.unit === "currency"
                              ? formatCurrency(em.baseline_value)
                              : em.unit === "fraction"
                              ? formatPercent(em.baseline_value)
                              : em.baseline_value ?? "—"}
                          </span>
                          <span>Method: {em.aggregation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-neutral-400 bg-[var(--notion-hover)] rounded-lg border border-[var(--notion-border)]">
                    Loading customer signals...
                  </div>
                )}
              </div>

              {/* Privacy Masked Customer Sample Records */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="notion-kicker">
                    SAMPLE CUSTOMER RECORDS
                  </h4>
                  <span className="notion-pill-green text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                    Privacy Protected
                  </span>
                </div>

                {personaMembers && personaMembers.members?.length > 0 ? (
                  <div className="border border-[var(--notion-border)] rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 font-semibold text-[11px] border-b border-[var(--notion-border)]">
                        <tr>
                          <th className="p-2.5">Customer ID</th>
                          <th className="p-2.5">Orders</th>
                          <th className="p-2.5">Net Spend</th>
                          <th className="p-2.5">Last Active</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--notion-border)] text-neutral-900 dark:text-neutral-100">
                        {personaMembers.members.slice(0, 8).map((m: any, idx: number) => (
                          <tr key={idx} className="hover:bg-[var(--notion-hover)]">
                            <td className="p-2.5 font-mono text-[11px] text-[#2383E2]">{m.masked_id}</td>
                            <td className="p-2.5 tabular-nums">{m.orders_lookback}</td>
                            <td className="p-2.5 tabular-nums">{formatCurrency(m.net_sales_lookback)}</td>
                            <td className="p-2.5 tabular-nums">{m.recency_days}d ago</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-neutral-400 bg-[var(--notion-hover)] rounded-lg border border-[var(--notion-border)]">
                    Loading sample records...
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] flex items-center justify-end">
              <button
                onClick={() => setSelectedEvidenceCard(null)}
                className="notion-btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-CARD SIDE-BY-SIDE NOTION COMPARISON MODAL */}
      {isComparing && comparedCards.length > 0 && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--notion-card-bg)] rounded-xl max-w-4xl w-full p-6 shadow-2xl border border-[var(--notion-border)] space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--notion-border)] pb-3">
              <div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <span>⚖️</span>
                  <span>Side-by-Side Persona Comparison</span>
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Direct behavioral benchmark across {comparedCards.length} customer segments.
                </p>
              </div>
              <button
                onClick={() => setIsComparing(false)}
                className="p-1.5 rounded-md hover:bg-[var(--notion-hover)] text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {comparedCards.map((c, idx) => (
                <div key={c.id} className="p-4 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-hover)] space-y-3">
                  <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">{formatPersonaName(c.display_name, idx)}</h4>
                  <div className="p-2 rounded-md bg-[var(--notion-card-bg)] border border-[var(--notion-border)] text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400">Audience:</span>{" "}
                    <strong className="text-neutral-900 dark:text-neutral-100">{formatNumber(c.audience_count)}</strong> (
                    {formatPercent(c.audience_share)})
                  </div>
                  <div className="space-y-1.5 text-neutral-700 dark:text-neutral-300">
                    <p>
                      <span className="text-neutral-500 dark:text-neutral-400">Avg Basket:</span>{" "}
                      {formatCurrency(c.fingerprint_json?.raw_values?.aov_lookback ?? 3000)}
                    </p>
                    <p>
                      <span className="text-neutral-500 dark:text-neutral-400">Frequency:</span>{" "}
                      {c.fingerprint_json?.raw_values?.orders_lookback ?? 2} purchases
                    </p>
                    <p>
                      <span className="text-neutral-500 dark:text-neutral-400">Recency:</span>{" "}
                      {c.fingerprint_json?.raw_values?.recency_days ?? 95} days
                    </p>
                  </div>
                  <div className="notion-pill-blue p-2.5 rounded-md text-[11px] leading-relaxed">
                    {c.hypotheses_json?.[0]?.hypothesis || "Targeted promotion with early perks"}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsComparing(false)}
                className="notion-btn-primary text-xs"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
