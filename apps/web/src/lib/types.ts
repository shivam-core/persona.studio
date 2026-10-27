/**
 * Data contracts and type definitions for Persona Studio.
 * Matches backend FastAPI domain models and schemas.
 */

export type PopulationType = "existing_buyer" | "verified_prospect" | "unknown" | "insufficient_data";
export type OfferingKind = "product" | "service" | "subscription";
export type CampaignObjective = "acquisition" | "retention" | "reactivation";
export type DeliveryModel = "paid_cpc" | "direct_outreach";

export interface Workspace {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  is_synthetic_demo: boolean;
  settings_json: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DatasetVersion {
  id: string;
  workspace_id: string;
  name: string;
  version_number: number;
  status: "uploaded" | "mapped" | "validating" | "needs_review" | "validated" | "failed" | "features_ready";
  row_counts: {
    customers?: number;
    order_lines?: number;
    offerings?: number;
    engagement_events?: number;
    experiment_outcomes?: number;
  };
  accepted_rows: number;
  quarantined_rows: number;
  coverage_period: {
    start?: string;
    end?: string;
  };
  purchase_history_complete: boolean;
  is_synthetic: boolean;
  currency?: string;
  timezone?: string;
  created_at: string;
}

export interface ValidationIssue {
  id: string;
  dataset_version_id: string;
  table_name: string;
  row_index: number | null;
  column_name: string | null;
  severity: "fatal" | "error" | "warning";
  issue_code: string;
  message: string;
  raw_value: string | null;
  proposed_resolution: string | null;
  is_quarantined: boolean;
  created_at: string;
}

export interface FeatureSnapshot {
  id: string;
  dataset_version_id: string;
  as_of_at: string;
  lookback_days: number;
  customer_count: number;
  existing_buyers_count: number;
  verified_prospects_count: number;
  unknown_history_count: number;
  insufficient_data_count: number;
  selected_columns: string[];
  created_at: string;
}

export interface ModelCandidate {
  id: string;
  algorithm: "kmeans" | "gmm";
  n_clusters: number;
  silhouette_score: number | null;
  davies_bouldin_index: number | null;
  calinski_harabasz_score: number | null;
  aic: number | null;
  bic: number | null;
  stability_median_ari: number | null;
  stability_min_ari: number | null;
  stability_max_ari: number | null;
  cluster_sizes: number[];
  min_cluster_size: number;
  cluster_size_ratio: number;
  is_qualified: boolean;
  qualification_reasons: string[];
  selection_score: number;
  is_recommended: boolean;
}

export interface SegmentationRun {
  id: string;
  workspace_id: string;
  feature_snapshot_id: string;
  population_type: PopulationType;
  status: "running" | "completed" | "failed";
  chosen_candidate_id: string | null;
  pca_projection: {
    coordinates: Array<{
      customer_id: string;
      x: number;
      y: number;
      cluster: number;
    }>;
    explained_variance_ratio: [number, number];
  } | null;
  candidates: ModelCandidate[];
  created_at: string;
}

export interface BehavioralFingerprint {
  percentiles: Record<string, number>;
  raw_values: Record<string, number>;
}

export interface EvidenceMetric {
  id: string;
  persona_card_id: string;
  stable_segment_id: string;
  metric_key: string;
  display_label: string;
  value: number | null;
  unit: string;
  aggregation: string;
  valid_n: number;
  population_n: number;
  baseline_value: number | null;
  numerator: number | null;
  denominator: number | null;
  source_columns_json: string[];
  dataset_version_id: string;
  feature_snapshot_id: string;
  lookback_start_at: string;
  as_of_at: string;
  missing_fraction: number;
  is_synthetic: boolean;
}

export interface PersonaCard {
  id: string;
  workspace_id: string;
  segmentation_run_id: string;
  segment_ordinal: number;
  stable_segment_id: string;
  display_name: string;
  summary_text: string;
  audience_count: number;
  audience_share: number;
  population_type: PopulationType;
  color_hex: string;
  behavioral_glyph: string;
  evidence_coverage_badge: "Strong" | "Partial" | "Limited";
  claims_json: Array<{
    claim: string;
    classification: "Observed" | "Hypothesis";
    evidence_ids: string[];
  }>;
  hypotheses_json: Array<{
    hypothesis: string;
    evidence_ids: string[];
  }>;
  missing_evidence_json: string[];
  fingerprint_json: BehavioralFingerprint;
  is_synthetic: boolean;
  text_provenance: "template" | "ai";
  created_at: string;
  evidence_metrics?: EvidenceMetric[];
}

export interface Offering {
  id: string;
  workspace_id: string;
  name: string;
  category: string;
  kind: OfferingKind;
  list_price: number;
  unit_variable_cost: number;
  fixed_campaign_cost_default: number;
  capacity_units: number | null;
  billing_period_months: number | null;
  monthly_variable_cost: number | null;
  description: string;
}

export interface OfferingFitScore {
  persona_card_id: string;
  offering_id: string;
  fit_score: number;
  fit_label: "High" | "Moderate" | "Low" | "Insufficient Evidence";
  breakdown: {
    category_affinity: number;
    spend_compatibility: number | null;
    recency_engagement: number;
    category_activity: number;
  };
  explanation: string;
}

export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  objective: CampaignObjective;
  offering_id: string;
  selected_persona_ids: string[];
  channel: string;
  proposition: string;
  offer_type: "none" | "percent_discount" | "fixed_discount";
  discount_value: number;
  budget: number;
  fixed_cost: number;
  message_variants: Array<{
    variant_id: string;
    name: string;
    headline: string;
    body: string;
    cta: string;
  }>;
  landing_page_notes: string;
  status: "draft" | "planned" | "active" | "completed";
  created_at: string;
  updated_at: string;
}

export interface SimulationInputs {
  delivery_model: DeliveryModel;
  objective: CampaignObjective;
  variable_budget: number;
  fixed_cost: number;
  cpc: number;
  clicks_per_person: number;
  contact_cost_direct: number;
  audience_n: number;
  conversion_probability: number;
  list_price: number;
  discount_fraction: number;
  refund_fraction: number;
  unit_variable_cost: number;
  fulfillment_cost: number;
  payment_fee_rate: number;
  refund_handling_cost: number;
  capacity_units: number | null;
  saturation_lambda: number;
  baseline_conversion_p0?: number;
  baseline_margin?: number;
  is_subscription?: boolean;
  subscription_horizon_months?: number;
  subscription_monthly_churn?: number;
  subscription_discount_rate?: number;
  subscription_onboarding_cost?: number;
}

export interface SimulationResult {
  expected_contacts: number;
  expected_purchasers: number;
  unmet_demand: number;
  net_revenue: number;
  variable_costs: number;
  contribution_before_marketing: number;
  variable_marketing_spend: number;
  fixed_marketing_cost: number;
  contribution_profit: number;
  campaign_cac: number | null;
  cost_per_repeat_purchaser: number | null;
  roas: number | null;
  marketing_roi: number | null;
  unspent_variable_budget: number;
  break_even_conversion: number | null;
  break_even_cpc: number | null;
  allowable_cac: number | null;
  modeled_counterfactual?: {
    incremental_purchasers: number;
    incremental_contribution: number;
  };
  subscription_details?: {
    horizon_months: number;
    survival_curve: number[];
    cumulative_revenue: number;
    cumulative_contribution: number;
    payback_month: number | null;
  };
  warnings: string[];
}

export interface MonteCarloSummary {
  draws: number;
  median_profit: number;
  p10_profit: number;
  p90_profit: number;
  probability_positive_profit: number;
  histogram: Array<{
    bin_min: number;
    bin_max: number;
    count: number;
  }>;
}

export interface AllocationCell {
  persona_id: string;
  persona_name: string;
  channel: string;
  allocated_budget: number;
  expected_contacts: number;
  expected_purchasers: number;
  contribution_profit: number;
  is_recommended: boolean;
}

export interface AllocationResult {
  total_budget: number;
  total_allocated: number;
  unspent_budget: number;
  fixed_cost: number;
  total_contribution_profit: number;
  recommendation: "launch" | "do_not_launch";
  recommendation_reason: string;
  cells: AllocationCell[];
  comparison: {
    current: { budget: number; profit: number };
    equal_split: { budget: number; profit: number };
    model_based: { budget: number; profit: number };
  };
}

export interface Experiment {
  id: string;
  workspace_id: string;
  name: string;
  objective: CampaignObjective;
  offering_id: string;
  feature_snapshot_id: string;
  primary_metric: string;
  target_mde: number;
  alpha: number;
  target_power: number;
  baseline_conversion: number;
  required_sample_size_per_arm: number;
  status: "pre_registered" | "outcomes_imported" | "analyzed";
  total_assigned: number;
  treatment_count: number;
  control_count: number;
  created_at: string;
}

export interface ExperimentAnalysis {
  experiment_id: string;
  is_complete: boolean;
  assigned_total: number;
  treatment_assigned: number;
  control_assigned: number;
  treatment_converters: number;
  control_converters: number;
  treatment_rate: number;
  control_rate: number;
  absolute_lift_pp: number;
  relative_uplift_pct: number | null;
  ci_lower_pp: number;
  ci_upper_pp: number;
  p_value: number;
  is_statistically_significant: boolean;
  conclusion_text: string;
  incremental_purchasers: number;
  incremental_net_contribution: number;
  incremental_cac: number | null;
  strata_breakdown: Array<{
    stratum_name: string;
    treatment_n: number;
    control_n: number;
    treatment_rate: number;
    control_rate: number;
    lift_pp: number;
  }>;
}
