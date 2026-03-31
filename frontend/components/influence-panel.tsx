// FILE: frontend/components/influence-panel.tsx
"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Info,
  Minus,
} from "lucide-react";
import clsx from "clsx";
import type { Direction, ExplanationResult, FeatureContribution } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function DirectionIcon({ direction }: { direction: Direction }) {
  switch (direction) {
    case "up":   return <ArrowUp   className="h-3 w-3 text-red-400" />;
    case "down": return <ArrowDown className="h-3 w-3 text-emerald-400" />;
    default:     return <Minus     className="h-3 w-3 text-slate-500" />;
  }
}

function directionCls(d: Direction): string {
  switch (d) {
    case "up":   return "text-red-400";
    case "down": return "text-emerald-400";
    default:     return "text-slate-500";
  }
}

// Proportional bar fill — SVG rect uses presentation attribute width, not CSS inline style
function BarFill({ delta, max }: { delta: number; max: number }) {
  const pct       = max === 0 ? 0 : Math.min(Math.abs(delta) / max, 1) * 100;
  const isUp      = delta > 0;
  const fillColor = isUp ? "rgba(239,68,68,0.7)" : "rgba(34,197,94,0.7)";
  return (
    <svg width="100%" height="6" aria-hidden="true">
      <rect x="0" y="0" width="100%" height="6" rx="3" fill="rgba(26,58,87,1)" />
      <rect x="0" y="0" width={`${pct}%`} height="6" rx="3" fill={fillColor} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row component
// ─────────────────────────────────────────────────────────────────────────────

function ContributionRow({
  item,
  maxDelta,
  rank,
}: {
  item:     FeatureContribution;
  maxDelta: number;
  rank:     number;
}) {
  const pp   = item.delta_probability * 100;
  const sign = pp > 0 ? "+" : "";

  return (
    <div className="group grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[#152e47]">
      {/* Rank */}
      <span className="w-5 text-center text-[10px] tabular-nums text-slate-600">{rank}</span>

      {/* Feature name + bars */}
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-1.5">
          <DirectionIcon direction={item.direction} />
          <span className="truncate text-[11px] font-mono text-slate-200">{item.feature}</span>
        </div>
        <BarFill delta={item.delta_probability} max={maxDelta} />
        <div className="mt-0.5 flex gap-3">
          <span className="text-[9px] text-slate-600">
            val <span className="font-mono text-slate-400">{item.patient_value}</span>
          </span>
          <span className="text-[9px] text-slate-600">
            ref <span className="font-mono text-slate-400">{item.reference_value.toFixed(2)}</span>
          </span>
        </div>
      </div>

      {/* Delta pp */}
      <span
        className={clsx(
          "flex-shrink-0 text-[11px] font-semibold tabular-nums",
          directionCls(item.direction),
        )}
      >
        {sign}{pp.toFixed(2)} pp
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic disclaimer banner
// ─────────────────────────────────────────────────────────────────────────────

function HeuristicBanner({
  method,
  disclaimer,
  note,
}: {
  method:     string;
  disclaimer: string;
  note:       string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-blue-900/30 bg-blue-950/15 overflow-hidden">
      {/* Always-visible pill */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Info className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
        <p className="flex-1 min-w-0 text-[11px] text-blue-300/80 leading-snug">
          <strong className="font-semibold text-blue-300">Model explanation proxy —</strong>{" "}
          non-causal heuristic · {method}
        </p>
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 hover:bg-blue-900/30 transition-colors"
          aria-label="Toggle full disclaimer"
        >
          {expanded ? "less" : "more"}
        </button>
      </div>

      {/* Expandable full text */}
      {expanded && (
        <div className="space-y-1.5 border-t border-blue-900/30 px-3 pb-3 pt-2 animate-fade-in">
          <p className="text-[11px] leading-relaxed text-blue-300/70">
            {disclaimer}
          </p>
          <p className="text-[11px] leading-relaxed text-slate-500">
            {note}
          </p>
          <p className="border-t border-blue-900/20 pt-2 text-[10px] leading-relaxed text-slate-600">
            <strong className="text-slate-500">This is a non-causal heuristic interpretation.</strong>{" "}
            Individual Conditional Expectation (ICE) based values indicate how the model output
            changes as a feature varies while holding others fixed at their observed values. These
            are approximations and do not imply biological or clinical causality. Feature importance
            rankings are model-specific and may not generalise to other datasets or populations.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="card flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#152e47]">
        <BarChart2 className="h-7 w-7 text-slate-500" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-400">No influence data</p>
        <p className="max-w-[240px] text-xs leading-relaxed text-slate-600">
          Run a prediction to see which variables most influence the risk estimate.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface InfluencePanelProps {
  explanation: ExplanationResult | null;
}

const PAGE_SIZE = 10;

export default function InfluencePanel({ explanation }: InfluencePanelProps) {
  const [showAll, setShowAll] = useState(false);

  if (!explanation || explanation.all_contributions.length === 0) {
    return <EmptyState />;
  }

  const sorted   = [...explanation.all_contributions].sort(
    (a, b) => Math.abs(b.delta_probability) - Math.abs(a.delta_probability),
  );
  const displayed = showAll ? sorted : sorted.slice(0, PAGE_SIZE);
  const maxDelta  = sorted.length > 0 ? Math.abs(sorted[0].delta_probability) : 1;

  return (
    <div className="card animate-slide-up space-y-4 p-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">Variable Influence</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {sorted.length} features ranked by absolute delta
          </p>
        </div>
        {explanation.baseline_probability != null && (
          <span className="flex-shrink-0 rounded-lg border border-[#1a3a57] bg-[#081524] px-2.5 py-1 text-[10px] text-slate-500">
            pop. baseline{" "}
            <span className="font-mono text-slate-400">
              {(explanation.baseline_probability * 100).toFixed(1)}%
            </span>
          </span>
        )}
      </div>

      {/* Heuristic disclaimer — always visible */}
      <HeuristicBanner
        method={explanation.explanation_method}
        disclaimer={explanation.explanation_disclaimer}
        note={explanation.interpretation_note}
      />

      {/* Column headers */}
      <div className="grid grid-cols-[1.5rem_1fr_auto] gap-3 px-3">
        <span className="text-[9px] uppercase tracking-widest text-slate-600">#</span>
        <span className="text-[9px] uppercase tracking-widest text-slate-600">Feature</span>
        <span className="text-[9px] uppercase tracking-widest text-slate-600">Δ pp</span>
      </div>

      {/* Contribution rows */}
      <div className="space-y-0.5">
        {displayed.map((item, idx) => (
          <ContributionRow
            key={item.feature}
            item={item}
            maxDelta={maxDelta}
            rank={idx + 1}
          />
        ))}
      </div>

      {/* Show more / less toggle */}
      {sorted.length > PAGE_SIZE && (
        <button
          type="button"
          onClick={() => setShowAll((p) => !p)}
          className="btn-ghost flex w-full items-center justify-center gap-1.5 text-xs"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show all {sorted.length} features
            </>
          )}
        </button>
      )}
    </div>
  );
}