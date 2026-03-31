// FILE: frontend/components/timepoint-risks-panel.tsx
"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import clsx from "clsx";
import { TIMEPOINTS, TP_LABELS } from "@/lib/series";
import type { TimepointRisks } from "@/lib/types";
import type { Timepoint } from "@/lib/series";

// =============================================================================
// Helpers
// =============================================================================

function riskNumberColor(cat: string): string {
  switch (cat) {
    case "low":       return "text-emerald-400";
    case "medium":    return "text-amber-400";
    case "high":      return "text-red-400";
    case "very_high": return "text-rose-400";
    default:          return "text-slate-300";
  }
}

function riskBadge(cat: string): string {
  switch (cat) {
    case "low":       return "bg-emerald-950/50 text-emerald-300 border-emerald-800/40";
    case "medium":    return "bg-amber-950/50 text-amber-300 border-amber-800/40";
    case "high":      return "bg-red-950/50 text-red-300 border-red-800/40";
    case "very_high": return "bg-rose-950/50 text-rose-300 border-rose-800/40";
    default:          return "bg-slate-800/50 text-slate-300 border-slate-700";
  }
}

function shortCat(cat: string): string {
  switch (cat) {
    case "low":       return "Low";
    case "medium":    return "Med";
    case "high":      return "High";
    case "very_high": return "V.High";
    default:          return cat;
  }
}

// =============================================================================
// Props
// =============================================================================

interface TimepointRisksPanelProps {
  timepointRisks: TimepointRisks;
  selectedTp:     Timepoint | null;
  onSelectTp:     (tp: Timepoint) => void;
}

// =============================================================================
// Component
// =============================================================================

export default function TimepointRisksPanel({
  timepointRisks,
  selectedTp,
  onSelectTp,
}: TimepointRisksPanelProps) {
  const activeTimepoints = TIMEPOINTS.filter((tp) => timepointRisks[tp] != null);
  if (activeTimepoints.length === 0) return null;

  const baselineResult = timepointRisks["baseline"];

  return (
    <div className="card overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[#1a3a57]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#152e47]">
          <svg className="h-3.5 w-3.5 text-teal-400" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-white">Risk Timeline</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-500">
          {selectedTp ? `@ ${TP_LABELS[selectedTp]}` : "Select timepoint"}
        </span>
      </div>

      {/* Rows — all rows are clickable selectors */}
      <div className="divide-y divide-[#1a3a57]">
        {activeTimepoints.map((tp) => {
          const res        = timepointRisks[tp]!;
          const isBaseline = tp === "baseline";
          const isSelected = tp === selectedTp;

          const delta = baselineResult && !isBaseline
            ? res.risk_result.risk_percent - baselineResult.risk_result.risk_percent
            : null;

          const isImproved = delta !== null && delta < -0.5;
          const isWorsened = delta !== null && delta > 0.5;

          return (
            <button
              key={tp}
              type="button"
              onClick={() => onSelectTp(tp)}
              className={clsx(
                "w-full flex items-center gap-3 pl-3 pr-4 py-3 text-left transition-all duration-150 cursor-pointer border-l-2",
                isSelected
                  ? "border-l-teal-500 bg-teal-950/30"
                  : isBaseline
                    ? "border-l-transparent bg-[#0d2035]/50 hover:border-l-teal-800/60 hover:bg-[#0d2035]/80"
                    : "border-l-transparent hover:border-l-teal-800/40 hover:bg-[#0d2035]/50",
              )}
            >
              {/* Selection indicator dot */}
              <div className="w-2 flex-shrink-0 flex justify-center">
                {isSelected
                  ? <div className="h-2.5 w-2.5 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.7)]" />
                  : isBaseline
                    ? <div className="h-2 w-2 rounded-full bg-blue-600/50" />
                    : <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />}
              </div>

              {/* Timepoint label */}
              <div className="w-[56px] flex-shrink-0">
                <p className={clsx(
                  "text-xs font-semibold leading-none",
                  isSelected  ? "text-teal-200"
                  : isBaseline ? "text-blue-400"
                  :              "text-slate-400 group-hover:text-slate-200",
                )}>
                  {TP_LABELS[tp]}
                </p>
                {isBaseline && (
                  <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-600">
                    Reference
                  </p>
                )}
              </div>

              {/* Risk % */}
              <span className={clsx(
                "w-[52px] flex-shrink-0 text-right font-mono text-base font-bold tabular-nums leading-none",
                riskNumberColor(res.risk_result.category),
              )}>
                {res.risk_result.risk_percent.toFixed(1)}%
              </span>

              {/* Category badge — short label to avoid overflow */}
              <span className={clsx(
                "flex-shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                riskBadge(res.risk_result.category),
              )}>
                {shortCat(res.risk_result.category)}
              </span>

              {/* Delta vs baseline */}
              <div className="ml-auto flex-shrink-0 flex items-center gap-1 justify-end min-w-[72px]">
                {isBaseline ? (
                  <span className="text-[10px] text-slate-600">&mdash;</span>
                ) : delta !== null ? (
                  <>
                    {isImproved ? (
                      <TrendingDown className="h-3 w-3 flex-shrink-0 text-emerald-400" />
                    ) : isWorsened ? (
                      <TrendingUp className="h-3 w-3 flex-shrink-0 text-red-400" />
                    ) : (
                      <Minus className="h-3 w-3 flex-shrink-0 text-slate-500" />
                    )}
                    <span className={clsx(
                      "font-mono text-xs font-bold tabular-nums",
                      isImproved ? "text-emerald-400"
                      : isWorsened ? "text-red-400"
                      : "text-slate-500",
                    )}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)} pp
                    </span>
                  </>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="border-t border-[#1a3a57] px-5 py-2 bg-[#07111e]/50">
        <p className="text-[10px] text-slate-600">
          Click a row to select &middot; All deltas vs Baseline &middot; pp = percentage points
        </p>
      </div>
    </div>
  );
}
