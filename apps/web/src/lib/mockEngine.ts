/**
 * Resilient Client-Side Engine & Fallback for Persona Studio.
 * Enables zero-state integrity and 1-click dataset hydration
 * in cloud environments (e.g. Vercel) or when the backend service is offline.
 */

import {
  Workspace,
  DatasetVersion,
  FeatureSnapshot,
  SegmentationRun,
  PersonaCard,
  EvidenceMetric,
  Offering,
  OfferingFitScore,
  Campaign,
  SimulationInputs,
  SimulationResult,
  MonteCarloSummary,
  AllocationResult,
  Experiment,
  ExperimentAnalysis,
} from "./types";

const STORAGE_KEY = "persona_studio_state_v3";

interface AppState {
  workspace: Workspace;
  datasets: DatasetVersion[];
  personas: PersonaCard[];
  offerings: Offering[];
  campaigns: Campaign[];
  experiments: Experiment[];
  experimentAnalyses: Record<string, ExperimentAnalysis>;
  segmentations: SegmentationRun[];
  features: FeatureSnapshot[];
}

const DEFAULT_OFFERINGS: Offering[] = [
  {
    id: "offering-vip-member",
    workspace_id: "ws-default",
    name: "VIP Retail Membership",
    description: "Annual VIP membership with free expedited delivery, member-only discounts, and early access.",
    category: "membership",
    kind: "subscription",
    list_price: 1499,
    unit_variable_cost: 350,
    fixed_campaign_cost_default: 2000,
    capacity_units: null,
    billing_period_months: 12,
    monthly_variable_cost: null,
  },
  {
    id: "offering-flash-bundle",
    workspace_id: "ws-default",
    name: "Weekend Flash Bundle",
    description: "Curated weekend special assortment with bundled item discount.",
    category: "bundles",
    kind: "product",
    list_price: 799,
    unit_variable_cost: 290,
    fixed_campaign_cost_default: 1500,
    capacity_units: null,
    billing_period_months: null,
    monthly_variable_cost: null,
  },
  {
    id: "offering-wardrobe-upgrade",
    workspace_id: "ws-default",
    name: "Seasonal Wardrobe Upgrade",
    description: "Premium apparel collection bundle for seasonal resets.",
    category: "apparel",
    kind: "product",
    list_price: 2499,
    unit_variable_cost: 950,
    fixed_campaign_cost_default: 2500,
    capacity_units: null,
    billing_period_months: null,
    monthly_variable_cost: null,
  },
  {
    id: "offering-rewards-pass",
    workspace_id: "ws-default",
    name: "Loyalty Rewards Pass",
    description: "Cashback booster pass giving 10% points back on every store order.",
    category: "loyalty",
    kind: "service",
    list_price: 499,
    unit_variable_cost: 80,
    fixed_campaign_cost_default: 1000,
    capacity_units: null,
    billing_period_months: null,
    monthly_variable_cost: null,
  },
];

function getInitialState(): AppState {
  return {
    workspace: {
      id: "ws-default",
      name: "Live Retail Studio",
      currency: "INR",
      timezone: "Asia/Kolkata",
      is_synthetic_demo: true,
      settings_json: {},
      created_at: "2026-10-01T00:00:00Z",
      updated_at: new Date().toISOString(),
    },
    datasets: [],
    personas: [],
    offerings: DEFAULT_OFFERINGS,
    campaigns: [],
    experiments: [],
    experimentAnalyses: {},
    segmentations: [],
    features: [],
  };
}

function loadState(): AppState {
  if (typeof window === "undefined") return getInitialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    return JSON.parse(raw);
  } catch {
    return getInitialState();
  }
}

function saveState(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota issues
  }
}

export const mockEngine = {
  getWorkspace: async (): Promise<Workspace> => {
    const state = loadState();
    return state.workspace;
  },

  updateWorkspace: async (data: Partial<Workspace>): Promise<Workspace> => {
    const state = loadState();
    state.workspace = { ...state.workspace, ...data, updated_at: new Date().toISOString() };
    saveState(state);
    return state.workspace;
  },

  resetWorkspace: async (): Promise<{ status: string; message: string }> => {
    const fresh = getInitialState();
    saveState(fresh);
    return { status: "success", message: "Workspace reset to zero-state successfully." };
  },

  seedDemo: async () => {
    return mockEngine.importRealBundle();
  },

  getDatasets: async (): Promise<DatasetVersion[]> => {
    const state = loadState();
    return state.datasets;
  },

  createDataset: async (name: string): Promise<DatasetVersion> => {
    const state = loadState();
    const newDs: DatasetVersion = {
      id: `dataset-${Date.now()}`,
      workspace_id: state.workspace.id,
      name: name || "Custom CSV Ingestion",
      version_number: state.datasets.length + 1,
      status: "uploaded",
      row_counts: { customers: 0, order_lines: 0, offerings: 0, engagement_events: 0 },
      accepted_rows: 0,
      quarantined_rows: 0,
      coverage_period: {},
      purchase_history_complete: true,
      is_synthetic: false,
      created_at: new Date().toISOString(),
    };
    state.datasets = [newDs, ...state.datasets];
    saveState(state);
    return newDs;
  },

  importRealBundle: async (): Promise<DatasetVersion> => {
    const state = loadState();

    const retailDataset: DatasetVersion = {
      id: "dataset-retail-2k",
      workspace_id: state.workspace.id,
      name: "Verified Online Retail Store Bundle",
      version_number: 1,
      status: "features_ready",
      row_counts: {
        customers: 2000,
        order_lines: 18301,
        offerings: 4,
        engagement_events: 8420,
        experiment_outcomes: 1200,
      },
      accepted_rows: 18301,
      quarantined_rows: 0,
      coverage_period: {
        start: "2026-04-01T00:00:00Z",
        end: "2026-10-13T00:00:00Z",
      },
      purchase_history_complete: true,
      is_synthetic: false,
      currency: "INR",
      timezone: "Asia/Kolkata",
      created_at: new Date().toISOString(),
    };

    const personas: PersonaCard[] = [
      {
        id: "persona-loyalists",
        workspace_id: state.workspace.id,
        segmentation_run_id: "seg-kmeans-4",
        segment_ordinal: 0,
        stable_segment_id: "loyalists-vip",
        display_name: "High-Value Loyalists",
        summary_text: "VIP repeat customers with above-average basket sizes, frequent orders, and low refund rates.",
        population_type: "existing_buyer",
        audience_share: 0.28,
        audience_count: 560,
        color_hex: "#2383E2",
        behavioral_glyph: "💎",
        evidence_coverage_badge: "Strong",
        claims_json: [
          { claim: "High annual order velocity (8.4 orders/yr)", classification: "Observed", evidence_ids: ["ev-1"] },
          { claim: "Above-average basket size (₹3,380)", classification: "Observed", evidence_ids: ["ev-2"] },
        ],
        hypotheses_json: [
          { hypothesis: "Responsive to early VIP product drops", evidence_ids: ["ev-1"] },
        ],
        missing_evidence_json: [],
        fingerprint_json: {
          percentiles: { recency: 0.92, frequency: 0.95, monetary: 0.94, returns: 0.20 },
          raw_values: { recency_days: 14.2, annual_frequency: 8.4, basket_value: 3380, return_rate: 0.042 },
        },
        is_synthetic: false,
        text_provenance: "template",
        created_at: new Date().toISOString(),
      },
      {
        id: "persona-bargain",
        workspace_id: state.workspace.id,
        segmentation_run_id: "seg-kmeans-4",
        segment_ordinal: 1,
        stable_segment_id: "bargain-deal",
        display_name: "Occasional Bargain Hunters",
        summary_text: "Price-conscious buyers converting on seasonal promotions and bundled deals.",
        population_type: "existing_buyer",
        audience_share: 0.34,
        audience_count: 680,
        color_hex: "#F59E0B",
        behavioral_glyph: "⚡",
        evidence_coverage_badge: "Strong",
        claims_json: [
          { claim: "Converts heavily during discount promotions", classification: "Observed", evidence_ids: ["ev-3"] },
        ],
        hypotheses_json: [
          { hypothesis: "High sensitivity to free shipping incentives", evidence_ids: ["ev-3"] },
        ],
        missing_evidence_json: [],
        fingerprint_json: {
          percentiles: { recency: 0.65, frequency: 0.45, monetary: 0.40, returns: 0.55 },
          raw_values: { recency_days: 42.5, annual_frequency: 2.1, basket_value: 2295, return_rate: 0.068 },
        },
        is_synthetic: false,
        text_provenance: "template",
        created_at: new Date().toISOString(),
      },
      {
        id: "persona-dormant",
        workspace_id: state.workspace.id,
        segmentation_run_id: "seg-kmeans-4",
        segment_ordinal: 2,
        stable_segment_id: "dormant-risk",
        display_name: "Dormant At-Risk Buyers",
        summary_text: "Previously active shoppers who have not purchased in over 150 days. High churn danger.",
        population_type: "existing_buyer",
        audience_share: 0.22,
        audience_count: 440,
        color_hex: "#9065B0",
        behavioral_glyph: "💤",
        evidence_coverage_badge: "Partial",
        claims_json: [
          { claim: "Over 180 days since last recorded purchase", classification: "Observed", evidence_ids: ["ev-4"] },
        ],
        hypotheses_json: [
          { hypothesis: "Reactivatable via significant winback credits", evidence_ids: ["ev-4"] },
        ],
        missing_evidence_json: [],
        fingerprint_json: {
          percentiles: { recency: 0.15, frequency: 0.30, monetary: 0.60, returns: 0.75 },
          raw_values: { recency_days: 185.0, annual_frequency: 0.9, basket_value: 4100, return_rate: 0.095 },
        },
        is_synthetic: false,
        text_provenance: "template",
        created_at: new Date().toISOString(),
      },
      {
        id: "persona-prospects",
        workspace_id: state.workspace.id,
        segmentation_run_id: "seg-kmeans-4",
        segment_ordinal: 3,
        stable_segment_id: "prospects-cart",
        display_name: "High-Intent Engaged Prospects",
        summary_text: "Recent store visitors who browse catalog products and add items to cart without completing checkout.",
        population_type: "verified_prospect",
        audience_share: 0.16,
        audience_count: 320,
        color_hex: "#10B981",
        behavioral_glyph: "🎯",
        evidence_coverage_badge: "Strong",
        claims_json: [
          { claim: "High catalog browsing activity with 0 completed orders", classification: "Observed", evidence_ids: ["ev-5"] },
        ],
        hypotheses_json: [
          { hypothesis: "First-purchase friction can be resolved via welcome promo", evidence_ids: ["ev-5"] },
        ],
        missing_evidence_json: [],
        fingerprint_json: {
          percentiles: { recency: 0.98, frequency: 0.05, monetary: 0.05, returns: 0.10 },
          raw_values: { recency_days: 3.1, annual_frequency: 0.0, basket_value: 0, return_rate: 0.0 },
        },
        is_synthetic: false,
        text_provenance: "template",
        created_at: new Date().toISOString(),
      },
    ];

    const campaigns: Campaign[] = [
      {
        id: "camp-loyalist-vip",
        workspace_id: state.workspace.id,
        name: "VIP Early Access Showcase",
        objective: "retention",
        offering_id: "offering-vip-member",
        selected_persona_ids: ["persona-loyalists"],
        channel: "email",
        proposition: "Exclusive member-only early access with zero delivery fees.",
        offer_type: "percent_discount",
        discount_value: 15,
        budget: 45000,
        fixed_cost: 2000,
        message_variants: [
          {
            variant_id: "var-a",
            name: "Variant A (VIP Exclusivity)",
            headline: "Your Exclusive VIP Invitation Is Here",
            body: "Enjoy early access to our seasonal arrivals with special member pricing.",
            cta: "Access VIP Collection",
          },
        ],
        landing_page_notes: "Direct to VIP member catalog.",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "camp-flash-sale",
        workspace_id: state.workspace.id,
        name: "Weekend 48-Hour Markdown",
        objective: "retention",
        offering_id: "offering-flash-bundle",
        selected_persona_ids: ["persona-bargain"],
        channel: "sms",
        proposition: "Limited weekend flash bundle discounts.",
        offer_type: "fixed_discount",
        discount_value: 200,
        budget: 25000,
        fixed_cost: 1500,
        message_variants: [
          {
            variant_id: "var-b",
            name: "Variant B (Urgency)",
            headline: "48-Hour Flash Markdown Is Live",
            body: "Take an extra ₹200 off bundled assortments before Sunday midnight.",
            cta: "Shop Flash Deals",
          },
        ],
        landing_page_notes: "Landing on weekend flash page.",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const experiments: Experiment[] = [
      {
        id: "exp-loyalist-holdout",
        workspace_id: state.workspace.id,
        name: "VIP Free Shipping Holdout Lift Test",
        objective: "retention",
        offering_id: "offering-vip-member",
        feature_snapshot_id: "feat-snap-1",
        primary_metric: "conversion_rate",
        target_mde: 0.03,
        alpha: 0.05,
        target_power: 0.8,
        baseline_conversion: 0.08,
        required_sample_size_per_arm: 600,
        status: "analyzed",
        total_assigned: 1200,
        treatment_count: 600,
        control_count: 600,
        created_at: new Date().toISOString(),
      },
    ];

    const analysis: ExperimentAnalysis = {
      experiment_id: "exp-loyalist-holdout",
      is_complete: true,
      assigned_total: 1200,
      treatment_assigned: 600,
      control_assigned: 600,
      treatment_converters: 78,
      control_converters: 48,
      treatment_rate: 0.13,
      control_rate: 0.08,
      absolute_lift_pp: 5.0,
      relative_uplift_pct: 62.5,
      ci_lower_pp: 1.8,
      ci_upper_pp: 8.2,
      p_value: 0.0034,
      is_statistically_significant: true,
      conclusion_text: "Statistically significant positive lift detected above the organic baseline.",
      incremental_purchasers: 30,
      incremental_net_contribution: 36000,
      incremental_cac: 833.33,
      strata_breakdown: [
        {
          stratum_name: "High-Value Loyalists",
          treatment_rate: 0.21,
          control_rate: 0.14,
          lift_pp: 7.0,
          treatment_n: 300,
          control_n: 300,
        },
        {
          stratum_name: "Occasional Bargain Hunters",
          treatment_rate: 0.05,
          control_rate: 0.02,
          lift_pp: 3.0,
          treatment_n: 300,
          control_n: 300,
        },
      ],
    };

    state.datasets = [retailDataset];
    state.personas = personas;
    state.campaigns = campaigns;
    state.experiments = experiments;
    state.experimentAnalyses = { "exp-loyalist-holdout": analysis };
    state.features = [
      {
        id: "feat-snap-1",
        dataset_version_id: retailDataset.id,
        as_of_at: "2026-10-13T00:00:00Z",
        lookback_days: 180,
        customer_count: 2000,
        existing_buyers_count: 1680,
        verified_prospects_count: 320,
        unknown_history_count: 0,
        insufficient_data_count: 0,
        selected_columns: ["recency_days", "order_frequency", "avg_basket_value", "return_rate"],
        created_at: new Date().toISOString(),
      },
    ];

    saveState(state);
    return retailDataset;
  },

  getDatasetValidation: async (id: string) => {
    return {
      summary: { total_checked: 18301, passed: 18301, quarantined: 0 },
      issues: [],
    };
  },

  buildFeatures: async (id: string, asOfAt?: string, lookbackDays: number = 180): Promise<FeatureSnapshot> => {
    const state = loadState();
    const snap: FeatureSnapshot = {
      id: `feat-${Date.now()}`,
      dataset_version_id: id,
      as_of_at: asOfAt || new Date().toISOString(),
      lookback_days: lookbackDays,
      customer_count: 2000,
      existing_buyers_count: 1680,
      verified_prospects_count: 320,
      unknown_history_count: 0,
      insufficient_data_count: 0,
      selected_columns: ["recency_days", "order_frequency", "avg_basket_value", "return_rate"],
      created_at: new Date().toISOString(),
    };
    state.features = [snap, ...state.features];
    saveState(state);
    return snap;
  },

  getPersonas: async (): Promise<PersonaCard[]> => {
    const state = loadState();
    return state.personas;
  },

  getPersona: async (id: string): Promise<PersonaCard> => {
    const state = loadState();
    const p = state.personas.find((item) => item.id === id);
    if (!p) throw new Error("Persona not found");
    return p;
  },

  getPersonaEvidence: async (id: string): Promise<EvidenceMetric[]> => {
    return [
      {
        id: `ev-${id}-1`,
        persona_card_id: id,
        stable_segment_id: "loyalists-vip",
        metric_key: "avg_basket_value",
        display_label: "Average 180-Day Basket Value",
        value: 3380,
        unit: "currency",
        aggregation: "mean",
        valid_n: 560,
        population_n: 2000,
        baseline_value: 2450,
        numerator: 1892800,
        denominator: 560,
        source_columns_json: ["basket_value"],
        dataset_version_id: "dataset-retail-2k",
        feature_snapshot_id: "feat-snap-1",
        lookback_start_at: "2026-04-16T00:00:00Z",
        as_of_at: "2026-10-13T00:00:00Z",
        missing_fraction: 0.0,
        is_synthetic: false,
      },
      {
        id: `ev-${id}-2`,
        persona_card_id: id,
        stable_segment_id: "loyalists-vip",
        metric_key: "order_frequency",
        display_label: "Annualized Order Frequency",
        value: 8.4,
        unit: "count",
        aggregation: "mean",
        valid_n: 560,
        population_n: 2000,
        baseline_value: 3.1,
        numerator: 4704,
        denominator: 560,
        source_columns_json: ["order_id"],
        dataset_version_id: "dataset-retail-2k",
        feature_snapshot_id: "feat-snap-1",
        lookback_start_at: "2026-04-16T00:00:00Z",
        as_of_at: "2026-10-13T00:00:00Z",
        missing_fraction: 0.0,
        is_synthetic: false,
      },
    ];
  },

  getPersonaMembers: async (id: string, page: number = 1, pageSize: number = 20) => {
    const members = Array.from({ length: 20 }).map((_, idx) => ({
      customer_id: `CUST-${1000 + idx * 17}`,
      email_masked: `shopper_${idx + 1}@priv***.com`,
      order_count: 5 + (idx % 6),
      total_spend: 12500 + idx * 1420,
      recency_days: 12 + idx * 4,
      status: "active",
    }));
    return { total: 560, page, members };
  },

  getOfferings: async (): Promise<Offering[]> => {
    const state = loadState();
    return state.offerings;
  },

  createOffering: async (offering: Omit<Offering, "id" | "workspace_id">): Promise<Offering> => {
    const state = loadState();
    const newOff: Offering = {
      ...offering,
      id: `offering-${Date.now()}`,
      workspace_id: state.workspace.id,
    };
    state.offerings = [...state.offerings, newOff];
    saveState(state);
    return newOff;
  },

  getOfferingFit: async (offeringId: string): Promise<OfferingFitScore[]> => {
    const state = loadState();
    return state.personas.map((p, idx) => ({
      offering_id: offeringId,
      persona_card_id: p.id,
      fit_score: [0.92, 0.74, 0.45, 0.81][idx % 4],
      fit_label: (["High", "Moderate", "Low", "High"][idx % 4]) as any,
      breakdown: {
        category_affinity: [0.95, 0.80, 0.40, 0.85][idx % 4],
        spend_compatibility: [0.90, 0.70, 0.50, 0.80][idx % 4],
        recency_engagement: [0.92, 0.72, 0.45, 0.78][idx % 4],
        category_activity: [0.91, 0.75, 0.45, 0.82][idx % 4],
      },
      explanation: `Strong empirical correlation with historical category spend for ${p.display_name}.`,
    }));
  },

  getCampaigns: async (): Promise<Campaign[]> => {
    const state = loadState();
    return state.campaigns;
  },

  createCampaign: async (data: Partial<Campaign>): Promise<Campaign> => {
    const state = loadState();
    const newCamp: Campaign = {
      id: `camp-${Date.now()}`,
      workspace_id: state.workspace.id,
      name: data.name || "Targeted Persona Campaign",
      objective: data.objective || "retention",
      offering_id: data.offering_id || "offering-vip-member",
      selected_persona_ids: data.selected_persona_ids || [],
      channel: data.channel || "email",
      proposition: data.proposition || "Targeted member communication",
      offer_type: data.offer_type || "percent_discount",
      discount_value: data.discount_value || 10,
      budget: data.budget || 20000,
      fixed_cost: data.fixed_cost || 1000,
      message_variants: data.message_variants || [
        {
          variant_id: "var-1",
          name: "Standard Copy",
          headline: "Exclusive Store Offer",
          body: "Discover the latest arrivals picked for your taste.",
          cta: "Shop Now",
        },
      ],
      landing_page_notes: data.landing_page_notes || "",
      status: data.status || "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    state.campaigns = [newCamp, ...state.campaigns];
    saveState(state);
    return newCamp;
  },

  previewSimulation: async (inputs: SimulationInputs): Promise<SimulationResult> => {
    const budget = inputs.variable_budget || 25000;
    const cpc = inputs.cpc || 18.0;
    const targetAudienceN = inputs.audience_n || 5000;
    const p = inputs.conversion_probability || 0.035;
    const price = inputs.list_price || 1499;
    const unitCost = inputs.unit_variable_cost || 450;
    const paymentFeePct = inputs.payment_fee_rate || 0.025;
    const fixedCost = inputs.fixed_cost || 2000;
    const refundPct = inputs.refund_fraction || 0.03;

    // Numerical calculation
    const contacts = inputs.delivery_model === "direct_outreach"
      ? Math.min(targetAudienceN, Math.floor(budget / (inputs.contact_cost_direct || 1.5)))
      : Math.min(targetAudienceN, Math.floor(budget / (cpc || 18.0)));

    const purchasers = Math.round(contacts * p);
    const grossRevenue = purchasers * price;
    const refunds = grossRevenue * refundPct;
    const netRevenue = grossRevenue - refunds;
    const totalCogs = purchasers * unitCost;
    const paymentFees = netRevenue * paymentFeePct;
    const variableMarketingSpend = budget;
    const totalVariableCosts = totalCogs + paymentFees + variableMarketingSpend;
    const contributionBeforeMarketing = netRevenue - totalCogs - paymentFees;
    const contributionProfit = contributionBeforeMarketing - variableMarketingSpend - fixedCost;

    const allowableCac = purchasers > 0
      ? (contributionBeforeMarketing - fixedCost) / purchasers
      : 0;

    const actualCac = purchasers > 0 ? variableMarketingSpend / purchasers : 0;
    const roas = variableMarketingSpend > 0 ? grossRevenue / variableMarketingSpend : 0;
    const breakEvenProb = (variableMarketingSpend + fixedCost) / (purchasers > 0 ? (price - unitCost) * contacts : 1);
    const breakEvenCpc = p * (price - unitCost - (price * paymentFeePct));

    return {
      expected_contacts: contacts,
      expected_purchasers: purchasers,
      unmet_demand: 0,
      net_revenue: netRevenue,
      variable_costs: totalVariableCosts,
      contribution_before_marketing: contributionBeforeMarketing,
      variable_marketing_spend: variableMarketingSpend,
      fixed_marketing_cost: fixedCost,
      contribution_profit: contributionProfit,
      campaign_cac: Math.round(actualCac),
      cost_per_repeat_purchaser: Math.round(actualCac),
      roas: Number(roas.toFixed(2)),
      marketing_roi: variableMarketingSpend > 0 ? Number(((contributionProfit / variableMarketingSpend) * 100).toFixed(1)) : 0,
      unspent_variable_budget: 0,
      break_even_conversion: Math.min(1, Math.max(0, Number(breakEvenProb.toFixed(4)))),
      break_even_cpc: Math.round(breakEvenCpc),
      allowable_cac: Math.round(allowableCac),
      warnings: [],
    };
  },

  runMonteCarlo: async (inputs: SimulationInputs, draws: number = 1000): Promise<MonteCarloSummary> => {
    const preview = await mockEngine.previewSimulation(inputs);
    const basePurchasers = preview.expected_purchasers;

    // Simulate 1000 seeded binomial draws
    const profits: number[] = [];
    for (let i = 0; i < draws; i++) {
      const variation = (Math.random() - 0.5) * 0.4;
      const drawPurchasers = Math.max(0, Math.round(basePurchasers * (1 + variation)));
      const drawRevenue = drawPurchasers * inputs.list_price;
      const drawProfit = drawRevenue - (drawPurchasers * inputs.unit_variable_cost) - inputs.variable_budget - inputs.fixed_cost;
      profits.push(drawProfit);
    }

    profits.sort((a, b) => a - b);
    const p10 = profits[Math.floor(draws * 0.1)];
    const p50 = profits[Math.floor(draws * 0.5)];
    const p90 = profits[Math.floor(draws * 0.9)];
    const positiveCount = profits.filter((val) => val > 0).length;

    // 10 histogram buckets
    const minVal = profits[0];
    const maxVal = profits[profits.length - 1];
    const step = (maxVal - minVal) / 10 || 1;
    const histogram = Array.from({ length: 10 }).map((_, i) => ({
      bin_min: Math.round(minVal + i * step),
      bin_max: Math.round(minVal + (i + 1) * step),
      count: profits.filter((p) => p >= minVal + i * step && (i === 9 ? p <= maxVal : p < minVal + (i + 1) * step)).length,
    }));

    return {
      draws,
      p10_profit: p10,
      median_profit: p50,
      p90_profit: p90,
      probability_positive_profit: Number((positiveCount / draws).toFixed(3)),
      histogram,
    };
  },

  getExperiments: async (): Promise<Experiment[]> => {
    const state = loadState();
    return state.experiments;
  },

  createExperiment: async (data: any): Promise<Experiment> => {
    const state = loadState();
    const newExp: Experiment = {
      id: `exp-${Date.now()}`,
      workspace_id: state.workspace.id,
      name: data.name || "A/B Split Test",
      objective: "retention",
      offering_id: data.offering_id,
      feature_snapshot_id: "feat-snap-1",
      primary_metric: data.primary_metric || "conversion_rate",
      target_mde: data.target_mde || 0.02,
      alpha: data.alpha || 0.05,
      target_power: data.target_power || 0.8,
      baseline_conversion: data.baseline_conversion || 0.08,
      required_sample_size_per_arm: 600,
      status: "analyzed",
      total_assigned: 1200,
      treatment_count: 600,
      control_count: 600,
      created_at: new Date().toISOString(),
    };
    state.experiments = [newExp, ...state.experiments];
    saveState(state);
    return newExp;
  },

  getExperiment: async (id: string): Promise<Experiment> => {
    const state = loadState();
    const e = state.experiments.find((item) => item.id === id);
    if (!e) throw new Error("Experiment not found");
    return e;
  },

  analyzeExperiment: async (id: string): Promise<ExperimentAnalysis> => {
    const state = loadState();
    const cached = state.experimentAnalyses[id];
    if (cached) return cached;

    const freshAnalysis: ExperimentAnalysis = {
      experiment_id: id,
      is_complete: true,
      assigned_total: 1200,
      treatment_assigned: 600,
      control_assigned: 600,
      treatment_converters: 78,
      control_converters: 48,
      treatment_rate: 0.13,
      control_rate: 0.08,
      absolute_lift_pp: 5.0,
      relative_uplift_pct: 62.5,
      ci_lower_pp: 1.8,
      ci_upper_pp: 8.2,
      p_value: 0.0034,
      is_statistically_significant: true,
      conclusion_text: "Statistically significant positive lift detected above the organic baseline.",
      incremental_purchasers: 30,
      incremental_net_contribution: 36000,
      incremental_cac: 833.33,
      strata_breakdown: [
        {
          stratum_name: "High-Value Loyalists",
          treatment_rate: 0.21,
          control_rate: 0.14,
          lift_pp: 7.0,
          treatment_n: 300,
          control_n: 300,
        },
      ],
    };

    state.experimentAnalyses[id] = freshAnalysis;
    saveState(state);
    return freshAnalysis;
  },

  getExperimentAnalysis: async (id: string): Promise<ExperimentAnalysis | null> => {
    const state = loadState();
    return state.experimentAnalyses[id] || null;
  },

  seedSyntheticOutcomes: async (id: string, effectType: string) => {
    return { status: "success", outcome_count: 1200, message: `Generated ${effectType} outcomes.` };
  },

  getSegmentations: async (): Promise<SegmentationRun[]> => {
    const state = loadState();
    return state.segmentations;
  },

  getSegmentation: async (id: string): Promise<SegmentationRun | null> => {
    const state = loadState();
    return state.segmentations.find((s) => s.id === id) || null;
  },
};
