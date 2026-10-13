"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Settings as SettingsIcon,
  Save,
  Download,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Database,
  Info,
} from "lucide-react";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { data: workspace } = useQuery({
    queryKey: ["workspace"],
    queryFn: api.getWorkspace,
  });

  const [name, setName] = useState(workspace?.name || "Persona Studio Demo Workspace");
  const [currency, setCurrency] = useState(workspace?.currency || "INR");
  const [timezone, setTimezone] = useState(workspace?.timezone || "Asia/Kolkata");

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      await api.updateWorkspace({ name, currency, timezone });
      await queryClient.invalidateQueries();
      alert("Workspace settings updated successfully!");
    } catch (err: any) {
      alert("Failed to update settings: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDemo = async () => {
    if (confirm("Reset demo data to default synthetic Indian retail dataset? All modified scenarios will be restored to defaults.")) {
      try {
        setIsResetting(true);
        await api.seedDemo();
        await queryClient.invalidateQueries();
        alert("Demo dataset restored to initial seed (seed=42)!");
      } catch (err: any) {
        alert("Failed to reset demo: " + err.message);
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#17233B] tracking-tight">
          Workspace Settings & Governance
        </h1>
        <p className="text-sm text-[#52617A] mt-1">
          Configure display currencies, timezones, security modes, and download audit lineage records.
        </p>
      </div>

      {/* Main Settings Panel */}
      <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-6 text-xs">
        <div>
          <h2 className="text-base font-semibold text-[#17233B] mb-1">
            General Configuration
          </h2>
          <p className="text-[#52617A]">
            Global parameters applied to reporting calculations and UI formatters.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-[#17233B] mb-1">
              Workspace Name
            </label>
            <input
              type="text"
              defaultValue={workspace?.name || name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#17233B] mb-1">
              Default Currency
            </label>
            <select
              defaultValue={workspace?.currency || currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
            >
              <option value="INR">Indian Rupee (INR - ₹)</option>
              <option value="USD">US Dollar (USD - $)</option>
              <option value="EUR">Euro (EUR - €)</option>
              <option value="GBP">British Pound (GBP - £)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#17233B] mb-1">
              Display Timezone
            </label>
            <select
              defaultValue={workspace?.timezone || timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#17233B]"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#17233B] mb-1">
              Access Mode
            </label>
            <input
              type="text"
              disabled
              value="Local Development (Unrestricted)"
              className="w-full p-2 rounded-lg border border-[#E2E8F2] bg-[#F5F7FB] text-[#52617A]"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#E2E8F2] flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5146D9] text-white text-xs font-semibold hover:bg-[#4338CA] transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving..." : "Save Preferences"}</span>
          </button>
        </div>
      </div>

      {/* Export & Governance */}
      <div className="p-6 rounded-xl bg-white border border-[#E2E8F2] shadow-sm space-y-4 text-xs">
        <div>
          <h2 className="text-base font-semibold text-[#17233B] mb-1">
            Data Exports & Academic Audit Trail
          </h2>
          <p className="text-[#52617A]">
            Download verified mathematical definitions, model cards, and raw lineage records.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-[#E2E8F2] bg-[#F5F7FB]/50 space-y-2">
            <span className="font-bold text-[#17233B]">Metric Dictionary</span>
            <p className="text-[#52617A] text-[11px]">
              Complete mathematical dictionary covering every money, rate, count, refund, and unit economics formula.
            </p>
            <a
              href="/METRIC_DICTIONARY.md"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs text-[#5146D9] font-semibold hover:underline pt-1"
            >
              <Download className="h-3.5 w-3.5" />
              <span>View Metric Dictionary</span>
            </a>
          </div>

          <div className="p-4 rounded-xl border border-[#E2E8F2] bg-[#F5F7FB]/50 space-y-2">
            <span className="font-bold text-[#17233B]">ML Model Card</span>
            <p className="text-[#52617A] text-[11px]">
              Technical documentation of transformations, clustering algorithms, diagnostics, and ARI stability limits.
            </p>
            <a
              href="/MODEL_CARD.md"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs text-[#5146D9] font-semibold hover:underline pt-1"
            >
              <Download className="h-3.5 w-3.5" />
              <span>View Model Card</span>
            </a>
          </div>
        </div>
      </div>

      {/* Danger Zone / Reset */}
      <div className="p-6 rounded-xl bg-white border border-rose-200 shadow-sm space-y-3 text-xs">
        <div>
          <h2 className="text-base font-semibold text-[#B42335]">
            Reset Demonstration Data
          </h2>
          <p className="text-[#52617A]">
            Resets the synthetic retail customer dataset, order lines, and engagement events to the canonical state (seed=42).
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          disabled={isResetting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
          <span>{isResetting ? "Resetting..." : "Reset Synthetic Demo"}</span>
        </button>
      </div>
    </div>
  );
}
