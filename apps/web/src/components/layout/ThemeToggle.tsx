"use client";

import React from "react";
import { useTheme, ThemeMode } from "../providers/ThemeProvider";
import { Sun, Moon, Laptop } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { mode, setMode } = useTheme();

  const options: Array<{
    id: ThemeMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Laptop },
  ];

  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-900/80 shadow-xs ${className}`}
      role="group"
      aria-label="Theme mode selector"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = mode === option.id;

        return (
          <button
            key={option.id}
            onClick={() => setMode(option.id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              isActive
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs border border-neutral-200/80 dark:border-neutral-700 font-semibold"
                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
            }`}
            title={`Switch to ${option.label} mode`}
            type="button"
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-[11px]">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
