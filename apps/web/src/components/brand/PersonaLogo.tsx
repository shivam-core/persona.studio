"use client";

import React from "react";
import Link from "next/link";

interface PersonaLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  href?: string;
}

export function PersonaLogo({
  size = "md",
  showWordmark = true,
  className = "",
  href = "/",
}: PersonaLogoProps) {
  const iconSizes = {
    sm: "h-6 w-6",
    md: "h-7 w-7",
    lg: "h-9 w-9",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
  };

  const Content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Notion-style 3D Isometric Persona Cube Emblem */}
      <div className={`relative ${iconSizes[size]} shrink-0 transition-transform hover:scale-105 duration-200`}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          {/* Isometric 3D Cube / Book Container */}
          {/* Top Face */}
          <path
            d="M20 4L34 11.5L20 19L6 11.5L20 4Z"
            className="fill-white dark:fill-[#2A2A2A] stroke-neutral-900 dark:stroke-white"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          {/* Top Page Layer Detail */}
          <path
            d="M20 7.5L30.5 13L20 18.5L9.5 13L20 7.5Z"
            className="fill-neutral-100 dark:fill-[#333333]"
          />
          {/* Mini Sticky Tab on Top (Notion Yellow Accent) */}
          <path
            d="M24 6L28 8.2L26 9.8L22 7.6L24 6Z"
            className="fill-[#F59E0B] stroke-neutral-900 dark:stroke-white"
            strokeWidth="1.2"
          />

          {/* Left Face */}
          <path
            d="M6 11.5L20 19V34.5L6 27V11.5Z"
            className="fill-neutral-200 dark:fill-[#202020] stroke-neutral-900 dark:stroke-white"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          {/* Left Spine Book Line Detail */}
          <path
            d="M9 13.5V28"
            className="stroke-neutral-400 dark:stroke-neutral-600"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Right Face */}
          <path
            d="M20 19L34 11.5V27L20 34.5V19Z"
            className="fill-neutral-300 dark:fill-[#1A1A1A] stroke-neutral-900 dark:stroke-white"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Stylized Hand-Drawn "P" on Right Face */}
          <path
            d="M24.5 22.5V30M24.5 22.5H28C29.4 22.5 30.2 23.3 30.2 24.6C30.2 25.9 29.4 26.7 28 26.7H24.5"
            className="stroke-neutral-900 dark:stroke-white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Notion Signature Wordmark: "Persona" */}
      {showWordmark && (
        <div className="flex items-center gap-1.5 leading-none">
          <span
            className={`font-bold tracking-tight text-neutral-900 dark:text-neutral-100 ${textSizes[size]}`}
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
          >
            Persona
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
            Studio
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="focus:outline-none">
        {Content}
      </Link>
    );
  }

  return Content;
}
