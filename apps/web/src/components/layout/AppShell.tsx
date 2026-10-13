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
    <div className="flex min-h-screen bg-[#F5F7FB]">
      <Sidebar workspaceName={workspace?.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
