"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CheckCircle2, Database, RotateCcw, Download, AlertCircle, Share2, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const PAGE_NAMES: Record<string, { title: string; emoji: string }> = {
  "/": { title: "Overview", emoji: "📊" },
  "/personas": { title: "Persona Studio", emoji: "👥" },
  "/segments": { title: "Audience Segments", emoji: "🎯" },
  "/campaigns": { title: "Campaign Planner", emoji: "📢" },
  "/cac-simulator": { title: "CAC Simulator", emoji: "🧮" },
  "/simulator": { title: "Revenue Forecast", emoji: "📈" },
  "/experiments": { title: "A/B Lift Tests", emoji: "🧪" },
  "/offerings": { title: "Product Catalog", emoji: "📦" },
  "/data": { title: "Data Hub & Records", emoji: "🗄️" },
  "/settings": { title: "Workspace Settings", emoji: "⚙️" },
};

export function TopBar() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [isResetting, setIsResetting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const currentPage = PAGE_NAMES[pathname] || { title: "Workspace", emoji: "📄" };

  const { data: datasets } = useQuery({
    queryKey: ["datasets"],
    queryFn: api.getDatasets,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: api.checkHealth,
    refetchInterval: 15000,
  });

  const activeDataset = datasets?.[0];
  const hasData = Boolean(
    activeDataset &&
      (activeDataset.accepted_rows > 0 ||
        (activeDataset.row_counts?.customers ?? 0) > 0)
  );

  const customerCount =
    activeDataset?.row_counts?.customers ?? activeDataset?.accepted_rows ?? 0;

  const handleLoadRealData = async () => {
    try {
      setIsLoadingData(true);
      await api.importRealBundle();
      await queryClient.invalidateQueries();
    } catch (err: any) {
      console.error("Failed to load dataset:", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleResetWorkspace = async () => {
    if (confirm("Reset workspace to zero state? This will clear all datasets and numbers until you load them again.")) {
      try {
        setIsResetting(true);
        await api.resetWorkspace();
        await queryClient.invalidateQueries();
      } catch (err: any) {
        console.error("Failed to reset:", err);
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <header className="h-13 border-b border-[var(--notion-border)] bg-[var(--notion-topbar-bg)] px-5 flex items-center justify-between sticky top-0 z-20 transition-colors duration-200">
      {/* Left: Notion Breadcrumbs & Dataset pill */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-[var(--notion-text-muted)] font-medium">
          <span className="hover:text-[var(--notion-text)] cursor-pointer transition-colors">
            Persona
          </span>
          <span className="text-[var(--notion-text-subtle)]">/</span>
          <span className="flex items-center gap-1 text-[var(--notion-text)] font-semibold truncate">
            <span>{currentPage.emoji}</span>
            <span>{currentPage.title}</span>
          </span>
        </div>

        {/* Dataset Status Pill */}
        {hasData ? (
          <div className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <span>{customerCount.toLocaleString()} Verified Records</span>
          </div>
        ) : (
          <div className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 text-[11px] font-medium">
            <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span>Zero State (No Dataset)</span>
          </div>
        )}
      </div>

      {/* Right: Theme Switcher (Light / Dark / System) + Notion Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* 3-Click Theme Switcher (☀️ Light | 🌙 Dark | 💻 System) */}
        <ThemeToggle />

        {/* 1-Click Load Dataset Button if no data */}
        {!hasData ? (
          <button
            onClick={handleLoadRealData}
            disabled={isLoadingData}
            className="notion-btn-primary py-1 px-2.5 text-xs flex items-center gap-1.5"
            title="Load bundled store dataset with 1 click"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isLoadingData ? "Loading..." : "Load Dataset"}</span>
          </button>
        ) : (
          <Link
            href="/data"
            className="notion-btn-secondary py-1 px-2.5 text-xs hidden sm:inline-flex"
          >
            Manage Data
          </Link>
        )}

        {/* Reset Workspace button */}
        <button
          onClick={handleResetWorkspace}
          disabled={isResetting}
          title="Reset workspace to 0"
          className="p-1.5 rounded-md border border-[var(--notion-border)] hover:bg-[var(--notion-hover)] text-[var(--notion-text-muted)] hover:text-[var(--notion-text)] transition-colors cursor-pointer text-xs"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${isResetting ? "animate-spin" : ""}`} />
        </button>

        {/* System Online Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[var(--notion-border)] text-[11px] text-[var(--notion-text-muted)]">
          <span
            className={`h-2 w-2 rounded-full ${
              health?.status === "healthy" || health?.status === "ok" ? "bg-emerald-500" : "bg-rose-500"
            }`}
          />
          <span className="text-[10px]">Connected</span>
        </div>
      </div>
    </header>
  );
}
