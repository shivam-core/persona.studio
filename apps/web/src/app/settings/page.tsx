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
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { mode, setMode, resolvedTheme } = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { data: workspace } = useQuery({
    queryKey: ["workspace"],
    queryFn: api.getWorkspace,
  });

  const [name, setName] = useState(workspace?.name || "Live Retail Studio");
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
    if (confirm("Reset demo data to default store dataset? All custom scenarios will be reset.")) {
      try {
        setIsResetting(true);
        await api.seedDemo();
        await queryClient.invalidateQueries();
        alert("Demo dataset restored!");
      } catch (err: any) {
        alert("Failed to reset demo: " + err.message);
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Notion Page Header */}
      <div className="pb-2">
        <div className="text-4xl mb-2 select-none">⚙️</div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--notion-text)]">
          Workspace Settings
        </h1>
        <p className="text-sm text-[var(--notion-text-muted)] mt-1 max-w-2xl">
          Manage currency standards, display timezones, Notion color theme modes, and system architectural specifications.
        </p>
      </div>

      {/* Notion Callout Box */}
      <div className="notion-callout flex items-start gap-3 p-3.5 text-xs">
        <span className="text-base select-none">💡</span>
        <div className="space-y-0.5 text-[var(--notion-text-muted)]">
          <p className="font-semibold text-[var(--notion-text)]">
            Preferences & Appearance
          </p>
          <p>
            You can toggle between Sun (Light), Moon (Dark), or Computer (System) modes anytime using the 3-click selector in the top bar or right below.
          </p>
        </div>
      </div>

      {/* Theme Selection Block */}
      <div className="notion-card p-5 space-y-4 text-xs">
        <div className="border-b border-[var(--notion-border)] pb-3">
          <h2 className="text-sm font-semibold text-[var(--notion-text)] flex items-center gap-2">
            <span>🎨</span>
            <span>Interface Theme & Notion Appearance</span>
          </h2>
          <p className="text-xs text-[var(--notion-text-muted)] mt-0.5">
            Choose how Persona looks across all workspaces. Currently active:{" "}
            <span className="font-semibold capitalize text-[var(--notion-text)]">
              {mode} mode ({resolvedTheme} active)
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Light Mode Card */}
          <button
            onClick={() => setMode("light")}
            className={`p-4 rounded-lg border text-left transition-all space-y-2 ${
              mode === "light"
                ? "border-[var(--notion-text)] bg-[var(--notion-sidebar-bg)] ring-1 ring-[var(--notion-text)]"
                : "border-[var(--notion-border)] hover:bg-[var(--notion-sidebar-bg)]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded bg-amber-500/10 text-amber-500">
                <Sun className="h-4 w-4" />
              </div>
              {mode === "light" && (
                <span className="notion-pill-green text-[10px] font-semibold px-2 py-0.5 rounded">
                  Selected
                </span>
              )}
            </div>
            <div>
              <div className="font-semibold text-[var(--notion-text)]">Light Mode</div>
              <p className="text-[11px] text-[var(--notion-text-muted)] mt-0.5">
                Crisp paper white with Notion graphite ink typography and gentle card shadows.
              </p>
            </div>
          </button>

          {/* Dark Mode Card */}
          <button
            onClick={() => setMode("dark")}
            className={`p-4 rounded-lg border text-left transition-all space-y-2 ${
              mode === "dark"
                ? "border-[var(--notion-text)] bg-[var(--notion-sidebar-bg)] ring-1 ring-[var(--notion-text)]"
                : "border-[var(--notion-border)] hover:bg-[var(--notion-sidebar-bg)]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded bg-indigo-500/10 text-indigo-400">
                <Moon className="h-4 w-4" />
              </div>
              {mode === "dark" && (
                <span className="notion-pill-green text-[10px] font-semibold px-2 py-0.5 rounded">
                  Selected
                </span>
              )}
            </div>
            <div>
              <div className="font-semibold text-[var(--notion-text)]">Dark Mode</div>
              <p className="text-[11px] text-[var(--notion-text-muted)] mt-0.5">
                Deep obsidian charcoal (#191919) engineered for low-light focus and reduced eye strain.
              </p>
            </div>
          </button>

          {/* System Mode Card */}
          <button
            onClick={() => setMode("system")}
            className={`p-4 rounded-lg border text-left transition-all space-y-2 ${
              mode === "system"
                ? "border-[var(--notion-text)] bg-[var(--notion-sidebar-bg)] ring-1 ring-[var(--notion-text)]"
                : "border-[var(--notion-border)] hover:bg-[var(--notion-sidebar-bg)]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded bg-neutral-500/10 text-[var(--notion-text)]">
                <Monitor className="h-4 w-4" />
              </div>
              {mode === "system" && (
                <span className="notion-pill-green text-[10px] font-semibold px-2 py-0.5 rounded">
                  Selected
                </span>
              )}
            </div>
            <div>
              <div className="font-semibold text-[var(--notion-text)]">System Match</div>
              <p className="text-[11px] text-[var(--notion-text-muted)] mt-0.5">
                Automatically adapts between light and dark according to your device's OS settings.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Main Settings Panel */}
      <div className="notion-card p-5 space-y-5 text-xs">
        <div className="border-b border-[var(--notion-border)] pb-3">
          <h2 className="text-sm font-semibold text-[var(--notion-text)] flex items-center gap-2">
            <span>🏪</span>
            <span>Store Preferences</span>
          </h2>
          <p className="text-xs text-[var(--notion-text-muted)] mt-0.5">
            Global parameters applied to revenue reporting calculations, customer metrics, and currency formatting.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-[var(--notion-text)] mb-1.5">
              Workspace Name
            </label>
            <input
              type="text"
              defaultValue={workspace?.name || name}
              onChange={(e) => setName(e.target.value)}
              className="w-full notion-input text-xs"
            />
          </div>

          <div>
            <label className="block font-medium text-[var(--notion-text)] mb-1.5">
              Default Currency
            </label>
            <select
              defaultValue={workspace?.currency || currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full notion-input text-xs"
            >
              <option value="INR">Indian Rupee (INR - ₹)</option>
              <option value="USD">US Dollar (USD - $)</option>
              <option value="EUR">Euro (EUR - €)</option>
              <option value="GBP">British Pound (GBP - £)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[var(--notion-text)] mb-1.5">
              Display Timezone
            </label>
            <select
              defaultValue={workspace?.timezone || timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full notion-input text-xs"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[var(--notion-text)] mb-1.5">
              Access Mode
            </label>
            <input
              type="text"
              disabled
              value="Connected Store Environment"
              className="w-full notion-input text-xs opacity-60 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--notion-border)] flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="notion-btn-primary flex items-center gap-1.5 text-xs px-3.5 py-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? "Saving..." : "Save Preferences"}</span>
          </button>
        </div>
      </div>

      {/* Export & Governance */}
      <div className="notion-card p-5 space-y-4 text-xs">
        <div className="border-b border-[var(--notion-border)] pb-3">
          <h2 className="text-sm font-semibold text-[var(--notion-text)] flex items-center gap-2">
            <span>📖</span>
            <span>Documentation & System References</span>
          </h2>
          <p className="text-xs text-[var(--notion-text-muted)] mt-0.5">
            Review verified metric definitions, customer segmentation methodologies, and lineage logs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-2">
            <span className="font-semibold text-[var(--notion-text)]">Metric Dictionary</span>
            <p className="text-[var(--notion-text-muted)] text-[11px] leading-relaxed">
              Complete reference covering revenue, net contribution, customer acquisition costs, and unit economics formulas.
            </p>
            <a
              href="/METRIC_DICTIONARY.md"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs notion-pill-blue px-2 py-0.5 rounded font-medium pt-1"
            >
              <Download className="h-3 w-3" />
              <span>View Metric Reference</span>
            </a>
          </div>

          <div className="p-3.5 rounded-lg border border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-2">
            <span className="font-semibold text-[var(--notion-text)]">Methodology & System Architecture</span>
            <p className="text-[var(--notion-text-muted)] text-[11px] leading-relaxed">
              Technical documentation on customer profile creation, holdout testing principles, and statistical reliability.
            </p>
            <a
              href="/MODEL_CARD.md"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-xs notion-pill-blue px-2 py-0.5 rounded font-medium pt-1"
            >
              <Download className="h-3 w-3" />
              <span>View System Specifications</span>
            </a>
          </div>
        </div>
      </div>

      {/* Danger Zone / Reset */}
      <div className="p-5 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] space-y-3 text-xs">
        <div>
          <h2 className="text-sm font-semibold text-rose-500 flex items-center gap-2">
            <span>⚠️</span>
            <span>Reset Demo Store Data</span>
          </h2>
          <p className="text-[var(--notion-text-muted)] mt-0.5">
            Resets default customer profiles, order lines, and engagement events to the canonical baseline state.
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          disabled={isResetting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium transition-all shadow-sm disabled:opacity-50 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isResetting ? "animate-spin" : ""}`} />
          <span>{isResetting ? "Resetting..." : "Reset Store Data"}</span>
        </button>
      </div>
    </div>
  );
}
