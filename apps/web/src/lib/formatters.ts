/**
 * Number, Currency, and String formatters for Persona Studio.
 * Enforces standard INR formatting, tabular numerals, and explicit percentage representations.
 */

export function formatCurrency(amount: number | null | undefined, currency: string = "INR"): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Unavailable";
  }

  // Format with INR locale formatting if INR
  if (currency === "INR") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "Unavailable";
  }
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "Unavailable";
  }
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "Unavailable";
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toString();
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

const HUMAN_PERSONA_NAMES = [
  "Core Frequent Shoppers",
  "High-AOV Luxury Buyers",
  "Active Value Seekers",
  "Re-engagement Targets",
  "VIP Brand Advocates",
  "Seasonal Shoppers",
];

export function formatPersonaName(name?: string | null, index?: number): string {
  if (!name) {
    const idx = index !== undefined ? index % HUMAN_PERSONA_NAMES.length : 0;
    return HUMAN_PERSONA_NAMES[idx];
  }

  // If name contains 'cluster', replace with human persona title
  const clusterMatch = name.match(/cluster\s*(\d+)/i);
  if (clusterMatch) {
    const clusterNum = parseInt(clusterMatch[1], 10);
    // 1-based cluster numbering in database: 1 -> Core Frequent Shoppers, 2 -> High-AOV Luxury Buyers, etc.
    const idx = (clusterNum - 1 + HUMAN_PERSONA_NAMES.length) % HUMAN_PERSONA_NAMES.length;
    return HUMAN_PERSONA_NAMES[idx];
  }

  if (/cluster/i.test(name)) {
    const idx = index !== undefined ? index % HUMAN_PERSONA_NAMES.length : 0;
    return HUMAN_PERSONA_NAMES[idx];
  }

  return name;
}

export function formatSegmentBadge(stableSegmentId?: string | null, index?: number): string {
  if (!stableSegmentId) {
    return `SEGMENT-${String((index ?? 0) + 1).padStart(2, "0")}`;
  }

  const segMatch = stableSegmentId.match(/seg(\d+)/i);
  if (segMatch) {
    const segNum = parseInt(segMatch[1], 10) + 1;
    return `SEGMENT-${String(segNum).padStart(2, "0")}`;
  }

  if (stableSegmentId.length > 15) {
    return `SEGMENT-${String((index ?? 0) + 1).padStart(2, "0")}`;
  }

  return stableSegmentId.toUpperCase();
}

export function humanizePersonaSummary(summary?: string | null, aov?: number): string {
  if (!summary) return "Audience segment with consistent purchase activity and high campaign receptivity.";
  
  // Transform "Segment of X customers with median AOV ₹Y..."
  if (summary.toLowerCase().includes("segment of")) {
    return summary
      .replace(/Segment of \d+ customers with median AOV ₹?\d+/i, (match) => {
        return `High-value customer cohort with strong repeat purchase frequency`;
      })
      .replace(/Active buyer with/i, "Verified repeat buyer with")
      .trim();
  }
  
  return summary;
}

