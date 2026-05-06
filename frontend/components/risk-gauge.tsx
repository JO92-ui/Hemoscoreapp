// FILE: frontend/components/risk-gauge.tsx
"use client";

import { useId } from "react";
import clsx from "clsx";
import type { RiskCategory } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

interface TierStyle {
  ring:     string;
  glow:     string;
  textCls:  string;
  badge:    string;
  barCls:   string;
  arcColor: string;
}

const TIER_STYLES: Record<RiskCategory, TierStyle> = {
  low: {
    ring:     "border-emerald-500/60",
    glow:     "shadow-[0_0_28px_rgba(34,197,94,0.3)]",
    textCls:  "text-emerald-400",
    badge:    "bg-emerald-950/50 border-emerald-800/60 text-emerald-300",
    barCls:   "bg-emerald-500",
    arcColor: "#22c55e",
  },
  medium: {
    ring:     "border-amber-500/60",
    glow:     "shadow-[0_0_28px_rgba(245,158,11,0.3)]",
    textCls:  "text-amber-400",
    badge:    "bg-amber-950/50 border-amber-800/60 text-amber-300",
    barCls:   "bg-amber-500",
    arcColor: "#f59e0b",
  },
  high: {
    ring:     "border-red-500/60",
    glow:     "shadow-[0_0_28px_rgba(239,68,68,0.3)]",
    textCls:  "text-red-400",
    badge:    "bg-red-950/50 border-red-800/60 text-red-300",
    barCls:   "bg-red-500",
    arcColor: "#ef4444",
  },
  very_high: {
    ring:     "border-rose-600/70",
    glow:     "shadow-[0_0_32px_rgba(225,29,72,0.4)]",
    textCls:  "text-rose-400",
    badge:    "bg-rose-950/50 border-rose-800/70 text-rose-300",
    barCls:   "bg-rose-600",
    arcColor: "#e11d48",
  },
};

// Zone colour arcs drawn behind the active fill to keep risk bands always visible.
// Each tuple: [startFraction, endFraction, rgbaColour]
const ZONE_ARCS: [number, number, string][] = [
  [0.00, 0.10, "rgba(34,197,94,0.22)"],   // Low        0–10 %
  [0.10, 0.25, "rgba(245,158,11,0.22)"],  // Medium    10–25 %
  [0.25, 0.50, "rgba(239,68,68,0.22)"],   // High      25–50 %
  [0.50, 1.00, "rgba(225,29,72,0.25)"],   // Very high 50–100 %
];

// Zone-boundary tick fractions (10 %, 25 %, 50 %)
const TICK_FRACTIONS = [0.10, 0.25, 0.50];


// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface RiskGaugeProps {
  riskPercent: number;
  category:    RiskCategory;
  label:       string;
  size?:       "sm" | "md" | "lg";
}

export default function RiskGauge({
  riskPercent,
  category,
  label,
  size = "md",
}: RiskGaugeProps) {
  const style  = TIER_STYLES[category] ?? TIER_STYLES.high;
  const capped = Math.min(Math.max(riskPercent, 0), 100);
  const f      = capped / 100;

  // Geometry
  const dim = size === "lg" ? 168 : size === "sm" ? 100 : 132;
  const sw  = size === "lg" ? 11  : size === "sm" ? 7.5 : 9;   // strokeWidth
  const r   = (dim - sw * 2) / 2;
  const cx  = dim / 2;
  const cy  = dim / 2;
  const C   = 2 * Math.PI * r; // full circumference
  const AL  = C * 0.75;        // 270-degree arc length

  // Active fill arc dasharray / dashoffset
  const fillDash   = AL * f;
  const fillOffset = AL * (1 - f);

  // Zone arc dasharray: "0 skip zoneLen C"
  // Places a dash of (e−s)·AL starting at s·AL from the path start, no offset needed.
  function zoneDashArray(s: number, e: number): string {
    const skip    = s * AL;
    const dashLen = (e - s) * AL;
    return `0 ${skip} ${dashLen} ${C}`;
  }

  // Tick-mark coordinates in SVG local frame (before the 135° CSS rotation).
  // The path starts at SVG-angle 0 (3 o'clock) and sweeps clockwise 270°.
  // At fraction `frac` the arc angle is frac × 270°.
  function tickPoints(frac: number) {
    const rad    = (frac * 270 * Math.PI) / 180;
    const outerR = r + sw * 0.45;
    const innerR = r - sw * 0.45;
    return {
      x1: cx + outerR * Math.cos(rad), y1: cy + outerR * Math.sin(rad),
      x2: cx + innerR * Math.cos(rad), y2: cy + innerR * Math.sin(rad),
    };
  }

  const textCls = size === "lg" ? "text-4xl" : size === "sm" ? "text-xl" : "text-3xl";

  const uid          = useId();
  const clipId        = `gauge-bar-clip-${uid.replace(/:/g, "")}`;
  const wrapperSizeCls = size === "lg" ? "w-[176px] h-[176px]" : size === "sm" ? "w-[108px] h-[108px]" : "w-[140px] h-[140px]";
  const barWidthCls    = size === "lg" ? "w-[176px]" : size === "sm" ? "w-[108px]" : "w-[140px]";

  return (
    <div className="flex flex-col items-center gap-3">

      {/* SVG arc gauge */}
      <div
        className={clsx(
          "relative rounded-full border-2 p-1 transition-all duration-700",
          style.ring,
          style.glow,
          wrapperSizeCls,
        )}
      >
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          className="rotate-[135deg]"
          aria-hidden="true"
        >
          {/* 1 — Zone background arcs (always visible, very subtle) */}
          {ZONE_ARCS.map(([s, e, color], i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={color}
              strokeWidth={sw}
              strokeLinecap="butt"
              strokeDasharray={zoneDashArray(s, e)}
              strokeDashoffset={0}
            />
          ))}

          {/* 2 — Thin dark overlay (defines the track rail) */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(26,58,87,0.60)"
            strokeWidth={sw * 0.35}
            strokeLinecap="round"
            strokeDasharray={`${AL} ${C}`}
          />

          {/* 3 — Active fill arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={style.arcColor}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${fillDash || 0.01} ${C}`}
            strokeDashoffset={fillOffset}
            className="gauge-arc-fill"
          />

          {/* 4 — Tick marks at zone-boundary positions */}
          {TICK_FRACTIONS.map((frac, i) => {
            const tp = tickPoints(frac);
            return (
              <line
                key={i}
                x1={tp.x1} y1={tp.y1}
                x2={tp.x2} y2={tp.y2}
                stroke="rgba(11,25,41,0.95)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
          <span className={clsx("font-bold tabular-nums leading-none", textCls, style.textCls)}>
            {capped % 1 === 0 ? capped : capped.toFixed(1)}%
          </span>
          <span className="text-[10px] uppercase tracking-widest text-slate-500">
            risk
          </span>
        </div>
      </div>

      {/* Tier badge */}
      <span className={clsx("badge border text-[11px] font-semibold px-3 py-1", style.badge)}>
        {label}
      </span>

      {/* Linear band bar — SVG presentation attributes avoid inline style warnings */}
      <div className={barWidthCls}>
        <svg width="100%" height="8" aria-hidden="true">
          <defs>
            <clipPath id={clipId}>
              <rect x="0" y="0" width="100%" height="8" rx="4" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect x="0%"  y="0" width="10%" height="8" fill="rgba(6,78,59,0.35)"   />
            <rect x="10%" y="0" width="15%" height="8" fill="rgba(120,53,15,0.35)" />
            <rect x="25%" y="0" width="25%" height="8" fill="rgba(127,29,29,0.35)" />
            <rect x="50%" y="0" width="50%" height="8" fill="rgba(69,10,10,0.35)"  />
            <rect x="0"   y="0" width={`${capped}%`} height="8" fill={style.arcColor} opacity="0.82" className="transition-all duration-700" />
            <rect x="10%" y="0" width="1.5" height="8" fill="rgba(11,25,41,0.9)" />
            <rect x="25%" y="0" width="1.5" height="8" fill="rgba(11,25,41,0.9)" />
            <rect x="50%" y="0" width="1.5" height="8" fill="rgba(11,25,41,0.9)" />
          </g>
        </svg>

        {/* Tick labels */}
        <div className="relative mt-1 h-3">
          <span className="absolute left-0 text-[9px] text-slate-600">0</span>
          <span className="absolute left-[10%] text-[9px] text-slate-600">10</span>
          <span className="absolute left-[25%] text-[9px] text-slate-600">25</span>
          <span className="absolute left-[50%] text-[9px] text-slate-600">50</span>
          <span className="absolute right-0 text-[9px] text-slate-600">100%</span>
        </div>
      </div>
    </div>
  );
}