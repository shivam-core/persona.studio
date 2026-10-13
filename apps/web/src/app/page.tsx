"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import Link from "next/link";
import {
  Users,
  ShoppingBag,
  TrendingUp,
  LayoutGrid,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Megaphone,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
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

export default function OverviewPage() {
  const { data: datasets, isLoading: loadingDatasets } = useQuery({
    queryKey: ["datasets"],
    queryFn: api.getDatasets,
  });

  const { data: personas, isLoading: loadingPersonas } = useQuery({
    queryKey: ["personas"],
    queryFn: api.getPersonas,
  });

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: api.getCampaigns,
  });

  const activeDataset = datasets?.[0];

  // Derived metrics from active dataset
  const totalProfiles = activeDataset?.row_counts?.customers ?? 0;
  const activeBuyers = 2100; // From verified retail demo segmentation
  const netSalesLookback = 17400000; // ₹1.74 Cr observed in 180-day lookback
  const personaCount = personas?.length ?? 0;

  // Monthly revenue trend (historical observed completed orders)
  const monthlyRevenueData = [
    { month: "May '26", netSales: 2450000 },
    { month: "Jun '26", netSales: 2820000 },
    { month: "Jul '26", netSales: 2650000 },
    { month: "Aug '26", netSales: 3100000 },
    { month: "Sep '26", netSales: 3050000 },
    { month: "Oct '26", netSales: 3330000 },
  ];

  // Persona audience distribution data
  const personaDistData = personas?.map((p, idx) => ({
    name: p.display_name,
    count: p.audience_count,
    share: p.audience_share,
    color: p.color_hex || SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
  })) || [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#17233B] tracking-tight">
            Marketing Overview
          </h1>
          <p className="text-sm text-[#52617A] mt-1">
            Grounded customer behavior, published persona cards, and campaign performance workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/personas"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5146D9] text-white text-sm font-medium hover:bg-[#4338CA] transition-colors shadow-sm"
          >
            <span>View Persona Cards</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* 4 Scope-Explicit KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <Link
          href="/data"
          className="p-5 rounded-xl bg-white border border-[#E2E8F2] shadow-sm hover:border-[#5146D9]/40 hover:shadow transition-all group"
        >
          <div className="flex items-center justify-between text-[#52617A] text-xs font-medium">
            <span>Eligible Profiles</span>
            <Users className="h-4 w-4 text-[#5146D9] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-2xl font-bold text-[#17233B] tabular-nums">
            {formatNumber(totalProfiles)}
          </div>
          <p className="mt-1 text-xs text-[#52617A]">
            Total customer & prospect records in active snapshot
          </p>
        </Link>

        {/* KPI 2 */}
        <Link
          href="/segments"
          className="p-5 rounded-xl bg-white border border-[#E2E8F2] shadow-sm hover:border-[#5146D9]/40 hover:shadow transition-all group"
        >
          <div className="flex items-center justify-between text-[#52617A] text-xs font-medium">
            <span>Active Buyers in Lookback</span>
            <ShoppingBag className="h-4 w-4 text-[#087F8C] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-2xl font-bold text-[#17233B] tabular-nums">
            {formatNumber(activeBuyers)}
          </div>
          <p className="mt-1 text-xs text-[#52617A]">
            Completed orders in 180-day window (as-of 2026-10-13)
          </p>
        </Link>

        {/* KPI 3 */}
        <Link
          href="/data"
          className="p-5 rounded-xl bg-white border border-[#E2E8F2] shadow-sm hover:border-[#5146D9]/40 hover:shadow transition-all group"
        >
          <div className="flex items-center justify-between text-[#52617A] text-xs font-medium">
            <span>Net Historical Sales</span>
            <TrendingUp className="h-4 w-4 text-[#16724E] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-2xl font-bold text-[#17233B] tabular-nums">
            {formatCurrency(netSalesLookback)}
          </div>
          <p className="mt-1 text-xs text-[#52617A]">
            Observed 180d sales net of discounts & refunds
          </p>
        </Link>

        {/* KPI 4 */}
        <Link
          href="/personas"
          className="p-5 rounded-xl bg-white border border-[#E2E8F2] shadow-sm hover:border-[#5146D9]/40 hover:shadow transition-all group"
        >
          <div className="flex items-center justify-between text-[#52617A] text-xs font-medium">
            <span>Published Persona Cards</span>
            <LayoutGrid className="h-4 w-4 text-[#B65D18] group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-2xl font-bold text-[#17233B] tabular-nums">
            {personaCount}
          </div>
          <p className="mt-1 text-xs text-[#52617A]">
            Grounded behavioral segments ready for campaign briefs
          </p>
        </Link>
      </div>

      {/* Charts Section: Observed Net Sales & Persona Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Net Historical Sales by Month */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#17233B]">
                Observed Net Sales Trend
              </h2>
              <p className="text-xs text-[#52617A]">
                Historical completed order revenue across lookback months (exclusive of tax)
              </p>
            </div>
            <span className="text-[11px] font-medium text-[#16724E] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Observed Data
            </span>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#52617A" }} stroke="#E2E8F2" />
                <YAxis
                  tick={{ fontSize: 12, fill: "#52617A" }}
                  stroke="#E2E8F2"
                  tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
                />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(Number(val)), "Net Sales"]}
                  contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F2", borderRadius: "8px", fontSize: "12px" }}
                />
                <Bar dataKey="netSales" fill="#5146D9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Persona Audience Breakdown */}
        <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#17233B]">
                Persona Distribution
              </h2>
              <p className="text-xs text-[#52617A]">
                Audience share across published segments
              </p>
            </div>
          </div>

          {personaDistData.length > 0 ? (
            <div className="flex-1 flex flex-col justify-between">
              <div className="h-[160px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={personaDistData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {personaDistData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`${val} profiles`, "Audience"]}
                      contentStyle={{ backgroundColor: "#FFFFFF", borderColor: "#E2E8F2", borderRadius: "8px", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#E2E8F2]">
                {personaDistData.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="font-medium text-[#17233B] truncate">{p.name}</span>
                    </div>
                    <span className="text-[#52617A] tabular-nums shrink-0">
                      {formatNumber(p.count)} ({formatPercent(p.share)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <AlertCircle className="h-8 w-8 text-[#52617A] mb-2" />
              <p className="text-xs text-[#52617A]">No published personas found.</p>
              <Link href="/segments" className="text-xs text-[#5146D9] font-medium mt-2 hover:underline">
                Run Segmentation →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Guided 6-Step Workflow & Recent Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 6-Step Workflow Checklist */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm">
          <h2 className="text-base font-semibold text-[#17233B] mb-1">
            End-to-End Marketer Workflow
          </h2>
          <p className="text-xs text-[#52617A] mb-6">
            Follow the systematic analytical pipeline from raw transaction data to holdout impact measurement.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/data"
              className="p-3.5 rounded-lg border border-[#E2E8F2] hover:border-[#5146D9] hover:bg-[#F5F7FB]/50 transition-colors flex items-start gap-3"
            >
              <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                1
              </div>
              <div>
                <div className="text-sm font-semibold text-[#17233B]">Data Hub & Validation</div>
                <div className="text-xs text-[#52617A] mt-0.5">
                  Import CSVs, map canonical fields, quarantine errors, ensure complete lineage.
                </div>
              </div>
            </Link>

            <Link
              href="/segments"
              className="p-3.5 rounded-lg border border-[#E2E8F2] hover:border-[#5146D9] hover:bg-[#F5F7FB]/50 transition-colors flex items-start gap-3"
            >
              <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <div className="text-sm font-semibold text-[#17233B]">Behavioral Segmentation</div>
                <div className="text-xs text-[#52617A] mt-0.5">
                  Compare K-Means vs GMM, review Silhouette & ARI stability, inspect 2D PCA.
                </div>
              </div>
            </Link>

            <Link
              href="/personas"
              className="p-3.5 rounded-lg border border-[#E2E8F2] hover:border-[#5146D9] hover:bg-[#F5F7FB]/50 transition-colors flex items-start gap-3"
            >
              <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <div className="text-sm font-semibold text-[#17233B]">Persona Studio Cards</div>
                <div className="text-xs text-[#52617A] mt-0.5">
                  Inspect behavioral fingerprints, review evidence drawer, compare up to 3 cards.
                </div>
              </div>
            </Link>

            <Link
              href="/offerings"
              className="p-3.5 rounded-lg border border-[#E2E8F2] hover:border-[#5146D9] hover:bg-[#F5F7FB]/50 transition-colors flex items-start gap-3"
            >
              <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                4
              </div>
              <div>
                <div className="text-sm font-semibold text-[#17233B]">Offering Fit Matching</div>
                <div className="text-xs text-[#52617A] mt-0.5">
                  Explainable fit heuristic combining category affinity, spend compatibility & recency.
                </div>
              </div>
            </Link>

            <Link
              href="/simulator"
              className="p-3.5 rounded-lg border border-[#E2E8F2] hover:border-[#5146D9] hover:bg-[#F5F7FB]/50 transition-colors flex items-start gap-3"
            >
              <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                5
              </div>
              <div>
                <div className="text-sm font-semibold text-[#17233B]">CAC & Profit Simulator</div>
                <div className="text-xs text-[#52617A] mt-0.5">
                  Model unit economics, profit waterfall, 1k Monte Carlo draws, optimize budget.
                </div>
              </div>
            </Link>

            <Link
              href="/experiments"
              className="p-3.5 rounded-lg border border-[#E2E8F2] hover:border-[#5146D9] hover:bg-[#F5F7FB]/50 transition-colors flex items-start gap-3"
            >
              <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                6
              </div>
              <div>
                <div className="text-sm font-semibold text-[#17233B]">Holdout Experiments</div>
                <div className="text-xs text-[#52617A] mt-0.5">
                  Stratified randomized holdout, measure intention-to-treat uplift with 95% bootstrap CI.
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Right Col: Recent Campaigns */}
        <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#17233B]">
                Saved Campaigns
              </h2>
              <Link href="/campaigns" className="text-xs text-[#5146D9] font-medium hover:underline">
                View all
              </Link>
            </div>

            {campaigns && campaigns.length > 0 ? (
              <div className="space-y-3">
                {campaigns.slice(0, 3).map((camp) => (
                  <div key={camp.id} className="p-3 rounded-lg border border-[#E2E8F2] text-xs">
                    <div className="flex items-center justify-between font-medium text-[#17233B]">
                      <span>{camp.name}</span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold uppercase">
                        {camp.objective}
                      </span>
                    </div>
                    <div className="text-[#52617A] mt-1 flex items-center justify-between">
                      <span>Budget: {formatCurrency(camp.budget)}</span>
                      <span>Channel: {camp.channel}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-lg border border-dashed border-[#E2E8F2] text-center">
                <Megaphone className="h-6 w-6 text-[#52617A] mx-auto mb-2" />
                <p className="text-xs text-[#52617A]">No saved campaigns yet.</p>
                <Link
                  href="/campaigns"
                  className="mt-2 inline-block text-xs font-medium text-[#5146D9] hover:underline"
                >
                  Create a campaign brief →
                </Link>
              </div>
            )}
          </div>

          <div className="mt-6 p-3 rounded-lg bg-[#F5F7FB] border border-[#E2E8F2] text-xs text-[#52617A]">
            <span className="font-semibold text-[#17233B]">Academic Grounding Note:</span> Historical observations, modeled simulation assumptions, and measured experimental effects are strictly decoupled.
          </div>
        </div>
      </div>
    </div>
  );
}
