"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PersonaLogo } from "../brand/PersonaLogo";
import {
  LayoutDashboard,
  Users,
  Network,
  Megaphone,
  Calculator,
  TrendingUp,
  FlaskConical,
  Database,
  Settings,
  Package,
  Search,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  emoji: string;
}

const navItems: NavItem[] = [
  { name: "Overview", href: "/", icon: LayoutDashboard, emoji: "📊" },
  { name: "Persona Studio", href: "/personas", icon: Users, emoji: "👥" },
  { name: "Audience Segments", href: "/segments", icon: Network, emoji: "🎯" },
  { name: "Campaign Planner", href: "/campaigns", icon: Megaphone, emoji: "📢" },
  { name: "CAC Simulator", href: "/cac-simulator", icon: Calculator, emoji: "🧮" },
  { name: "Revenue Forecast", href: "/simulator", icon: TrendingUp, emoji: "📈" },
  { name: "A/B Lift Tests", href: "/experiments", icon: FlaskConical, emoji: "🧪" },
  { name: "Product Catalog", href: "/offerings", icon: Package, emoji: "📦" },
  { name: "Data Hub & Records", href: "/data", icon: Database, emoji: "🗄️" },
  { name: "Settings", href: "/settings", icon: Settings, emoji: "⚙️" },
];

export function Sidebar({ workspaceName }: { workspaceName?: string }) {
  const pathname = usePathname();

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

  return (
    <aside className="w-[245px] shrink-0 border-r border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] flex flex-col h-screen sticky top-0 select-none z-20 transition-colors duration-200">
      {/* Notion Workspace Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--notion-border)] hover:bg-[var(--notion-hover)] cursor-pointer transition-colors group">
        <PersonaLogo size="sm" showWordmark={true} />
        <div className="flex items-center gap-1 text-[var(--notion-text-muted)] group-hover:text-[var(--notion-text)]">
          <ChevronDown className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* Quick Search & Utilities */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => {
            // Focus or open command palette / quick jump
            const searchInput = document.querySelector('input[type="text"]') as HTMLElement;
            if (searchInput) searchInput.focus();
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-[var(--notion-text-muted)] hover:text-[var(--notion-text)] hover:bg-[var(--notion-hover)] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-[var(--notion-text-muted)]" />
            <span>Search workspace</span>
          </div>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-[var(--notion-border)] bg-[var(--notion-card-bg)] text-[var(--notion-text-subtle)] font-mono">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Notion Section Pages Tree */}
      <nav className="flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto">
        <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-[var(--notion-text-subtle)] uppercase">
          WORKSPACE PAGES
        </div>

        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-[var(--notion-active)] text-[var(--notion-text)] font-semibold shadow-2xs"
                  : "text-[var(--notion-text-muted)] hover:text-[var(--notion-text)] hover:bg-[var(--notion-hover)]"
              }`}
            >
              <span className="text-sm shrink-0">{item.emoji}</span>
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Notion Workspace Footer / Data Status */}
      <div className="p-3 border-t border-[var(--notion-border)] bg-[var(--notion-sidebar-bg)] space-y-2">
        <div className="flex items-center justify-between text-[11px] px-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                hasData ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className="font-medium text-[var(--notion-text)]">
              {hasData ? "Store Data Ready" : "Zero State (Clean)"}
            </span>
          </div>
          <span className="text-[10px] text-[var(--notion-text-subtle)] font-mono">
            {hasData ? `${activeDataset?.row_counts?.customers ?? 2000} users` : "0 records"}
          </span>
        </div>

        <div className="pt-1 flex items-center justify-between text-[11px] text-[var(--notion-text-muted)] px-1">
          <span className="truncate text-[10px]">
            {workspaceName || "Persona Notion Workspace"}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold uppercase">
            v2.0
          </span>
        </div>
      </div>
    </aside>
  );
}
