// FILE: frontend/components/result-panel.tsx
"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Info,
} from "lucide-react";
import clsx from "clsx";
import RiskGauge from "@/components/risk-gauge";
import type {
  PredictResponse,
  RiskCategory,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function catTextCls(cat: RiskCategory): string {
  switch (cat) {
    case "low":       return "text-emerald-400";
    case "medium":    return "text-amber-400";
    case "high":      return "text-red-400";
    case "very_high": return "text-rose-400";
    default:          return "text-slate-300";
  }
}

function catBadgeCls(cat: RiskCategory): string {
  switch (cat) {
    case "low":       return "bg-emerald-950/50 border-emerald-800/60 text-emerald-300";
    case "medium":    return "bg-amber-950/50   border-amber-800/60   text-amber-300";
    case "high":      return "bg-red-950/50     border-red-800/60     text-red-300";
    case "very_high": return "bg-rose-950/60    border-rose-800/70    text-rose-300";
    default:          return "bg-slate-800      border-slate-700      text-slate-300";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Small sub-components
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1a3a57] last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={clsx("text-xs font-medium text-slate-200", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}

function ImputedFieldsRow({ fields }: { fields: string[] }) {
  if (fields.length === 0) return null;
  return (
    <div className="rounded-lg border border-[#1a3a57] bg-[#081524] p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <Database className="h-3 w-3" />
        Imputed fields ({fields.length})
      </p>
      <div className="flex flex-wrap gap-1">
        {fields.map((f) => (
          <span key={f} className="rounded bg-[#152e47] px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

function OutOfRangeRow({ fields }: { fields: string[] }) {
  if (fields.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
            Out-of-range ({fields.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {fields.map((f) => (
              <span key={f} className="rounded bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-mono text-amber-300/80">
                {f}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-amber-300/60">
            Original values were used — no clipping applied.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Model explanation disclaimer (collapsible)
// ─────────────────────────────────────────────────────────────────────────────

function ExplanationDisclaimer({
  method,
  disclaimer,
  note,
}: {
  method:     string;
  disclaimer: string;
  note:       string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-blue-900/30 bg-blue-950/15">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-blue-950/25"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Info className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
          <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-blue-400">
            Model explanation proxy · {method}
          </span>
        </div>
        {open
          ? <ChevronUp   className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
          : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" />}
      </button>

      {open && (
        <div className="space-y-2 border-t border-blue-900/30 px-3 pb-3 pt-2.5">
          <p className="text-[11px] leading-relaxed text-blue-300/75">
            <strong className="font-semibold text-blue-300">
              This is a non-causal heuristic interpretation.
            </strong>{" "}
            {disclaimer}
          </p>
          <p className="text-[11px] leading-relaxed text-slate-500">{note}</p>
          <p className="border-t border-blue-900/20 pt-2 text-[10px] leading-relaxed text-slate-600">
            <strong className="text-slate-500">Clinical use disclaimer — </strong>
            This tool is intended for research and educational purposes only. Risk estimates
            derive from historical cohort data and must not replace individualised clinical
            assessment, guideline-based care, or specialist consultation. External validation
            in independent cohorts is required before clinical deployment.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top factors — collapsible, closed by default
// ─────────────────────────────────────────────────────────────────────────────

type ExplanationType = NonNullable<PredictResponse["explanation"]>;

function TopFactorsSection({ explanation }: { explanation: ExplanationType }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-[#1a3a57] bg-[#081524]">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-[#0f2236]"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Key Drivers
        </span>
        {open
          ? <ChevronUp   className="h-3.5 w-3.5 text-slate-500" />
          : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
      </button>

      {open && (
        <div className="border-t border-[#1a3a57] p-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {explanation.top_increasing.length > 0 && (
            <div className="rounded-lg border border-red-900/30 bg-red-950/10 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                ↑ Risk-increasing
              </p>
              <ul className="space-y-1.5">
                {explanation.top_increasing.slice(0, 4).map((c) => (
                  <li key={c.feature} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-mono text-slate-300">{c.feature}</span>
                    <span className="flex-shrink-0 text-[11px] font-semibold tabular-nums text-red-400">
                      +{(c.delta_probability * 100).toFixed(1)} pp
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {explanation.top_decreasing.length > 0 && (
            <div className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                ↓ Risk-decreasing
              </p>
              <ul className="space-y-1.5">
                {explanation.top_decreasing.slice(0, 4).map((c) => (
                  <li key={c.feature} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-mono text-slate-300">{c.feature}</span>
                    <span className="flex-shrink-0 text-[11px] font-semibold tabular-nums text-emerald-400">
                      {(c.delta_probability * 100).toFixed(1)} pp
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface ResultPanelProps {
  result:           PredictResponse;
  timepointLabel?:  string;
}

export default function ResultPanel({
  result,
  timepointLabel,
}: ResultPanelProps) {
  const {
    risk_result,
    imputed_fields,
    out_of_range_fields,
    explanation,
    timestamp,
    model_name,
    probability,
  } = result;

  return (
    <div className="card animate-slide-up space-y-5 p-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">
            Risk Assessment
            {timepointLabel && (
              <>
                <span className="mx-2 text-slate-600">&mdash;</span>
                <span className="text-teal-300">{timepointLabel}</span>
              </>
            )}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Clock className="h-3 w-3" />
            {fmtTs(timestamp)}
          </p>
        </div>
        <span
          className={clsx(
            "badge border px-3 py-1 text-[11px] font-semibold",
            catBadgeCls(risk_result.category),
          )}
        >
          {risk_result.category.replace("_", " ").toUpperCase()}
        </span>
      </div>

      {/* Gauge + details grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 items-start">
        <div className="flex justify-center">
          <RiskGauge
            riskPercent={risk_result.risk_percent}
            category={risk_result.category}
            label={risk_result.label}
            size="lg"
          />
        </div>
        <div className="space-y-0">
          <InfoRow
            label="Probability"
            value={
              <span className={catTextCls(risk_result.category)}>
                {(probability * 100).toFixed(2)}%
              </span>
            }
          />
          <InfoRow label="Risk tier"    value={risk_result.label} />
          <InfoRow label="Model"        value={model_name} mono />
          <InfoRow label="Imputed"      value={`${imputed_fields.length} / 32`} />
          <InfoRow
            label="Out of range"
            value={
              out_of_range_fields.length > 0 ? (
                <span className="text-amber-400">{out_of_range_fields.length} field(s)</span>
              ) : (
                <span className="text-emerald-400">None</span>
              )
            }
          />
        </div>
      </div>

      {/* Warnings */}
      {(imputed_fields.length > 0 || out_of_range_fields.length > 0) && (
        <div className="space-y-2">
          <ImputedFieldsRow fields={imputed_fields} />
          <OutOfRangeRow    fields={out_of_range_fields} />
        </div>
      )}

      {/* Top factors — collapsible, closed by default */}
      {explanation && (explanation.top_increasing.length > 0 || explanation.top_decreasing.length > 0) && (
        <TopFactorsSection explanation={explanation} />
      )}

      {/* Model explanation disclaimer */}
      {explanation && explanation.explanation_disclaimer && (
        <ExplanationDisclaimer
          method={explanation.explanation_method}
          disclaimer={explanation.explanation_disclaimer}
          note={explanation.interpretation_note}
        />
      )}
    </div>
  );
}