// FILE: frontend/components/baseline-card.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  CheckCircle2,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";
import RiskGauge from "@/components/risk-gauge";
import type { BaselineSnapshot, RiskCategory, TimepointRisks } from "@/lib/types";
import type { Timepoint } from "@/lib/series";
import { TP_LABELS } from "@/lib/series";

// =============================================================================
// Helpers
// =============================================================================

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function secondsSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 1000;
}

function riskCategoryColor(cat: RiskCategory | string): string {
  switch (cat) {
    case "low":       return "text-emerald-400";
    case "medium":    return "text-amber-400";
    case "high":      return "text-red-400";
    case "very_high": return "text-rose-400";
    default:          return "text-slate-300";
  }
}

const CATEGORY_ORDER = ["low", "medium", "high", "very_high"] as const;

function catLabel(cat: string): string {
  switch (cat) {
    case "low":       return "Low";
    case "medium":    return "Medium";
    case "high":      return "High";
    case "very_high": return "Very High";
    default:          return cat;
  }
}

function deriveCategoryShift(from: string, to: string): string | null {
  const fi = CATEGORY_ORDER.indexOf(from as (typeof CATEGORY_ORDER)[number]);
  const ti = CATEGORY_ORDER.indexOf(to   as (typeof CATEGORY_ORDER)[number]);
  if (fi === -1 || ti === -1 || fi === ti) return null;
  return ti > fi ? `Up to ${catLabel(to)}` : `Down to ${catLabel(to)}`;
}

type LocalChangeLabel = "improved" | "worsened" | "unchanged";

interface ChangeStyle {
  icon:      React.ReactNode;
  text:      string;
  bg:        string;
  border:    string;
  textColor: string;
}

function getChangeStyle(cl: LocalChangeLabel): ChangeStyle {
  switch (cl) {
    case "improved":
      return {
        icon:      <TrendingDown className="h-4 w-4" />,
        text:      "Improved",
        bg:        "bg-emerald-950/40",
        border:    "border-emerald-800/50",
        textColor: "text-emerald-400",
      };
    case "worsened":
      return {
        icon:      <TrendingUp className="h-4 w-4" />,
        text:      "Worsened",
        bg:        "bg-red-950/40",
        border:    "border-red-800/50",
        textColor: "text-red-400",
      };
    default:
      return {
        icon:      <Minus className="h-4 w-4" />,
        text:      "Unchanged",
        bg:        "bg-slate-800/40",
        border:    "border-slate-700",
        textColor: "text-slate-400",
      };
  }
}

// =============================================================================
// Delta stat cell
// =============================================================================

function DeltaStat({
  value,
  label,
  unit = "",
  negativeIsGood = false,
}: {
  value:          number | null;
  label:          string;
  unit?:          string;
  negativeIsGood?: boolean;
}) {
  if (value == null) {
    return (
      <div className="flex flex-col items-center gap-1 px-3">
        <span className="text-lg font-bold text-slate-600">&mdash;</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-600">{label}</span>
      </div>
    );
  }

  const positive = value > 0;
  const isGood   = negativeIsGood ? !positive : positive;
  const sign     = positive ? "+" : "";
  const colorCls =
    value === 0 ? "text-slate-400"
    : isGood    ? "text-emerald-400"
    :             "text-red-400";

  return (
    <div className="flex flex-col items-center gap-1 px-3">
      <span className={clsx("text-xl font-bold tabular-nums leading-none", colorCls)}>
        {sign}{value.toFixed(1)}{unit}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
}

// =============================================================================
// Props
// =============================================================================

interface BaselineCardProps {
  baseline:       BaselineSnapshot;
  timepointRisks: TimepointRisks;
  selectedTp:     Timepoint | null;
  onClear:        () => void;
}

// =============================================================================
// Main component
// =============================================================================

export default function BaselineCard({
  baseline,
  timepointRisks,
  selectedTp,
  onClear,
}: BaselineCardProps) {
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (secondsSince(baseline.savedAt) < 2) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [baseline.savedAt]);

  const baselineResult = timepointRisks["baseline"];
  const selectedResult = selectedTp ? timepointRisks[selectedTp] : null;

  // Compute comparison locally from timepointRisks — no API call needed
  const absoluteDelta =
    baselineResult && selectedResult
      ? selectedResult.risk_result.risk_percent - baselineResult.risk_result.risk_percent
      : null;

  const relativeDelta =
    absoluteDelta !== null && baselineResult && baselineResult.risk_result.risk_percent !== 0
      ? (absoluteDelta / baselineResult.risk_result.risk_percent) * 100
      : null;

  const changeLabel: LocalChangeLabel =
    absoluteDelta === null ? "unchanged"
    : absoluteDelta < -0.5 ? "improved"
    : absoluteDelta >  0.5 ? "worsened"
    :                        "unchanged";

  const categoryShift =
    baselineResult && selectedResult
      ? deriveCategoryShift(
          baselineResult.risk_result.category,
          selectedResult.risk_result.category,
        )
      : null;

  const change        = getChangeStyle(changeLabel);
  const selectedLabel = selectedTp ? TP_LABELS[selectedTp] : null;

  // Header shows the baseline risk (from timepointRisks if available, else from snapshot)
  const headerRisk = baselineResult ? baselineResult.risk_result : baseline.risk;

  return (
    <div
      className={clsx(
        "card animate-slide-up overflow-hidden transition-all duration-500",
        justSaved && "ring-2 ring-blue-500/40 shadow-glow",
      )}
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a3a57]">
        <div className="flex items-center gap-2.5">
          {justSaved ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <Bookmark className="h-4 w-4 text-blue-400 flex-shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white leading-none">
                Baseline Comparison
              </h3>
              {justSaved && (
                <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-[10px] font-medium text-emerald-400 animate-fade-in">
                  Saved &#10003;
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Saved {formatTs(baseline.savedAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span className={clsx("text-sm font-bold tabular-nums flex-shrink-0", riskCategoryColor(headerRisk.category))}>
            {headerRisk.risk_percent.toFixed(1)}%
          </span>
          <button onClick={onClear} className="btn-ghost p-1.5 flex-shrink-0" title="Clear baseline">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-5 space-y-5">
        {baselineResult && selectedResult ? (
          <>
            {/* Subtitle */}
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold text-center">
              Baseline &#8594; {selectedLabel}
            </p>

            {/* Gauge row */}
            <div className="flex items-end justify-center gap-3">
              {/* Baseline gauge */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-blue-400/70">Baseline</span>
                <RiskGauge
                  riskPercent={baselineResult.risk_result.risk_percent}
                  category={baselineResult.risk_result.category as RiskCategory}
                  label={catLabel(baselineResult.risk_result.category)}
                  size="sm"
                />
              </div>

              {/* Arrow + change badge */}
              <div className="flex flex-col items-center gap-2 mb-8 shrink-0">
                <ArrowRight className={clsx("h-7 w-7", change.textColor)} />
                <span
                  className={clsx(
                    "badge border flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                    change.bg, change.border, change.textColor,
                  )}
                >
                  {change.icon}
                  {change.text}
                </span>
              </div>

              {/* Selected timepoint gauge */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-teal-400/70">
                  {selectedLabel}
                </span>
                <RiskGauge
                  riskPercent={selectedResult.risk_result.risk_percent}
                  category={selectedResult.risk_result.category as RiskCategory}
                  label={catLabel(selectedResult.risk_result.category)}
                  size="sm"
                />
              </div>
            </div>

            {/* Delta stats */}
            <div className="grid grid-cols-3 divide-x divide-[#1a3a57] rounded-xl border border-[#1a3a57] bg-[#081524] py-3">
              <DeltaStat
                value={absoluteDelta}
                label="Delta abs."
                unit=" pp"
                negativeIsGood
              />
              <DeltaStat
                value={relativeDelta}
                label="Delta rel."
                unit="%"
                negativeIsGood
              />
              <div className="flex flex-col items-center justify-center gap-1 px-3 text-center">
                {categoryShift ? (
                  <>
                    <span className="text-[11px] font-semibold text-slate-200 leading-snug">
                      {categoryShift}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">
                      Reclassification
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium text-slate-500">&mdash;</span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-600">
                      No shift
                    </span>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          /* No timepointRisks yet or no baseline computed */
          <div className="flex items-center gap-5">
            <RiskGauge
              riskPercent={baseline.risk.risk_percent}
              category={baseline.risk.category as RiskCategory}
              label={baseline.risk.label}
              size="sm"
            />
            <p className="text-xs text-slate-500 leading-relaxed">
              Select a timepoint in the{" "}
              <span className="text-teal-400 font-medium">Risk Timeline</span>{" "}
              to compare against baseline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
