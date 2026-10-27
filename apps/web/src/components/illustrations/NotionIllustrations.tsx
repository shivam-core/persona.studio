"use client";

import React from "react";

/**
 * Notion-style authentic hand-drawn vector illustrations
 * Inspired by Roman Muradov's signature line art for Notion.
 * Features black-and-white ink line work, stippling, and warm color pops.
 */

interface IllustrationProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

/**
 * 1. Notion Hero Trio:
 * Girl typing on typewriter atop books + Boy launching paper planes + Running creator with bird
 */
export function NotionHeroTrio({ className = "w-full max-w-2xl h-auto" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 800 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Halftone / Stipple dot texture for hand-drawn shading */}
        <pattern id="stipple-pattern" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.8" className="fill-neutral-900 dark:fill-neutral-100 opacity-30" />
          <circle cx="5" cy="5" r="0.6" className="fill-neutral-900 dark:fill-neutral-100 opacity-25" />
        </pattern>
        <pattern id="stipple-dense" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.9" className="fill-neutral-900 dark:fill-neutral-100 opacity-40" />
        </pattern>
      </defs>

      {/* ========================================================
          LEFT CHARACTER: Girl with cozy hair typing on books
         ======================================================== */}
      <g id="girl-with-typewriter">
        {/* Stack of books at base */}
        <rect x="110" y="290" width="130" height="22" rx="4" className="fill-neutral-100 dark:fill-[#262626] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
        <line x1="120" y1="300" x2="230" y2="300" className="stroke-neutral-400 dark:stroke-neutral-600" strokeWidth="1.5" />
        <rect x="100" y="265" width="145" height="25" rx="4" className="fill-white dark:fill-[#222222] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
        <rect x="115" y="240" width="125" height="25" rx="4" className="fill-neutral-100 dark:fill-[#282828] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />

        {/* Vintage Typewriter */}
        <path d="M135 240L145 200H210L220 240H135Z" className="fill-neutral-200 dark:fill-[#333333] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
        {/* Typewriter paper sheet sticking up */}
        <rect x="160" y="165" width="36" height="35" rx="2" className="fill-white dark:fill-[#1A1A1A] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" />
        <line x1="166" y1="175" x2="190" y2="175" className="stroke-neutral-400 dark:stroke-neutral-500" strokeWidth="1.5" />
        <line x1="166" y1="182" x2="185" y2="182" className="stroke-neutral-400 dark:stroke-neutral-500" strokeWidth="1.5" />
        {/* Typewriter Keys */}
        <circle cx="155" cy="225" r="2.5" className="fill-neutral-900 dark:fill-neutral-100" />
        <circle cx="165" cy="225" r="2.5" className="fill-neutral-900 dark:fill-neutral-100" />
        <circle cx="175" cy="225" r="2.5" className="fill-neutral-900 dark:fill-neutral-100" />
        <circle cx="185" cy="225" r="2.5" className="fill-neutral-900 dark:fill-neutral-100" />
        <circle cx="195" cy="225" r="2.5" className="fill-neutral-900 dark:fill-neutral-100" />
        <circle cx="205" cy="225" r="2.5" className="fill-neutral-900 dark:fill-neutral-100" />

        {/* Legs sitting cross-legged */}
        <path d="M120 260C100 270 90 295 125 300C155 305 160 275 145 255" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />
        {/* Cozy patterned sweater */}
        <path d="M140 185C130 200 125 230 145 245C165 250 185 245 190 220C195 195 170 175 140 185Z" className="fill-white dark:fill-[#202020] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
        {/* Sweater cross-hatch stipples */}
        <path d="M142 205C148 220 160 235 175 235" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M148 195C158 210 170 225 185 220" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="1.5" strokeDasharray="3 3" />

        {/* Arms outstretched typing */}
        <path d="M150 190C160 200 165 210 170 215" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M140 195C150 205 155 215 160 218" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />

        {/* Head and flowing Notion hair */}
        {/* Hair back */}
        <path d="M135 130C110 140 95 170 115 210C120 215 130 210 132 195C125 170 135 145 140 135" className="fill-neutral-900 dark:fill-neutral-100" />
        {/* Neck */}
        <path d="M150 170V185" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />
        {/* Face profile */}
        <path d="M155 140C165 145 170 155 168 165C166 172 158 178 150 175" className="fill-white dark:fill-[#1E1E1E] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />
        {/* Eye & Brow */}
        <circle cx="160" cy="155" r="2.2" className="fill-neutral-900 dark:fill-neutral-100" />
        <path d="M156 150C160 148 164 149 166 151" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="1.8" strokeLinecap="round" />
        {/* Smile */}
        <path d="M162 165C165 166 167 165 168 163" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="1.8" strokeLinecap="round" />
        {/* Front Hair bangs */}
        <path d="M140 130C155 125 170 130 172 142C165 140 155 142 148 145C142 140 138 135 140 130Z" className="fill-neutral-900 dark:fill-neutral-100" />
      </g>

      {/* ========================================================
          CENTER CHARACTER: Boy with striped shirt launching planes
         ======================================================== */}
      <g id="boy-launching-planes">
        {/* Stippled shadow beneath */}
        <ellipse cx="400" cy="335" rx="55" ry="8" fill="url(#stipple-pattern)" />

        {/* Legs & Pants (solid black ink) */}
        <path d="M380 230L375 320H392L395 245L408 320H425L415 230Z" className="fill-neutral-900 dark:fill-neutral-100" />

        {/* Striped Torso / T-Shirt */}
        <path d="M375 165C370 190 372 230 380 235H415C420 220 422 185 415 165C400 160 388 160 375 165Z" className="fill-white dark:fill-[#222222] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
        {/* Horizontal Stripes */}
        <line x1="373" y1="180" x2="416" y2="180" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="3" />
        <line x1="372" y1="195" x2="417" y2="195" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="3" />
        <line x1="374" y1="210" x2="417" y2="210" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="3" />
        <line x1="378" y1="225" x2="416" y2="225" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="3" />

        {/* Left Arm by side */}
        <path d="M375 170C365 190 365 210 370 230" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />

        {/* Right Arm raised throwing high into the sky */}
        <path d="M415 170C425 155 435 130 445 105C447 100 450 102 448 108" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />
        {/* Hand releasing plane */}
        <path d="M444 105C448 98 454 100 452 106" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" strokeLinecap="round" />

        {/* Head tilted up watching planes */}
        <path d="M390 120C402 115 415 125 418 138C420 150 410 162 398 160C388 158 382 145 385 132C386 128 388 123 390 120Z" className="fill-white dark:fill-[#202020] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
        {/* Big excited open mouth looking up */}
        <path d="M410 142C414 140 417 145 414 148C410 150 408 145 410 142Z" className="fill-neutral-900 dark:fill-neutral-100" />
        {/* Big curious eye */}
        <circle cx="410" cy="132" r="2.5" className="fill-neutral-900 dark:fill-neutral-100" />
        <path d="M407 126C411 124 415 125 417 127" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="1.8" strokeLinecap="round" />
        {/* Hair - Notion messy tuft */}
        <path d="M385 130C380 115 390 105 405 108C415 110 422 118 420 128C412 120 400 118 392 124C388 126 386 128 385 130Z" className="fill-neutral-900 dark:fill-neutral-100" />

        {/* Yellow Paper Airplanes Soaring through the sky */}
        {/* Plane 1: Closest to hand */}
        <g transform="translate(465, 80) rotate(-25)">
          <polygon points="0,0 35,15 10,25 0,35 15,18" className="fill-[#F59E0B] stroke-neutral-900 dark:stroke-white" strokeWidth="2" strokeLinejoin="round" />
          <line x1="0" y1="0" x2="35" y2="15" className="stroke-neutral-900 dark:stroke-white" strokeWidth="1.5" />
        </g>
        {/* Plane 2: Higher flight */}
        <g transform="translate(560, 45) rotate(-15)">
          <polygon points="0,0 40,16 12,28 0,38 18,20" className="fill-[#FCD34D] stroke-neutral-900 dark:stroke-white" strokeWidth="2" strokeLinejoin="round" />
          <line x1="0" y1="0" x2="40" y2="16" className="stroke-neutral-900 dark:stroke-white" strokeWidth="1.5" />
        </g>
        {/* Plane 3: Ascending far right */}
        <g transform="translate(680, 20) rotate(-35)">
          <polygon points="0,0 30,12 8,22 0,30 12,15" className="fill-[#F59E0B] stroke-neutral-900 dark:stroke-white" strokeWidth="2" strokeLinejoin="round" />
        </g>

        {/* Flight Trajectory Dotted Arc */}
        <path d="M455 100C490 60 550 40 670 25" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
      </g>

      {/* ========================================================
          RIGHT CHARACTER: Creator running with bird & dog
         ======================================================== */}
      <g id="creator-running">
        {/* Shadow */}
        <ellipse cx="640" cy="335" rx="45" ry="7" fill="url(#stipple-pattern)" />

        {/* Running legs */}
        <path d="M605 285C585 295 565 310 550 315C565 318 580 305 605 295" className="fill-neutral-900 dark:fill-neutral-100 stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
        <path d="M635 270C645 285 660 305 675 320C665 322 650 315 635 290" className="fill-neutral-900 dark:fill-neutral-100 stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />

        {/* Notion character dark trousers & shoes */}
        <path d="M610 215C600 240 590 270 575 290L585 298C600 275 615 245 625 215Z" className="fill-neutral-900 dark:fill-neutral-100" />
        <path d="M625 215C635 240 645 265 665 295L655 302C635 275 625 245 615 215Z" className="fill-neutral-900 dark:fill-neutral-100" />

        {/* Torso leaning forward in sprint */}
        <path d="M605 160C620 165 635 170 638 190C640 210 630 220 615 220C600 220 595 200 592 180C590 170 595 162 605 160Z" className="fill-white dark:fill-[#222222] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />

        {/* Left arm bent holding document portfolio */}
        <path d="M600 175C590 190 590 210 605 215" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />
        {/* Document binder / folder with colored sticky note */}
        <rect x="580" y="195" width="22" height="28" rx="2" transform="rotate(-15 580 195)" className="fill-white dark:fill-[#1E1E1E] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" />
        <rect x="583" y="198" width="8" height="8" rx="1" transform="rotate(-15 583 198)" className="fill-[#3B82F6]" />

        {/* Head with joyful face */}
        <circle cx="635" cy="140" r="18" className="fill-white dark:fill-[#202020] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
        {/* Hair with Notion tuft */}
        <path d="M625 125C630 115 645 118 650 128C652 135 650 145 645 142C640 138 630 135 625 125Z" className="fill-neutral-900 dark:fill-neutral-100" />
        {/* Eye & happy wink */}
        <circle cx="642" cy="138" r="2.2" className="fill-neutral-900 dark:fill-neutral-100" />
        {/* Grin */}
        <path d="M638 147C642 151 648 149 650 146" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" strokeLinecap="round" />

        {/* Friendly Flying Pet Bird */}
        <g transform="translate(680, 115)">
          {/* Bird body */}
          <path d="M10 15C20 10 30 15 28 25C25 30 15 28 10 22C6 18 8 16 10 15Z" className="fill-white dark:fill-[#2A2A2A] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" />
          {/* Wing flapping */}
          <path d="M18 15C22 5 32 8 28 16" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" strokeLinecap="round" />
          {/* Beak & eye */}
          <polygon points="28,18 34,19 28,22" className="fill-[#F59E0B] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="1" />
          <circle cx="23" cy="18" r="1.5" className="fill-neutral-900 dark:fill-neutral-100" />
        </g>

        {/* Whimsical Dog trotting alongside */}
        <g transform="translate(490, 260)">
          {/* Body */}
          <ellipse cx="30" cy="25" rx="20" ry="12" className="fill-white dark:fill-[#222222] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
          {/* Head & Floppy Ear */}
          <circle cx="12" cy="18" r="10" className="fill-white dark:fill-[#222222] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
          <path d="M14 12C18 16 16 26 12 24" className="fill-neutral-900 dark:fill-neutral-100 stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" />
          {/* Snout & nose */}
          <path d="M6 18C2 20 2 24 8 24" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" strokeLinecap="round" />
          <circle cx="4" cy="20" r="1.5" className="fill-neutral-900 dark:fill-neutral-100" />
          <circle cx="10" cy="16" r="1.5" className="fill-neutral-900 dark:fill-neutral-100" />
          {/* Legs trotting */}
          <path d="M18 35L16 46M25 36L28 46M35 36L34 46M42 34L45 46" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />
          {/* Tail wagging high */}
          <path d="M48 20C55 12 58 10 56 16" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

/**
 * 2. Notion Girl Creator with Idea Board & Geometric Shapes
 * Matches Screenshot 3: Girl pinning sticky shapes on canvas
 */
export function NotionGirlCreator({ className = "w-64 h-auto" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 320 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Board / Canvas */}
      <rect x="90" y="30" width="180" height="150" rx="6" className="fill-white dark:fill-[#222222] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
      {/* Little easel pin top */}
      <rect x="175" y="22" width="10" height="12" rx="2" className="fill-neutral-900 dark:fill-neutral-100" />

      {/* Colorful Geometric Shapes on the Board (Notion iconic creative blocks) */}
      {/* Red/Coral Triangle */}
      <polygon points="120,70 145,115 95,115" className="fill-[#EF4444] stroke-neutral-900 dark:stroke-white" strokeWidth="2" strokeLinejoin="round" />
      {/* Yellow Semicircle */}
      <path d="M165 75C185 75 200 90 200 110H130C130 90 145 75 165 75Z" className="fill-[#F59E0B] stroke-neutral-900 dark:stroke-white" strokeWidth="2" strokeLinejoin="round" />
      {/* Blue Soft Square */}
      <rect x="210" y="70" width="38" height="38" rx="8" transform="rotate(12 210 70)" className="fill-[#3B82F6] stroke-neutral-900 dark:stroke-white" strokeWidth="2" />

      {/* Girl Character reaching up to place shapes */}
      {/* Textured curly hair */}
      <circle cx="58" cy="130" r="18" className="fill-neutral-900 dark:fill-neutral-100" />
      <circle cx="48" cy="142" r="16" className="fill-neutral-900 dark:fill-neutral-100" />
      <circle cx="45" cy="158" r="18" className="fill-neutral-900 dark:fill-neutral-100" />
      <circle cx="55" cy="172" r="16" className="fill-neutral-900 dark:fill-neutral-100" />

      {/* Face */}
      <path d="M60 135C72 138 80 148 78 160C76 168 68 174 58 172" className="fill-white dark:fill-[#202020] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
      {/* Eye & Brow */}
      <circle cx="70" cy="150" r="2.2" className="fill-neutral-900 dark:fill-neutral-100" />
      <path d="M66 144C70 142 75 144 77 146" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="1.8" strokeLinecap="round" />
      {/* Smile */}
      <path d="M68 160C72 162 76 160 77 158" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="1.8" strokeLinecap="round" />

      {/* Body / Dress */}
      <path d="M55 185C45 210 40 250 50 280H90C95 250 85 210 75 185Z" className="fill-white dark:fill-[#252525] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />

      {/* Arm extended up pinning yellow circle onto board */}
      <path d="M72 190C85 180 100 155 120 140" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="125" cy="138" r="8" className="fill-[#10B981] stroke-neutral-900 dark:stroke-white" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * 3. Notion Peeking Character (Top bar or Card corner)
 * Matches Screenshot 1: Big arched brow, friendly eye, peeking over edge
 */
export function NotionPeekingCharacter({ className = "w-16 h-16" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Oval Face Peeking */}
      <path
        d="M20 90C20 40 40 20 60 20C80 20 90 50 90 90"
        className="fill-white dark:fill-[#222222] stroke-neutral-900 dark:stroke-neutral-100"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Big Arched Eyebrow */}
      <path
        d="M38 38C48 30 62 32 72 40"
        className="stroke-neutral-900 dark:stroke-neutral-100"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Big Notion Eye */}
      <circle cx="55" cy="50" r="4.5" className="fill-neutral-900 dark:fill-neutral-100" />
      {/* Whimsical curved nose */}
      <path
        d="M60 48C65 52 64 62 58 64"
        className="stroke-neutral-900 dark:stroke-neutral-100"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Notion Orange Accent Dot */}
      <circle cx="76" cy="36" r="3" className="fill-[#F97316]" />
    </svg>
  );
}

/**
 * 4. Notion Analyst / Data Inspector (For CAC Simulator & Revenue Forecast)
 * Character looking through magnifying glass at metrics & charts
 */
export function NotionAnalyst({ className = "w-48 h-auto" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 240 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Desk surface */}
      <line x1="20" y1="190" x2="220" y2="190" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" strokeLinecap="round" />

      {/* Coffee Mug with steam */}
      <rect x="35" y="155" width="22" height="26" rx="4" className="fill-white dark:fill-[#252525] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" />
      <path d="M57 162C62 162 64 172 57 174" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" />
      <path d="M42 148C40 144 44 140 42 136" className="stroke-neutral-400 dark:stroke-neutral-600" strokeWidth="1.5" strokeLinecap="round" />

      {/* Ledger / Chart Page on Desk */}
      <rect x="75" y="145" width="60" height="40" rx="3" className="fill-white dark:fill-[#202020] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" />
      {/* Mini Bar Chart inside document */}
      <rect x="85" y="165" width="7" height="15" className="fill-[#F59E0B]" />
      <rect x="96" y="155" width="7" height="25" className="fill-[#10B981]" />
      <rect x="107" y="160" width="7" height="20" className="fill-[#3B82F6]" />
      <rect x="118" y="150" width="7" height="30" className="fill-[#8B5CF6]" />

      {/* Analyst Head with Round Glasses */}
      <circle cx="160" cy="90" r="28" className="fill-white dark:fill-[#222222] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
      {/* Big Glasses */}
      <circle cx="150" cy="90" r="10" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.2" />
      <circle cx="174" cy="90" r="10" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.2" />
      <line x1="160" y1="90" x2="164" y2="90" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" />
      {/* Pupils peering intently */}
      <circle cx="150" cy="90" r="2.5" className="fill-neutral-900 dark:fill-neutral-100" />
      <circle cx="174" cy="90" r="2.5" className="fill-neutral-900 dark:fill-neutral-100" />

      {/* Hair - Notion messy part */}
      <path d="M135 80C140 60 165 58 180 65C190 70 192 80 188 88C175 75 150 75 135 80Z" className="fill-neutral-900 dark:fill-neutral-100" />

      {/* Magnifying Glass held in hand */}
      <circle cx="130" cy="130" r="16" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2.5" />
      <line x1="142" y1="142" x2="158" y2="158" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 5. Notion Empty State - Character with empty desk & notebook
 */
export function NotionEmptyStateIllustration({ className = "w-40 h-auto" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Base line */}
      <line x1="30" y1="150" x2="170" y2="150" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" strokeLinecap="round" />

      {/* Open notebook */}
      <path d="M60 150L65 110L95 115L95 150H60Z" className="fill-white dark:fill-[#222222] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" />
      <path d="M130 150L125 110L95 115L95 150H130Z" className="fill-neutral-100 dark:fill-[#262626] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" />
      {/* Spine */}
      <line x1="95" y1="115" x2="95" y2="150" className="stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="2" />

      {/* Hand holding pencil ready to write */}
      <path d="M100 85L110 65L115 67L105 87L100 85Z" className="fill-[#F59E0B] stroke-neutral-900 dark:stroke-neutral-100" strokeWidth="1.5" />
      <polygon points="100,85 97,92 105,87" className="fill-neutral-900 dark:fill-neutral-100" />

      {/* Floating Idea Sparkles */}
      <path d="M140 60L142 52L150 50L142 48L140 40L138 48L130 50L138 52L140 60Z" className="fill-[#F59E0B]" />
      <circle cx="55" cy="70" r="3" className="fill-[#3B82F6]" />
      <circle cx="160" cy="85" r="2.5" className="fill-[#10B981]" />
    </svg>
  );
}
