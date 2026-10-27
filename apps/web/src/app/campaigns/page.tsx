"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent, formatPersonaName } from "@/lib/formatters";
import Link from "next/link";
import {
  Megaphone,
  Save,
  Calculator,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Database,
  AlertCircle,
} from "lucide-react";
import { CampaignObjective } from "@/lib/types";
import { NotionGirlCreator } from "@/components/illustrations/NotionIllustrations";

export default function CampaignsPage() {
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

  // Campaign Brief State - Defaults to 0 when no dataset is loaded
  const [name, setName] = useState("New Campaign Brief");
  const [objective, setObjective] = useState<CampaignObjective>("retention");
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>("");
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [channel, setChannel] = useState("paid_social_cpc");
  const [proposition, setProposition] = useState("");
  const [offerType, setOfferType] = useState<"none" | "percent_discount" | "fixed_discount">("percent_discount");
  const [discountValue, setDiscountValue] = useState(0);
  const [budget, setBudget] = useState(0);
  const [fixedCost, setFixedCost] = useState(0);
  const [variantAHeadline, setVariantAHeadline] = useState("");
  const [variantABody, setVariantABody] = useState("");
  const [variantACTA, setVariantACTA] = useState("");
  const [variantBHeadline, setVariantBHeadline] = useState("");
  const [variantBBody, setVariantBBody] = useState("");
  const [variantBCTA, setVariantBCTA] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);

  // Auto-hydrate realistic values once a dataset is loaded
  useEffect(() => {
    if (hasData && budget === 0) {
      setName("Festival Premium Buyer Reactivation");
      setProposition("Exclusive early access to the Festive Autumn Collection.");
      setDiscountValue(15);
      setBudget(50000);
      setFixedCost(5000);
      setVariantAHeadline("Elevate Your Autumn Wardrobe");
      setVariantABody("Crafted with premium linen and tailored for effortless comfort.");
      setVariantACTA("Shop Collection Now");
      setVariantBHeadline("Limited Edition Autumn Style");
      setVariantBBody("Discover artisan craftsmanship made for your signature look.");
      setVariantBCTA("Claim 15% Festive Privilege");
    } else if (!hasData && budget > 0) {
      setName("New Campaign Brief");
      setProposition("");
      setDiscountValue(0);
      setBudget(0);
      setFixedCost(0);
      setVariantAHeadline("");
      setVariantABody("");
      setVariantACTA("");
      setVariantBHeadline("");
      setVariantBBody("");
      setVariantBCTA("");
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

  const { data: offerings } = useQuery({
    queryKey: ["offerings"],
    queryFn: api.getOfferings,
  });

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: api.getPersonas,
  });

  const chosenOffering = offerings?.find((o) => o.id === (selectedOfferingId || offerings[0]?.id));

  // Toggle Persona Selection
  const togglePersona = (id: string) => {
    setSelectedPersonaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Target audience metrics - Strictly 0 when no dataset is loaded
  const targetCards = hasData
    ? (personas?.filter((p) =>
        (selectedPersonaIds.length > 0 ? selectedPersonaIds : [personas[0]?.id]).includes(p.id)
      ) || [])
    : [];
  const rawTargetAudience = hasData ? targetCards.reduce((acc, c) => acc + c.audience_count, 0) : 0;
  const optInConsentEligible = hasData ? Math.round(rawTargetAudience * 0.88) : 0;

  // Pricing math preview - Strictly 0 when no dataset is loaded
  const listPrice = hasData ? (chosenOffering?.list_price ?? 0) : 0;
  const netPrice = hasData
    ? (offerType === "percent_discount"
        ? listPrice * (1 - discountValue / 100)
        : offerType === "fixed_discount"
        ? Math.max(0, listPrice - discountValue)
        : listPrice)
    : 0;
  const unitCOGS = hasData ? (chosenOffering?.unit_variable_cost ?? 0) : 0;
  const unitContribution = hasData ? (netPrice - unitCOGS) : 0;

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
      });
      await queryClient.invalidateQueries();
      alert(`Campaign "${name}" saved successfully!`);
    } catch (err: any) {
      alert("Failed to save campaign: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateCopy = async () => {
    try {
      setIsGeneratingCopy(true);
      // Generate instant creative messaging tailored to offering and persona
      const pName = personas?.find((p) => selectedPersonaIds.includes(p.id))?.display_name || "Valued Customers";
      const oName = chosenOffering?.name || "Festive Apparel Collection";

      setVariantAHeadline(`Handpicked for You: The New ${oName}`);
      setVariantABody(`As one of our ${pName}, enjoy an exclusive first look at the new collection with complimentary store concierge handling.`);
      setVariantACTA("Explore Collection");

      setVariantBHeadline(`Reserved VIP Preview: ${oName}`);
      setVariantBBody(`Celebrate the season with early-access privileges. Reserved specially for our top shoppers this weekend only.`);
      setVariantBCTA("Claim Access");

      alert("Creative copy variants generated!");
    } catch (err: any) {
      alert("Failed to generate copy: " + err.message);
    } finally {
      setIsGeneratingCopy(false);
    }
  };

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
                Campaign Planner Zero State (No Dataset Loaded)
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed max-w-xl">
                Audience reach, segment sizes, and unit margin contribution are initialized at zero. Upload a CSV file or click to load our preloaded retail dataset to activate campaign planning.
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
            <span className="text-2xl">📢</span>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span>Campaign Planner</span>
              <span className="notion-pill-purple text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                Brief Builder
              </span>
            </h1>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-2xl leading-relaxed">
            Configure targeted marketing initiatives, select personas, allocate channel budgets, and generate creative copy variants.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/simulator?budget=${budget}&price=${listPrice}&cogs=${unitCOGS}&discount=${discountValue / 100}&objective=${objective}&audience=${optInConsentEligible}`}
            className="notion-btn-primary text-xs flex items-center gap-1.5 py-1 px-3"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>Forecast Financials</span>
          </Link>
        </div>
      </div>

      {/* Main Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Interactive Form */}
        <div className="lg:col-span-8 notion-card p-6 space-y-6">
          {/* Section 1: Campaign Details */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
              1. Campaign Goal & Objective
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full notion-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Campaign Objective
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "acquisition", label: "Acquisition", desc: "Attract new buyers" },
                    { id: "retention", label: "Retention", desc: "Drive repeat orders" },
                    { id: "reactivation", label: "Winback", desc: "Re-engage lapsed shoppers" },
                  ].map((obj) => (
                    <div
                      key={obj.id}
                      onClick={() => setObjective(obj.id as CampaignObjective)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        objective === obj.id
                          ? "border-[#2383E2] bg-blue-50/60 dark:bg-blue-950/30 text-neutral-900 dark:text-neutral-100 shadow-sm"
                          : "border-[var(--notion-border)] bg-[var(--notion-card-bg)] text-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-600"
                      }`}
                    >
                      <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">{obj.label}</div>
                      <div className="text-[10px] mt-0.5 text-neutral-500 dark:text-neutral-400">{obj.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Product & Personas */}
          <div className="pt-4 border-t border-[var(--notion-border)]">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
              2. Product & Target Personas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Promoted Product
                </label>
                <select
                  value={selectedOfferingId || chosenOffering?.id || ""}
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

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Marketing Channel
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full notion-input text-xs"
                >
                  <option value="paid_social_cpc">Paid Social Ads (CPC Click Model)</option>
                  <option value="paid_search_cpc">Paid Search Intent (CPC Click Model)</option>
                  <option value="direct_email">Direct Email Outreach</option>
                  <option value="direct_sms">Direct SMS Messaging</option>
                </select>
              </div>
            </div>

            {/* Persona Selection Pills */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Target Personas
              </label>
              <div className="flex flex-wrap gap-2">
                {personas?.map((p, idx) => {
                  const isChecked = selectedPersonaIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePersona(p.id)}
                      className={`px-3 py-1.5 rounded-md border text-xs transition-all flex items-center gap-2 ${
                        isChecked
                          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 font-semibold border-neutral-900 dark:border-neutral-100"
                          : "bg-[var(--notion-sidebar-bg)] text-neutral-700 dark:text-neutral-300 border-[var(--notion-border)] hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color_hex || "#2383E2" }} />
                      <span>{formatPersonaName(p.display_name, idx)}</span>
                      <span className="opacity-70 text-[10px]">({formatNumber(p.audience_count)})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Creative Copy Variants */}
          <div className="pt-4 border-t border-[var(--notion-border)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                3. Creative Message Variants
              </h2>
              <button
                onClick={handleGenerateCopy}
                disabled={isGeneratingCopy}
                className="notion-btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5"
              >
                <Sparkles className="h-3 w-3 text-[#D9730D]" />
                <span>{isGeneratingCopy ? "Drafting..." : "Generate AI Copy"}</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Core Value Proposition
                </label>
                <textarea
                  value={proposition}
                  onChange={(e) => setProposition(e.target.value)}
                  rows={2}
                  className="w-full notion-input text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[var(--notion-sidebar-bg)] border border-[var(--notion-border)] space-y-2">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">Variant A (Product Focus)</div>
                  <div>
                    <label className="text-[10px] text-neutral-500 dark:text-neutral-400">Headline</label>
                    <input
                      type="text"
                      value={variantAHeadline}
                      onChange={(e) => setVariantAHeadline(e.target.value)}
                      className="w-full notion-input text-xs mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 dark:text-neutral-400">Body</label>
                    <textarea
                      value={variantABody}
                      onChange={(e) => setVariantABody(e.target.value)}
                      rows={2}
                      className="w-full notion-input text-xs mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 dark:text-neutral-400">Call to Action</label>
                    <input
                      type="text"
                      value={variantACTA}
                      onChange={(e) => setVariantACTA(e.target.value)}
                      className="w-full notion-input text-xs mt-1"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[var(--notion-sidebar-bg)] border border-[var(--notion-border)] space-y-2">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">Variant B (Privilege Focus)</div>
                  <div>
                    <label className="text-[10px] text-neutral-500 dark:text-neutral-400">Headline</label>
                    <input
                      type="text"
                      value={variantBHeadline}
                      onChange={(e) => setVariantBHeadline(e.target.value)}
                      className="w-full notion-input text-xs mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 dark:text-neutral-400">Body</label>
                    <textarea
                      value={variantBBody}
                      onChange={(e) => setVariantBBody(e.target.value)}
                      rows={2}
                      className="w-full notion-input text-xs mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-500 dark:text-neutral-400">Call to Action</label>
                    <input
                      type="text"
                      value={variantBCTA}
                      onChange={(e) => setVariantBCTA(e.target.value)}
                      className="w-full notion-input text-xs mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Budget & Pricing */}
          <div className="pt-4 border-t border-[var(--notion-border)]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                4. Budget & Pricing Strategy
              </h2>
              <Link
                href={`/cac-simulator?offeringId=${chosenOffering?.id || ""}&budget=${budget}`}
                className="text-[11px] text-[#2383E2] hover:underline flex items-center gap-1 font-medium transition-colors"
              >
                <span>Simulate CAC for this budget</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Media Spend Budget (₹)
                </label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-full notion-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Fixed Production Cost (₹)
                </label>
                <input
                  type="number"
                  value={fixedCost}
                  onChange={(e) => setFixedCost(Number(e.target.value))}
                  className="w-full notion-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Promotional Discount (%)
                </label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="w-full notion-input text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveCampaign}
              disabled={isSaving}
              className="notion-btn-primary"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? "Saving..." : "Save Campaign"}</span>
            </button>
          </div>
        </div>

        {/* Right 4 Cols: Economics & Live Summary */}
        <div className="lg:col-span-4 notion-card p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="border-b border-[var(--notion-border)] pb-3">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Campaign Economics
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Real-time audience reach & margin calculation
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[var(--notion-sidebar-bg)] border border-[var(--notion-border)] space-y-1">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">Total Audience Reach:</div>
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {formatNumber(rawTargetAudience)} customers
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 pt-1">
                Eligible with opt-in contact: <strong className="text-neutral-900 dark:text-neutral-100">{formatNumber(optInConsentEligible)}</strong>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-neutral-500 dark:text-neutral-400">
                <span>Product List Price:</span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">{formatCurrency(listPrice)}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-500 dark:text-neutral-400">
                <span>Effective Net Price:</span>
                <span className="font-semibold text-[#448361] dark:text-[#529E72]">{formatCurrency(netPrice)}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-500 dark:text-neutral-400">
                <span>Unit Cost COGS:</span>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">{formatCurrency(unitCOGS)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[var(--notion-border)] text-neutral-900 dark:text-neutral-100 font-medium">
                <span>Contribution Margin:</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">{formatCurrency(unitContribution)}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--notion-border)]">
            <Link
              href={`/simulator?budget=${budget}&price=${listPrice}&cogs=${unitCOGS}&discount=${discountValue / 100}&objective=${objective}&audience=${optInConsentEligible}`}
              className="w-full notion-btn-primary justify-center text-center"
            >
              <span>Forecast Financials in Simulator →</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
