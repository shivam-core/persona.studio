"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw, Database } from "lucide-react";
import { useState } from "react";

export function TopBar() {
  const queryClient = useQueryClient();
  const [isSeeding, setIsSeeding] = useState(false);

  const { data: workspace } = useQuery({
    queryKey: ["workspace"],
    queryFn: api.getWorkspace,
  });

  const { data: datasets } = useQuery({
    queryKey: ["datasets"],
    queryFn: api.getDatasets,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: api.checkHealth,
    refetchInterval: 10000,
  });

  const activeDataset = datasets?.[0];

  const handleSeedDemo = async () => {
    if (confirm("Reset and seed synthetic retail demo data (3,000 customers, 12 offerings, orders, engagement, personas)?")) {
      try {
        setIsSeeding(true);
        await api.seedDemo();
        await queryClient.invalidateQueries();
      } catch (err: any) {
        alert("Failed to seed demo: " + err.message);
      } finally {
        setIsSeeding(false);
      }
    }
  };

  return (
    <header className="h-16 border-b border-[#E2E8F2] bg-white px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left: Metadata badges */}
      <div className="flex items-center gap-3">
        {/* Dataset snapshot */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F5F7FB] border border-[#E2E8F2] text-xs font-medium text-[#17233B]">
          <Database className="h-3.5 w-3.5 text-[#52617A]" />
          <span>
            {activeDataset ? (
              <>
                <span className="font-semibold">{activeDataset.name}</span>
                <span className="text-[#52617A] ml-1">
                  ({activeDataset.row_counts?.customers?.toLocaleString() || 3000} profiles)
                </span>
              </>
            ) : (
              "No Dataset Loaded"
            )}
          </span>
        </div>

        {/* Feature As-of date */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F5F7FB] border border-[#E2E8F2] text-xs text-[#52617A]">
          <span>As-of:</span>
          <span className="font-medium text-[#17233B]">
            {activeDataset?.coverage_period?.end
              ? new Date(activeDataset.coverage_period.end).toISOString().slice(0, 10)
              : "2026-10-13"}
          </span>
        </div>

        {/* Synthetic Demo badge */}
        {(workspace?.is_synthetic_demo || activeDataset?.is_synthetic) && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Synthetic Demo Data
          </div>
        )}
      </div>

      {/* Right: API status & actions */}
      <div className="flex items-center gap-3">
        {/* Backend status indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            health?.status === "ok"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              health?.status === "ok" ? "bg-emerald-500" : "bg-rose-500"
            }`}
          />
          <span className="hidden md:inline">
            {health?.status === "ok" ? "API Connected" : "API Offline"}
          </span>
        </div>

        {/* Seed demo action */}
        <button
          onClick={handleSeedDemo}
          disabled={isSeeding}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F2] hover:bg-[#F5F7FB] text-[#17233B] text-xs font-medium shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-[#5146D9] ${isSeeding ? "animate-spin" : ""}`} />
          <span>{isSeeding ? "Seeding Demo..." : "Explore Demo"}</span>
        </button>
      </div>
    </header>
  );
}
