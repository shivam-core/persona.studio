"use client";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: workspace } = useQuery({
    queryKey: ["workspace"],
    queryFn: api.getWorkspace,
  });

  return (
    <div className="flex min-h-screen bg-[var(--notion-bg)] text-[var(--notion-text)] selection:bg-[#CDE8FF] dark:selection:bg-[#1A4971] selection:text-neutral-900 dark:selection:text-white transition-colors duration-200">
      {/* Notion Collapsible Sidebar */}
      <Sidebar workspaceName={workspace?.name} />

      {/* Main Notion Canvas */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--notion-bg)]">
        <TopBar />
        <main className="flex-1 p-6 lg:p-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
