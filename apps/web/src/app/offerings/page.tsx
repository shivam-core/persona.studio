"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import Link from "next/link";
import {
  Package,
  Sparkles,
  Info,
  CheckCircle2,
  Megaphone,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Offering, OfferingFitScore, PersonaCard } from "@/lib/types";

export default function OfferingsPage() {
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#17233B] tracking-tight">
            Offerings Catalog & Persona Fit
          </h1>
          <p className="text-sm text-[#52617A] mt-1">
            Catalog of products, one-time services, and finite-horizon subscriptions with explainable persona fit heuristics.
          </p>
        </div>

        {activeOffering && (
          <Link
            href={`/campaigns?offeringId=${activeOffering.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5146D9] text-white text-sm font-medium hover:bg-[#4338CA] transition-colors shadow-sm"
          >
            <Megaphone className="h-4 w-4" />
            <span>Plan Campaign with {activeOffering.name}</span>
          </Link>
        )}
      </div>

      {/* Grid: Left Offering List, Right Explainable Fit Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Offerings List */}
        <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F2] pb-3">
            <h2 className="text-base font-semibold text-[#17233B]">
              Catalog Items ({offerings?.length || 0})
            </h2>
            <span className="text-xs text-[#52617A]">Click to inspect fit</span>
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {offerings?.map((offering) => {
              const isSelected = offering.id === activeOffering?.id;
              const unitMargin = offering.list_price - offering.unit_variable_cost;
              const marginPct = offering.list_price > 0 ? unitMargin / offering.list_price : 0;

              return (
                <div
                  key={offering.id}
                  onClick={() => setSelectedOfferingId(offering.id)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "border-[#5146D9] bg-indigo-50/40 shadow-xs"
                      : "border-[#E2E8F2] bg-white hover:bg-[#F5F7FB]"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-[#17233B]">
                    <span>{offering.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#F5F7FB] border border-[#E2E8F2] text-[#52617A]">
                      {offering.kind}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[#52617A] mt-2">
                    <span>Category: {offering.category}</span>
                    <span className="font-bold text-[#17233B] tabular-nums">
                      {formatCurrency(offering.list_price)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#52617A] mt-1 pt-1.5 border-t border-[#E2E8F2]">
                    <span>Unit COGS: {formatCurrency(offering.unit_variable_cost)}</span>
                    <span className="text-[#16724E] font-medium">
                      Margin: {formatPercent(marginPct)} ({formatCurrency(unitMargin)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Cols: Explainable Persona Fit Breakdown */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-6">
          {activeOffering ? (
            <>
              {/* Active Offering Header */}
              <div className="border-b border-[#E2E8F2] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#5146D9]/10 text-[#5146D9] border border-[#5146D9]/20">
                      {activeOffering.kind}
                    </span>
                    <h2 className="text-lg font-bold text-[#17233B]">{activeOffering.name}</h2>
                  </div>
                  <p className="text-xs text-[#52617A] mt-1">{activeOffering.description}</p>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-[#52617A]">List Price:</span>
                    <div className="font-bold text-base text-[#17233B] tabular-nums">
                      {formatCurrency(activeOffering.list_price)}
                    </div>
                  </div>
                  {activeOffering.capacity_units && (
                    <div>
                      <span className="text-[#52617A]">Capacity Cap:</span>
                      <div className="font-bold text-base text-[#17233B] tabular-nums">
                        {activeOffering.capacity_units} units
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Explainable Fit Heuristic Cards */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#52617A]">
                    Audience Compatibility Across Published Personas
                  </h3>
                  <span className="text-[11px] text-[#52617A]">
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
                          className="p-4 rounded-xl border border-[#E2E8F2] bg-[#F5F7FB]/50 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: persona?.color_hex || "#5146D9" }}
                              />
                              <span className="font-bold text-sm text-[#17233B]">
                                {persona?.display_name || "Persona"}
                              </span>
                              <span className="text-xs text-[#52617A]">
                                ({persona?.audience_count} profiles)
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  score.fit_label === "High"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : score.fit_label === "Moderate"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {score.fit_label} Fit
                              </span>
                              <span className="text-base font-bold text-[#5146D9] tabular-nums">
                                {formatPercent(score.fit_score)}
                              </span>
                            </div>
                          </div>

                          {/* Fit Score Progress Bar */}
                          <div className="h-2 w-full bg-[#E2E8F2] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#5146D9] rounded-full"
                              style={{ width: `${score.fit_score * 100}%` }}
                            />
                          </div>

                          {/* Breakdown Components */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-[#52617A]">
                            <div>
                              <span>Category Affinity:</span>
                              <div className="font-semibold text-[#17233B]">
                                {formatPercent(score.breakdown.category_affinity)}
                              </div>
                            </div>
                            <div>
                              <span>Spend Compatibility:</span>
                              <div className="font-semibold text-[#17233B]">
                                {score.breakdown.spend_compatibility !== null
                                  ? formatPercent(score.breakdown.spend_compatibility)
                                  : "N/A (Prospects)"}
                              </div>
                            </div>
                            <div>
                              <span>Recency Engagement:</span>
                              <div className="font-semibold text-[#17233B]">
                                {formatPercent(score.breakdown.recency_engagement)}
                              </div>
                            </div>
                            <div>
                              <span>Category Activity:</span>
                              <div className="font-semibold text-[#17233B]">
                                {formatPercent(score.breakdown.category_activity)}
                              </div>
                            </div>
                          </div>

                          {/* Plain-Language Explanation */}
                          <p className="text-xs text-[#52617A] italic bg-white p-2.5 rounded-lg border border-[#E2E8F2]">
                            &ldquo;{score.explanation}&rdquo;
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-[#52617A] bg-[#F5F7FB] rounded-lg">
                    Loading fit scores for this offering...
                  </div>
                )}
              </div>

              {/* Formula and Academic Note */}
              <div className="p-3.5 rounded-lg bg-[#F5F7FB] border border-[#E2E8F2] flex items-start gap-2.5 text-xs text-[#52617A]">
                <Info className="h-4 w-4 text-[#5146D9] shrink-0 mt-0.5" />
                <span>
                  <strong>Heuristic Disclosure:</strong> Offering fit is an explainable heuristic based on historical category share percentiles, price overlap, and engagement recency. It is an ordinal planning guide, <em>not an ML probability of purchase</em>.
                </span>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-[#52617A]">Select an offering to view fit scores.</div>
          )}
        </div>
      </div>
    </div>
  );
}
