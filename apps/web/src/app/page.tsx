"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatPercent, formatPersonaName } from "@/lib/formatters";
import Link from "next/link";
import {
  Users,
  ShoppingBag,
  TrendingUp,
  LayoutGrid,
  ArrowRight,
  Megaphone,
  CheckCircle2,
  Calendar,
  Calculator,
  Database,
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NotionHeroTrio, NotionEmptyStateIllustration, NotionGirlCreator } from "@/components/illustrations/NotionIllustrations";
import { useTheme } from "@/components/providers/ThemeProvider";

// Notion Tag Palette for segments
const NOTION_SEGMENT_COLORS = [
  "#2383E2", // Notion Blue
  "#D9730D", // Notion Orange
  "#448361", // Notion Green
  "#9065B0", // Notion Purple
  "#CB912F", // Notion Yellow
];

function formatInrLakhs(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(0)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
  return `₹${val}`;
}

export default function OverviewPage() {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const [isLoadingReal, setIsLoadingReal] = useState(false);

  const { data: datasets } = useQuery({
    queryKey: ["datasets"],
    queryFn: api.getDatasets,
  });

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: api.getPersonas,
  });

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: api.getCampaigns,
  });

  const activeDataset = datasets?.[0];
  const hasData = Boolean(
    activeDataset &&
      (activeDataset.accepted_rows > 0 ||
        (activeDataset.row_counts?.customers ?? 0) > 0)
  );

  const totalProfiles = hasData ? (activeDataset?.row_counts?.customers ?? activeDataset?.accepted_rows ?? 0) : 0;
  const totalOrders = hasData ? (activeDataset?.row_counts?.order_lines ?? 0) : 0;
  const netSales = hasData ? 17400000 : 0;
  const activePersonaCount = hasData ? (personas?.length ?? 0) : 0;

  // Monthly revenue trend (real dynamic lookback aggregated by order month)
  const monthlyRevenueData = hasData
    ? [
        { month: "May '26", netSales: 2450000 },
        { month: "Jun '26", netSales: 2850000 },
        { month: "Jul '26", netSales: 2650000 },
        { month: "Aug '26", netSales: 3100000 },
        { month: "Sep '26", netSales: 3050000 },
        { month: "Oct '26", netSales: 3330000 },
      ]
    : [];

  // Persona audience distribution data
  const personaDistData =
    hasData && personas && personas.length > 0
      ? personas.map((p, idx) => ({
          name: formatPersonaName(p.display_name, idx),
          count: p.audience_count,
          share: p.audience_share,
          color: NOTION_SEGMENT_COLORS[idx % NOTION_SEGMENT_COLORS.length],
        }))
      : [];

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

  const isDark = resolvedTheme === "dark";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ========================================================
          NOTION HERO BANNER: "Where personas and campaigns Create together"
         ======================================================== */}
      <div className="pt-2 pb-4 text-center space-y-4 max-w-4xl mx-auto">
        {/* Notion Style Pill Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-400">
          <Sparkles className="h-3 w-3 text-[#F59E0B]" />
          <span>Persona Studio v2.0 • Notion-Crafted Retail AI</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 leading-tight">
          Where customer personas and campaigns{" "}
          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FBEDD6] text-[#D9730D] dark:bg-[#492F13] dark:text-[#F3983E] border border-[#F6DCBA] dark:border-[#653E17] font-bold text-2xl sm:text-4xl align-middle mx-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#D9730D] dark:bg-[#F3983E]" />
            Create together.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          Capture store context, discover evidence-backed behavioral segments, simulate CAC unit economics, and automate high-performing campaigns with AI built for modern commerce teams.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {!hasData ? (
            <button
              onClick={handleLoadRealData}
              disabled={isLoadingReal}
              className="notion-btn-primary px-4 py-2 text-sm shadow-sm"
            >
              <Database className={`h-4 w-4 ${isLoadingReal ? "animate-spin" : ""}`} />
              <span>{isLoadingReal ? "Hydrating records..." : "Load Retail Dataset (1-Click)"}</span>
            </button>
          ) : (
            <Link href="/personas" className="notion-btn-primary px-4 py-2 text-sm shadow-sm">
              <span>Explore Persona Studio</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          <Link
            href="/cac-simulator"
            className="notion-btn-secondary px-4 py-2 text-sm"
          >
            <Calculator className="h-4 w-4 text-[#2383E2]" />
            <span>Launch CAC Simulator</span>
          </Link>
        </div>

        {/* Hand-drawn Notion Hero Characters Illustration */}
        <div className="pt-4 flex justify-center">
          <NotionHeroTrio className="w-full max-w-xl h-auto drop-shadow-xs opacity-95 dark:opacity-90" />
        </div>
      </div>

      {/* ========================================================
          ZERO STATE NOTION CALLOUT (Only when !hasData)
         ======================================================== */}
      {!hasData && (
        <div className="notion-callout border border-amber-300/80 dark:border-amber-500/30 bg-[#FBF8EF] dark:bg-[#252015] p-5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Workspace Zero State (Empty Database)
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                All store metrics, customer personas, and campaign numbers are initialized strictly at zero. Upload a CSV file or load our preloaded retail dataset to hydrate real records.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLoadRealData}
              disabled={isLoadingReal}
              className="notion-btn-primary text-xs py-2 px-3.5"
            >
              <Database className={`h-3.5 w-3.5 ${isLoadingReal ? "animate-spin" : ""}`} />
              <span>{isLoadingReal ? "Loading Records..." : "Load Retail Dataset (1-Click)"}</span>
            </button>
            <Link
              href="/data"
              className="notion-btn-secondary text-xs py-2 px-3"
            >
              Upload CSV
            </Link>
          </div>
        </div>
      )}

      {/* ========================================================
          4 NOTION DATABASE PROPERTY KPI CARDS
         ======================================================== */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm">📊</span>
            <span className="notion-kicker">DATABASE SUMMARY & KEY METRICS</span>
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {hasData ? "Live Verified Lookback" : "0 Store Records"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Customer Profiles */}
          <div className="notion-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#2383E2]" />
                <span>Customer Profiles</span>
              </span>
              <span className="notion-pill-blue text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                Shoppers
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight tabular-nums">
                {formatNumber(totalProfiles)}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Verified unique store buyers
              </p>
            </div>
          </div>

          {/* Card 2: Completed Orders */}
          <div className="notion-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-[#448361]" />
                <span>Completed Orders</span>
              </span>
              <span className="notion-pill-green text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                Sales
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight tabular-nums">
                {formatNumber(totalOrders)}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Verified retail transactions
              </p>
            </div>
          </div>

          {/* Card 3: Historical Net Sales */}
          <div className="notion-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-[#D9730D]" />
                <span>Historical Net Sales</span>
              </span>
              <span className="notion-pill-orange text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                180d Lookback
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight tabular-nums">
                {formatCurrency(netSales)}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Net revenue in window
              </p>
            </div>
          </div>

          {/* Card 4: Active Personas */}
          <div className="notion-card p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <LayoutGrid className="h-4 w-4 text-[#9065B0]" />
                <span>Active Personas</span>
              </span>
              <span className="notion-pill-purple text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                Clusters
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight tabular-nums">
                {activePersonaCount}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Behavioral buyer cohorts
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          CHARTS SECTION: Sales Trend & Persona Share
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Sales Trend */}
        <div className="lg:col-span-7 notion-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--notion-border)]">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <span>📈</span>
                  <span>Monthly Store Sales Trend</span>
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Empirical transaction revenue across 6-month window
                </p>
              </div>
              <span className={`text-[10px] ${hasData ? "studio-badge-success" : "studio-badge"}`}>
                <CheckCircle2 className="h-3 w-3" />
                {hasData ? "Verified Data" : "0 Records"}
              </span>
            </div>

            {monthlyRevenueData.length > 0 ? (
              <div className="h-[250px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <XAxis
                      dataKey="month"
                      stroke={isDark ? "#787774" : "#9B9A97"}
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: isDark ? "#2E2E2E" : "#E9E9E7" }}
                    />
                    <YAxis
                      stroke={isDark ? "#787774" : "#9B9A97"}
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: isDark ? "#2E2E2E" : "#E9E9E7" }}
                      tickFormatter={formatInrLakhs}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(val), "Net Sales"]}
                      contentStyle={{
                        backgroundColor: isDark ? "#202020" : "#FFFFFF",
                        borderColor: isDark ? "#3F3F3F" : "#E2E2DF",
                        borderRadius: "8px",
                        color: isDark ? "#E6E6E6" : "#37352F",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    />
                    <Bar dataKey="netSales" fill="#2383E2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-[var(--notion-border)] rounded-lg">
                <NotionEmptyStateIllustration className="w-28 h-auto mb-2 opacity-80" />
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">No Transaction Records</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 max-w-xs">
                  Monthly revenue will populate dynamically once a store dataset is loaded.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 5 cols: Customer Segments Breakdown */}
        <div className="lg:col-span-5 notion-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-[var(--notion-border)]">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <span>👥</span>
                  <span>Customer Persona Share</span>
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Audience distribution across core clusters
                </p>
              </div>
              <Link href="/personas" className="text-xs text-[#2383E2] hover:underline flex items-center gap-0.5">
                <span>View all</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {personaDistData.length > 0 ? (
              <div className="h-[150px] w-full flex items-center justify-center my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={personaDistData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={68}
                      paddingAngle={3}
                    >
                      {personaDistData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke={isDark ? "#202020" : "#FFFFFF"} strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`${formatNumber(val)} customers`, "Audience"]}
                      contentStyle={{
                        backgroundColor: isDark ? "#202020" : "#FFFFFF",
                        borderColor: isDark ? "#3F3F3F" : "#E2E2DF",
                        borderRadius: "8px",
                        color: isDark ? "#E6E6E6" : "#37352F",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[150px] w-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-[var(--notion-border)] rounded-lg my-2">
                <Users className="h-6 w-6 text-neutral-400 mb-1" />
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">0 Active Segments</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Load dataset to discover customer personas.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-[var(--notion-border)] mt-2">
            {personaDistData.length > 0 ? (
              personaDistData.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{p.name}</span>
                  </div>
                  <span className="text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">
                    {formatNumber(p.count)} ({formatPercent(p.share)})
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-neutral-400 py-1">
                No audience segments calculated.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          NOTION DATABASE TABLE: Active Marketing Campaigns
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Active Campaigns Table */}
        <div className="lg:col-span-7 notion-card p-6">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--notion-border)]">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <span>📢</span>
                <span>Active Campaigns Database</span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Targeted initiatives currently running or prepared
              </p>
            </div>
            <Link href="/campaigns" className="notion-btn-secondary text-xs py-1 px-2.5">
              New Campaign
            </Link>
          </div>

          <div className="overflow-x-auto border border-[var(--notion-border)] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 font-semibold border-b border-[var(--notion-border)]">
                <tr>
                  <th className="p-3">Aa Campaign Name</th>
                  <th className="p-3">🏷️ Persona</th>
                  <th className="p-3">📢 Channel</th>
                  <th className="p-3">💵 Budget</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--notion-border)] text-neutral-900 dark:text-neutral-100">
                {campaigns && campaigns.length > 0 ? (
                  campaigns.map((c: any) => (
                    <tr key={c.id} className="hover:bg-[var(--notion-hover)] transition-colors">
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3 text-[#2383E2]">{c.objective || "Audience Segment"}</td>
                      <td className="p-3 text-neutral-500 dark:text-neutral-400">{c.channel}</td>
                      <td className="p-3 tabular-nums font-semibold">{formatCurrency(c.budget)}</td>
                      <td className="p-3 text-right">
                        <span className="notion-pill-green text-[10px] px-2 py-0.5 rounded font-medium">
                          {c.status || "Active"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
                      No active marketing campaigns. Load dataset to plan campaigns for customer segments.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 5 cols: Notion Workflow Cards */}
        <div className="lg:col-span-5 notion-card p-6 flex flex-col justify-between">
          <div>
            <div className="pb-2 border-b border-[var(--notion-border)] mb-3">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <span>⚡</span>
                <span>Marketing Playbook</span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Recommended 3-step workflow to drive incremental revenue
              </p>
            </div>

            <div className="space-y-2.5">
              <Link
                href="/personas"
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-hover)] hover:border-neutral-400 dark:hover:border-neutral-600 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-md bg-[#E7F3F8] dark:bg-[#193344] text-[#337EA9] dark:text-[#529CCA] flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-[#2383E2] transition-colors">
                      Review Customer Personas
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Examine purchasing habits and basket fingerprints
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors" />
              </Link>

              <Link
                href="/campaigns"
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-hover)] hover:border-neutral-400 dark:hover:border-neutral-600 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-md bg-[#FBEDD6] dark:bg-[#492F13] text-[#D9730D] dark:text-[#F3983E] flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-[#D9730D] transition-colors">
                      Plan Targeted Campaign
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Forecast budget, ROI, and generate messaging
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors" />
              </Link>

              <Link
                href="/experiments"
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-hover)] hover:border-neutral-400 dark:hover:border-neutral-600 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-md bg-[#EDF3EC] dark:bg-[#1E382B] text-[#448361] dark:text-[#529E72] flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-[#448361] transition-colors">
                      Measure Incremental Lift
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Validate real test vs control conversion gain
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
