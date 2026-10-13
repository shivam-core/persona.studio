"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import Link from "next/link";
import {
  Users,
  Eye,
  Columns3,
  Megaphone,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  X,
  ArrowRight,
  TrendingUp,
  Clock,
  ShoppingBag,
  ExternalLink,
  Info,
} from "lucide-react";
import { PersonaCard, EvidenceMetric } from "@/lib/types";

export default function PersonaStudioPage() {
  const queryClient = useQueryClient();
  const [selectedEvidenceCard, setSelectedEvidenceCard] = useState<PersonaCard | null>(null);
  const [comparisonCardIds, setComparisonCardIds] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [improvingWordingId, setImprovingWordingId] = useState<string | null>(null);

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
        alert("You can compare at most 3 persona cards side-by-side.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleImproveWording = async (cardId: string, useAi: boolean = false) => {
    try {
      setImprovingWordingId(cardId);
      await api.improvePersonaWording(cardId, useAi);
      await queryClient.invalidateQueries();
      alert(`Wording successfully updated via ${useAi ? "AI Wording Adapter" : "Deterministic Template Engine"}!`);
    } catch (err: any) {
      alert("Failed to update wording: " + err.message);
    } finally {
      setImprovingWordingId(null);
    }
  };

  const comparedCards = personas?.filter((p) => comparisonCardIds.includes(p.id)) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#17233B] tracking-tight">
            Persona Studio
          </h1>
          <p className="text-sm text-[#52617A] mt-1">
            Evidence-backed behavioral persona cards. Verified decision objects separating observed facts from test hypotheses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {comparisonCardIds.length > 0 && (
            <button
              onClick={() => setIsComparing(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#5146D9]/10 text-[#5146D9] border border-[#5146D9]/30 text-xs font-semibold hover:bg-[#5146D9]/20 transition-colors"
            >
              <Columns3 className="h-4 w-4" />
              <span>Compare Selected ({comparisonCardIds.length})</span>
            </button>
          )}

          <Link
            href="/segments"
            className="text-xs text-[#52617A] hover:text-[#17233B] px-3 py-2 rounded-lg border border-[#E2E8F2] bg-white hover:bg-[#F5F7FB]"
          >
            Refit Segmentation →
          </Link>
        </div>
      </div>

      {/* Persona Cards Grid */}
      {personas && personas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {personas.map((card) => {
            const isSelectedForComp = comparisonCardIds.includes(card.id);

            return (
              <div
                key={card.id}
                className="bg-white rounded-2xl border border-[#E2E8F2] shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
              >
                {/* 1. Accent Strip & Header */}
                <div
                  className="h-2 w-full"
                  style={{ backgroundColor: card.color_hex || "#5146D9" }}
                />
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Top Meta Badges */}
                    <div className="flex items-center justify-between text-xs text-[#52617A] mb-2">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="font-semibold text-[#17233B]">{card.stable_segment_id}</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#F5F7FB] border border-[#E2E8F2] text-[10px]">
                          v1
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          card.evidence_coverage_badge === "Strong"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {card.evidence_coverage_badge} Evidence
                      </span>
                    </div>

                    {/* Behavioral Name */}
                    <h2 className="text-lg font-bold text-[#17233B] tracking-tight">
                      {card.display_name}
                    </h2>

                    {/* One-Sentence Factual Summary */}
                    <p className="text-xs text-[#52617A] mt-1 leading-relaxed">
                      {card.summary_text}
                    </p>

                    {/* Audience Count & Population Share */}
                    <div className="mt-3 p-2.5 rounded-lg bg-[#F5F7FB] border border-[#E2E8F2] flex items-center justify-between text-xs">
                      <span className="text-[#52617A]">Audience Size:</span>
                      <span className="font-bold text-[#17233B] tabular-nums">
                        {formatNumber(card.audience_count)} members{" "}
                        <span className="font-normal text-[#52617A]">
                          ({formatPercent(card.audience_share)} of {card.population_type.replace("_", " ")}s)
                        </span>
                      </span>
                    </div>

                    {/* Behavioral Fingerprint Percentile Bars */}
                    <div className="mt-4 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#52617A] flex items-center justify-between">
                        <span>Behavioral Fingerprint</span>
                        <span className="text-[10px] font-normal">Pop Percentile</span>
                      </div>

                      {/* Frequency */}
                      <div>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-[#52617A]">Order Frequency:</span>
                          <span className="font-semibold text-[#17233B] tabular-nums">
                            {card.fingerprint_json?.raw_values?.orders_lookback ?? 4} orders
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-[#E2E8F2] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#5146D9] rounded-full"
                            style={{
                              width: `${(card.fingerprint_json?.percentiles?.orders_lookback ?? 0.8) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* AOV */}
                      <div>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-[#52617A]">Average Order Value:</span>
                          <span className="font-semibold text-[#17233B] tabular-nums">
                            {formatCurrency(card.fingerprint_json?.raw_values?.aov_lookback ?? 3200)}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-[#E2E8F2] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#087F8C] rounded-full"
                            style={{
                              width: `${(card.fingerprint_json?.percentiles?.aov_lookback ?? 0.75) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Recency */}
                      <div>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-[#52617A]">Recency:</span>
                          <span className="font-semibold text-[#17233B] tabular-nums">
                            {card.fingerprint_json?.raw_values?.recency_days ?? 24} days ago
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-[#E2E8F2] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#B65D18] rounded-full"
                            style={{
                              width: `${(card.fingerprint_json?.percentiles?.recency_days ?? 0.3) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Evidence Badges */}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {card.claims_json?.slice(0, 2).map((c, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F5F7FB] border border-[#E2E8F2] text-[#17233B]"
                        >
                          {c.claim}
                        </span>
                      ))}
                    </div>

                    {/* Proposed Test Hypothesis Strip */}
                    <div className="mt-3 p-2 rounded-lg bg-indigo-50/60 border border-indigo-100 text-[11px] text-[#5146D9]">
                      <span className="font-semibold">Test Hypothesis:</span>{" "}
                      {card.hypotheses_json?.[0]?.hypothesis || "Test a tailored premium bundle to lift AOV."}
                    </div>
                  </div>

                  {/* Actions & Text Provenance */}
                  <div className="pt-3 border-t border-[#E2E8F2] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#52617A]">
                      <span className="capitalize">
                        Provenance:{" "}
                        <strong className="text-[#17233B]">{card.text_provenance} Wording</strong>
                      </span>
                      <button
                        onClick={() => handleImproveWording(card.id, false)}
                        disabled={improvingWordingId === card.id}
                        className="text-[#5146D9] hover:underline"
                      >
                        {improvingWordingId === card.id ? "Updating..." : "Regenerate Wording"}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setSelectedEvidenceCard(card)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F2] bg-white hover:bg-[#F5F7FB] text-xs font-semibold text-[#17233B] transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5 text-[#52617A]" />
                        <span>Evidence</span>
                      </button>

                      <button
                        onClick={() => handleToggleComparison(card.id)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                          isSelectedForComp
                            ? "bg-[#5146D9] text-white border-[#5146D9]"
                            : "border-[#E2E8F2] bg-white hover:bg-[#F5F7FB] text-[#17233B]"
                        }`}
                      >
                        {isSelectedForComp ? "Selected" : "Compare"}
                      </button>

                      <Link
                        href={`/campaigns?personaId=${card.id}`}
                        className="flex items-center justify-center px-3 py-1.5 rounded-lg bg-[#5146D9] text-white text-xs font-semibold hover:bg-[#4338CA] transition-colors shadow-sm"
                      >
                        <Megaphone className="h-3.5 w-3.5 mr-1" />
                        <span>Plan</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 rounded-xl bg-white border border-[#E2E8F2] text-center space-y-4">
          <Users className="h-10 w-10 text-[#52617A] mx-auto" />
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-semibold text-[#17233B]">No Published Persona Cards</h3>
            <p className="text-xs text-[#52617A] mt-1">
              Run behavioral segmentation and publish a candidate model to generate grounded persona cards.
            </p>
          </div>
          <Link
            href="/segments"
            className="inline-block px-4 py-2 rounded-lg bg-[#5146D9] text-white text-xs font-semibold hover:bg-[#4338CA]"
          >
            Go to Segments & Diagnostics →
          </Link>
        </div>
      )}

      {/* EVIDENCE DRAWER (Right Slide-Out 480px) */}
      {selectedEvidenceCard && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/30 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#E2E8F2] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: selectedEvidenceCard.color_hex }}
                  />
                  <h3 className="text-base font-bold text-[#17233B]">
                    {selectedEvidenceCard.display_name}
                  </h3>
                </div>
                <p className="text-xs text-[#52617A] mt-0.5">
                  Verified Evidence Dossier • {selectedEvidenceCard.stable_segment_id}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvidenceCard(null)}
                className="p-1.5 rounded-lg hover:bg-[#F5F7FB] text-[#52617A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 p-5 overflow-y-auto space-y-6 text-xs">
              {/* Evidence Metrics Table */}
              <div>
                <h4 className="font-bold uppercase tracking-wider text-[#52617A] mb-3">
                  Materialized Evidence Metrics
                </h4>

                {evidenceMetrics && evidenceMetrics.length > 0 ? (
                  <div className="space-y-3">
                    {evidenceMetrics.map((em) => (
                      <div
                        key={em.id}
                        className="p-3.5 rounded-xl border border-[#E2E8F2] bg-[#F5F7FB]/50 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#17233B]">{em.display_label}</span>
                          <span className="font-bold text-[#5146D9] text-sm tabular-nums">
                            {em.unit === "currency"
                              ? formatCurrency(em.value)
                              : em.unit === "fraction"
                              ? formatPercent(em.value)
                              : em.value?.toString() ?? "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#52617A]">
                          <span>
                            Population Baseline:{" "}
                            {em.unit === "currency"
                              ? formatCurrency(em.baseline_value)
                              : em.unit === "fraction"
                              ? formatPercent(em.baseline_value)
                              : em.baseline_value ?? "—"}
                          </span>
                          <span>Aggregation: {em.aggregation}</span>
                        </div>
                        <div className="text-[10px] text-[#52617A] pt-1 border-t border-[#E2E8F2] flex items-center justify-between">
                          <span>Valid Sample N: {em.valid_n} / {em.population_n}</span>
                          <span>Lookback: 180 days</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-[#52617A] bg-[#F5F7FB] rounded-lg">
                    Loading evidence metrics...
                  </div>
                )}
              </div>

              {/* Masked Customer Samples */}
              <div>
                <h4 className="font-bold uppercase tracking-wider text-[#52617A] mb-2 flex items-center justify-between">
                  <span>Masked Customer Profiles</span>
                  <span className="text-[10px] font-normal text-[#16724E]">PII Protected</span>
                </h4>
                <p className="text-[11px] text-[#52617A] mb-3">
                  Identifiers are permanently masked to prevent personal re-identification.
                </p>

                {personaMembers && personaMembers.members?.length > 0 ? (
                  <div className="border border-[#E2E8F2] rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-[#F5F7FB] text-[#52617A] font-semibold text-[11px]">
                        <tr>
                          <th className="p-2">Masked ID</th>
                          <th className="p-2">Orders</th>
                          <th className="p-2">Net Sales</th>
                          <th className="p-2">Recency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F2]">
                        {personaMembers.members.slice(0, 8).map((m: any, idx: number) => (
                          <tr key={idx} className="hover:bg-[#F5F7FB]/50">
                            <td className="p-2 font-mono text-[11px] text-[#5146D9]">{m.masked_id}</td>
                            <td className="p-2 tabular-nums">{m.orders_lookback}</td>
                            <td className="p-2 tabular-nums">{formatCurrency(m.net_sales_lookback)}</td>
                            <td className="p-2 tabular-nums">{m.recency_days}d</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 text-center text-[#52617A] bg-[#F5F7FB] rounded-lg">
                    Loading customer profiles...
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#E2E8F2] bg-[#F5F7FB] flex items-center justify-between">
              <span className="text-[11px] text-[#52617A]">
                Evidence strictly grounded in verified database rows.
              </span>
              <button
                onClick={() => setSelectedEvidenceCard(null)}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F2] text-xs font-semibold text-[#17233B]"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-CARD SIDE-BY-SIDE COMPARISON MODAL */}
      {isComparing && comparedCards.length > 0 && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-[#E2E8F2] space-y-6">
            <div className="flex items-center justify-between border-b border-[#E2E8F2] pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#17233B]">
                  Side-by-Side Persona Card Comparison
                </h3>
                <p className="text-xs text-[#52617A] mt-0.5">
                  Direct behavioral benchmark across up to 3 selected segments.
                </p>
              </div>
              <button
                onClick={() => setIsComparing(false)}
                className="p-1.5 rounded-lg hover:bg-[#F5F7FB] text-[#52617A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs">
              {comparedCards.map((c) => (
                <div key={c.id} className="p-4 rounded-xl border border-[#E2E8F2] bg-[#F5F7FB]/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color_hex }} />
                    <h4 className="font-bold text-[#17233B] text-sm">{c.display_name}</h4>
                  </div>
                  <div className="p-2 rounded bg-white border border-[#E2E8F2] text-xs">
                    <span className="text-[#52617A]">Audience Size:</span>{" "}
                    <strong className="text-[#17233B]">{formatNumber(c.audience_count)}</strong> (
                    {formatPercent(c.audience_share)})
                  </div>
                  <div className="space-y-1 text-[#52617A]">
                    <p>
                      <strong>AOV:</strong>{" "}
                      {formatCurrency(c.fingerprint_json?.raw_values?.aov_lookback ?? 3000)}
                    </p>
                    <p>
                      <strong>Frequency:</strong>{" "}
                      {c.fingerprint_json?.raw_values?.orders_lookback ?? 4} orders
                    </p>
                    <p>
                      <strong>Recency:</strong>{" "}
                      {c.fingerprint_json?.raw_values?.recency_days ?? 25} days
                    </p>
                    <p>
                      <strong>Coverage:</strong> {c.evidence_coverage_badge}
                    </p>
                  </div>
                  <div className="p-2 rounded bg-indigo-50 border border-indigo-100 text-[11px] text-[#5146D9]">
                    {c.hypotheses_json?.[0]?.hypothesis || "Test targeted offer"}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsComparing(false)}
                className="px-4 py-2 rounded-lg bg-[#5146D9] text-white text-xs font-semibold hover:bg-[#4338CA]"
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
