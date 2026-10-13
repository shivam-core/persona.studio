"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Network,
  Users,
  Package,
  Megaphone,
  Calculator,
  FlaskConical,
  Settings,
  Sparkles,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Data Hub", href: "/data", icon: Database },
  { name: "Segments", href: "/segments", icon: Network },
  { name: "Persona Studio", href: "/personas", icon: Users },
  { name: "Offerings", href: "/offerings", icon: Package },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Simulator", href: "/simulator", icon: Calculator },
  { name: "Experiments", href: "/experiments", icon: FlaskConical },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ workspaceName }: { workspaceName?: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-[240px] shrink-0 border-r border-[#E2E8F2] bg-white flex flex-col h-screen sticky top-0 select-none">
      {/* Brand & Wordmark */}
      <div className="h-16 flex items-center px-5 border-b border-[#E2E8F2] gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#5146D9] text-white flex items-center justify-center font-bold text-lg shadow-sm">
          P
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[15px] tracking-tight text-[#17233B]">Persona Studio</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F5F7FB] text-[#5146D9] border border-[#E2E8F2]">
              V1
            </span>
          </div>
          <span className="text-[11px] text-[#52617A] truncate max-w-[140px]">
            {workspaceName || "Marketer Workspace"}
          </span>
        </div>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#52617A]">
          Workflows
        </div>
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#5146D9]/10 text-[#5146D9] font-semibold"
                  : "text-[#52617A] hover:text-[#17233B] hover:bg-[#F5F7FB]"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? "text-[#5146D9]" : "text-[#52617A]"
                }`}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#E2E8F2] bg-[#F5F7FB]/60 m-2 rounded-lg">
        <div className="flex items-center gap-2 text-xs text-[#17233B] font-medium">
          <Sparkles className="h-3.5 w-3.5 text-[#5146D9]" />
          <span>Behavioral Engine</span>
        </div>
        <p className="text-[11px] text-[#52617A] mt-1 leading-relaxed">
          Grounding customer data in unit economics & holdout tests.
        </p>
      </div>
    </aside>
  );
}
