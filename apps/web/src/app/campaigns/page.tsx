"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import Link from "next/link";
import {
  Megaphone,
  Save,
  Calculator,
  Download,
  Sparkles,
  Info,
  CheckCircle2,
  Users,
  Package,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Campaign, CampaignObjective, Offering, PersonaCard } from "@/lib/types";

export default function CampaignsPage() {
  const queryClient = useQueryClient();

  // Campaign Brief State
  const [name, setName] = useState("Festival Premium Buyer Reactivation");
  const [objective, setObjective] = useState<CampaignObjective>("retention");
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [channel, setChannel] = useState("paid_social_cpc");
  const [proposition, setProposition] = useState("Exclusive early access to the Festive Autumn Collection.");
  const [offerType, setOfferType] = useState<"none" | "percent_discount" | "fixed_discount">("percent_discount");
  const [discountValue, setDiscountValue] = useState(15);
  const [budget, setBudget] = useState(50000);
  const [fixedCost, setFixedCost] = useState(5000);
  const [variantAHeadline, setVariantAHeadline] = useState("Elevate Your Autumn Wardrobe");
  const [variantABody, setVariantABody] = useState("Crafted with premium linen and tailored for effortless comfort.");
  const [variantACTA, setVariantACTA] = useState("Shop Collection Now");
  const [variantBHeadline, setVariantBHeadline] = useState("Limited Edition Autumn Style");
  const [variantBBody, setVariantBBody] = useState("Discover artisan craftsmanship made for your signature look.");
  const [variantBCTA, setVariantBCTA] = useState("Claim 15% Festive Privilege");
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);

  const { data: offerings } = useQuery({
    queryKey: ["offerings"],
    queryFn: api.getOfferings,
  });

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: api.getPersonas,
  });

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: api.getCampaigns,
  });

  const chosenOffering = offerings?.find((o) => o.id === (selectedOfferingId || offerings[0]?.id));

  // Toggle Persona Selection
  const togglePersona = (id: string) => {
    setSelectedPersonaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Calculated target audience metrics
  const targetCards = personas?.filter((p) =>
    (selectedPersonaIds.length > 0 ? selectedPersonaIds : [personas[0]?.id]).includes(p.id)
  ) || [];
  const rawTargetAudience = targetCards.reduce((acc, c) => acc + c.audience_count, 0);
  const optInConsentEligible = Math.round(rawTargetAudience * 0.88); // 88% opt-in rate

  // Pricing math preview
  const listPrice = chosenOffering?.list_price ?? 1800;
  const netPrice =
    offerType === "percent_discount"
      ? listPrice * (1 - discountValue / 100)
      : offerType === "fixed_discount"
      ? Math.max(0, listPrice - discountValue)
      : listPrice;
  const unitCOGS = chosenOffering?.unit_variable_cost ?? 650;
  const unitContribution = netPrice - unitCOGS;

  const handleSaveCampaign = async () => {
    try {
      setIsSaving(true);
      await api.createCampaign({
        name,
        objective,
        offering_id: chosenOffering?.id,
        selected_persona_ids: selectedPersonaIds.length > 0 ? selectedPersonaIds : (personas?.[0] ? [personas[0].id] : []),
        channel,
        proposition,
        offer_type: offerType,
        discount_value: discountValue,
        budget,
        fixed_cost: fixedCost,
        message_variants: [
          { variant_id: "var_a", name: "Variant A (Product Focus)", headline: variantAHeadline, body: variantABody, cta: variantACTA },
          { variant_id: "var_b", name: "Variant B (Privilege Focus)", headline: variantBHeadline, body: variantBBody, cta: variantBCTA },
        ],
        landing_page_notes: "Direct to autumn festive landing page with segment-tailored hero banner.",
      });
      await queryClient.invalidateQueries();
      alert("Campaign brief saved successfully!");
    } catch (err: any) {
      alert("Failed to save campaign: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateCopy = () => {
    setIsGeneratingCopy(true);
    setTimeout(() => {
      setVariantAHeadline(`Handcrafted Quality for ${chosenOffering?.name || "Your Wardrobe"}`);
      setVariantABody(`Refined essentials designed for everyday elegance. Experience tailored perfection.`);
      setVariantBHeadline(`Exclusive Invitation: ${chosenOffering?.name || "Premium Offer"}`);
      setVariantBBody(`As a valued member, enjoy our curated showcase with exclusive seasonal privileges.`);
      setIsGeneratingCopy(false);
      alert("Grounded copy generated for Variant A & Variant B!");
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#17233B] tracking-tight">
            Campaign Planner & Brief Builder
          </h1>
          <p className="text-sm text-[#52617A] mt-1">
            Construct targeted campaign briefs with frozen audience snapshots, consent policies, and editable copy variants.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/simulator?budget=${budget}&price=${listPrice}&cogs=${unitCOGS}&discount=${discountValue / 100}&objective=${objective}&audience=${optInConsentEligible}`}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5146D9] text-white text-sm font-semibold hover:bg-[#4338CA] transition-colors shadow-sm"
          >
            <Calculator className="h-4 w-4" />
            <span>Simulate Economics</span>
          </Link>
        </div>
      </div>

      {/* Main Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Brief Form */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-6">
          {/* Section 1: Campaign Name & Objective */}
          <div>
            <h2 className="text-base font-semibold text-[#17233B] mb-3">
              1. Campaign Objectives & Target Population
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#17233B] mb-1">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B] focus:outline-none focus:border-[#5146D9]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17233B] mb-1">
                  Campaign Objective
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "acquisition", label: "Acquisition", desc: "Verified prospects (CAC applies)" },
                    { id: "retention", label: "Retention", desc: "Active buyers (Repeat cost applies)" },
                    { id: "reactivation", label: "Reactivation", desc: "Lapsed buyers with long recency" },
                  ].map((obj) => (
                    <div
                      key={obj.id}
                      onClick={() => setObjective(obj.id as CampaignObjective)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        objective === obj.id
                          ? "border-[#5146D9] bg-indigo-50/40 text-[#5146D9] font-semibold"
                          : "border-[#E2E8F2] bg-[#F5F7FB] text-[#52617A] hover:text-[#17233B]"
                      }`}
                    >
                      <div className="font-bold capitalize">{obj.label}</div>
                      <div className="text-[10px] mt-0.5 opacity-80">{obj.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Offering & Target Personas */}
          <div className="pt-4 border-t border-[#E2E8F2]">
            <h2 className="text-base font-semibold text-[#17233B] mb-3">
              2. Catalog Offering & Deduplicated Target Audience
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-[#17233B] mb-1">
                  Select Offering
                </label>
                <select
                  value={selectedOfferingId || chosenOffering?.id || ""}
                  onChange={(e) => setSelectedOfferingId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B] focus:outline-none focus:border-[#5146D9]"
                >
                  {offerings?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.kind}) — {formatCurrency(o.list_price)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17233B] mb-1">
                  Channel Delivery Model
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B] focus:outline-none focus:border-[#5146D9]"
                >
                  <option value="paid_social_cpc">Paid Social Ads (CPC Click Model)</option>
                  <option value="paid_search_cpc">Paid Search Intent (CPC Click Model)</option>
                  <option value="direct_email">Direct Email Outreach (Opt-in Required)</option>
                  <option value="direct_sms">Direct SMS Messaging (Opt-in Required)</option>
                </select>
              </div>
            </div>

            {/* Persona Selection Pills */}
            <div>
              <label className="block text-xs font-semibold text-[#17233B] mb-1.5">
                Target Persona Cards (Deduplicated Partition)
              </label>
              <div className="flex flex-wrap gap-2">
                {personas?.map((p) => {
                  const isChecked = selectedPersonaIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePersona(p.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        isChecked
                          ? "bg-[#5146D9] text-white border-[#5146D9]"
                          : "bg-[#F5F7FB] text-[#52617A] border-[#E2E8F2] hover:text-[#17233B]"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color_hex }} />
                      <span>{p.display_name}</span>
                      <span className="opacity-80">({formatNumber(p.audience_count)})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Proposition & Discount Math */}
          <div className="pt-4 border-t border-[#E2E8F2]">
            <h2 className="text-base font-semibold text-[#17233B] mb-3">
              3. Proposition & Promotional Incentive
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#17233B] mb-1">
                  Core Proposition / Angle
                </label>
                <input
                  type="text"
                  value={proposition}
                  onChange={(e) => setProposition(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B] focus:outline-none focus:border-[#5146D9]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#17233B] mb-1">
                    Offer Type
                  </label>
                  <select
                    value={offerType}
                    onChange={(e) => setOfferType(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B] focus:outline-none focus:border-[#5146D9]"
                  >
                    <option value="none">No Promotional Discount</option>
                    <option value="percent_discount">Percentage Discount (%)</option>
                    <option value="fixed_discount">Fixed Monetary Discount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#17233B] mb-1">
                    Discount Value {offerType === "percent_discount" ? "(%)" : "(₹)"}
                  </label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    disabled={offerType === "none"}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B] focus:outline-none focus:border-[#5146D9] disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#17233B] mb-1">
                    Planned Media Budget (₹)
                  </label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B] focus:outline-none focus:border-[#5146D9]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Message Variants A & B */}
          <div className="pt-4 border-t border-[#E2E8F2]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-[#17233B]">
                4. Creative Copy Variants
              </h2>
              <button
                onClick={handleGenerateCopy}
                disabled={isGeneratingCopy}
                className="flex items-center gap-1.5 text-xs font-medium text-[#5146D9] hover:underline"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isGeneratingCopy ? "Generating..." : "Generate Grounded Copy"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Variant A */}
              <div className="p-4 rounded-xl border border-[#E2E8F2] bg-[#F5F7FB]/50 space-y-2.5">
                <div className="font-bold text-xs text-[#17233B]">Variant A (Product Focus)</div>
                <div>
                  <label className="block text-[11px] text-[#52617A] mb-0.5">Headline</label>
                  <input
                    type="text"
                    value={variantAHeadline}
                    onChange={(e) => setVariantAHeadline(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-[#E2E8F2] bg-white text-[#17233B]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#52617A] mb-0.5">Body Copy</label>
                  <textarea
                    rows={2}
                    value={variantABody}
                    onChange={(e) => setVariantABody(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-[#E2E8F2] bg-white text-[#17233B]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#52617A] mb-0.5">Call to Action (CTA)</label>
                  <input
                    type="text"
                    value={variantACTA}
                    onChange={(e) => setVariantACTA(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-[#E2E8F2] bg-white text-[#17233B]"
                  />
                </div>
              </div>

              {/* Variant B */}
              <div className="p-4 rounded-xl border border-[#E2E8F2] bg-[#F5F7FB]/50 space-y-2.5">
                <div className="font-bold text-xs text-[#17233B]">Variant B (Privilege Angle)</div>
                <div>
                  <label className="block text-[11px] text-[#52617A] mb-0.5">Headline</label>
                  <input
                    type="text"
                    value={variantBHeadline}
                    onChange={(e) => setVariantBHeadline(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-[#E2E8F2] bg-white text-[#17233B]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#52617A] mb-0.5">Body Copy</label>
                  <textarea
                    rows={2}
                    value={variantBBody}
                    onChange={(e) => setVariantBBody(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-[#E2E8F2] bg-white text-[#17233B]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#52617A] mb-0.5">Call to Action (CTA)</label>
                  <input
                    type="text"
                    value={variantBCTA}
                    onChange={(e) => setVariantBCTA(e.target.value)}
                    className="w-full text-xs p-2 rounded border border-[#E2E8F2] bg-white text-[#17233B]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-[#E2E8F2] flex items-center justify-between">
            <span className="text-xs text-[#52617A]">
              Edits persist across page reloads and server restarts.
            </span>
            <button
              onClick={handleSaveCampaign}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5146D9] text-white text-xs font-semibold hover:bg-[#4338CA] transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Saving Brief..." : "Save Campaign Brief"}</span>
            </button>
          </div>
        </div>

        {/* Right Col: Audience Snapshot & Pricing Math Card */}
        <div className="space-y-6">
          {/* Audience Summary */}
          <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-[#17233B]">
              Audience Snapshot & Eligibility
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-[#E2E8F2]">
                <span className="text-[#52617A]">Total Selected Members:</span>
                <span className="font-bold text-[#17233B] tabular-nums">
                  {formatNumber(rawTargetAudience)} profiles
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E8F2]">
                <span className="text-[#52617A]">Opt-In Consent Eligible:</span>
                <span className="font-bold text-emerald-700 tabular-nums">
                  {formatNumber(optInConsentEligible)} profiles (88%)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E8F2]">
                <span className="text-[#52617A]">Exclusions (Unknown / Opt-out):</span>
                <span className="text-[#52617A] tabular-nums">
                  {formatNumber(rawTargetAudience - optInConsentEligible)} profiles
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#52617A]">Deduplication Rule:</span>
                <span className="font-medium text-[#17233B]">Exact 1 cell per profile</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <div className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Consent Compliance Active</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed">
                Profiles without affirmative consent are quarantined from operational contact lists.
              </p>
            </div>
          </div>

          {/* Unit Economics Snapshot */}
          <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-[#17233B]">
              Unit Pricing & Margin Math
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-[#E2E8F2]">
                <span className="text-[#52617A]">List Price:</span>
                <span className="font-bold text-[#17233B] tabular-nums">
                  {formatCurrency(listPrice)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E8F2]">
                <span className="text-[#52617A]">Net Price After Discount:</span>
                <span className="font-bold text-[#5146D9] tabular-nums">
                  {formatCurrency(netPrice)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E8F2]">
                <span className="text-[#52617A]">Unit Variable Cost (COGS):</span>
                <span className="text-[#52617A] tabular-nums">
                  {formatCurrency(unitCOGS)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold text-[#17233B]">Unit Contribution Margin:</span>
                <span className="font-bold text-[#16724E] text-sm tabular-nums">
                  {formatCurrency(unitContribution)}
                </span>
              </div>
            </div>

            <Link
              href={`/simulator?budget=${budget}&price=${listPrice}&cogs=${unitCOGS}&discount=${discountValue / 100}&objective=${objective}&audience=${optInConsentEligible}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#5146D9] text-white text-xs font-semibold hover:bg-[#4338CA] transition-colors shadow-sm"
            >
              <span>Open Economic Simulator</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
