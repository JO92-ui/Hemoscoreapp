// FILE: frontend/components/baseline-review.tsx
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ClipboardList, RotateCcw } from "lucide-react";
import clsx from "clsx";
import type { BaselineSnapshot, RiskCategory } from "@/lib/types";
import { HEMO_VARS, VAR_META } from "@/lib/series";

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

function riskColor(category: RiskCategory | string): string {
  switch (category) {
    case "low":       return "text-emerald-400";
    case "medium":    return "text-amber-400";
    case "high":      return "text-red-400";
    case "very_high": return "text-rose-400";
    default:          return "text-slate-300";
  }
}

/** Human-readable labels for clinical features. */
const CLINICAL_LABELS: Record<string, string> = {
  base_age_years:                 "Age (yrs)",
  base_sex_female:                "Sex",
  base_diabetes:                  "Diabetes",
  base_hypertension:              "Hypertension",
  base_cs_etiology:               "CS Aetiology",
  base_creatinine:                "Creatinine (mg/dL)",
  base_iabp:                      "IABP",
  base_impella:                   "Impella",
  base_ecmo:                      "ECMO",
  base_ventilation:               "Ventilation",
  base_renal_replacement_therapy: "Renal Replacement",
};

const SEX:  Record<number, string> = { 0: "Male",   1: "Female" };
const YESNO: Record<number, string> = { 0: "No",     1: "Yes"    };
const ETIO: Record<number, string> = { 1: "AMI-CS", 2: "HF-CS"  };
const VENT: Record<number, string> = { 0: "None",   1: "NIV", 2: "IMV" };

const YESNO_KEYS = new Set([
  "base_diabetes", "base_hypertension",
  "base_iabp", "base_impella", "base_ecmo",
  "base_renal_replacement_therapy",
]);

function formatClinical(key: string, val: number): string {
  if (key === "base_sex_female")  return SEX[val]  ?? String(val);
  if (key === "base_cs_etiology") return ETIO[val] ?? String(val);
  if (key === "base_ventilation") return VENT[val] ?? String(val);
  if (YESNO_KEYS.has(key))        return YESNO[val] ?? String(val);
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}

// =============================================================================
// Props
// =============================================================================

interface BaselineReviewProps {
  baseline: BaselineSnapshot;
  onClear:  () => void;
}

// =============================================================================
// Component
// =============================================================================

export default function BaselineReview({ baseline, onClear }: BaselineReviewProps) {
  const [open, setOpen] = useState(false);
  const raw = baseline.rawInputs;

  const hemoRows = HEMO_VARS.map((v) => ({
    key:   v,
    label: VAR_META[v].label,
    unit:  VAR_META[v].unit,
    value: raw?.seriesBaseline?.[v] ?? null,
  }));

  const clinicalRows = Object.entries(CLINICAL_LABELS)
    .map(([key, label]) => ({ key, label, value: raw?.clinical?.[key] ?? null }))
    .filter((r) => r.value !== null);

  return (
    <div className="card overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-[#152e47]"
      >
        <div className="flex items-center gap-2.5">
          <ClipboardList className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <div>
            <span className="text-sm font-semibold text-white leading-none">Review Baseline</span>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Captured {formatTs(baseline.savedAt)}
            </p>
          </div>
        </div>
        {open
          ? <ChevronUp   className="h-4 w-4 text-slate-500" />
          : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {open && (
        <div className="border-t border-[#1a3a57] px-5 py-4 space-y-4">

          {/* Baseline risk summary */}
          <div className="rounded-xl border border-[#1a3a57] bg-[#081524] px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500">Baseline Risk</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{baseline.risk.label}</p>
            </div>
            <span className={clsx("text-xl font-bold tabular-nums", riskColor(baseline.risk.category))}>
              {baseline.risk.risk_percent.toFixed(1)}%
            </span>
          </div>

          {/* Haemodynamic values at capture */}
          {raw && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-widest font-semibold text-slate-500">
                Haemodynamics (baseline timepoint)
              </p>
              <div className="rounded-xl border border-[#1a3a57] overflow-hidden divide-y divide-[#1a3a57]">
                {hemoRows.map(({ key, label, unit, value }) => (
                  <div key={key} className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-xs text-slate-400">
                      {label}
                      {unit && <span className="text-slate-600"> ({unit})</span>}
                    </span>
                    <span className={clsx(
                      "text-xs font-mono tabular-nums",
                      value == null ? "text-slate-600" : "text-slate-200",
                    )}>
                      {value != null ? value.toFixed(2) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinical inputs at capture */}
          {clinicalRows.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-widest font-semibold text-slate-500">
                Clinical Inputs
              </p>
              <div className="rounded-xl border border-[#1a3a57] overflow-hidden divide-y divide-[#1a3a57]">
                {clinicalRows.map(({ key, label, value }) => (
                  <div key={key} className="flex items-center justify-between px-3.5 py-2">
                    <span className="text-xs text-slate-400">{label}</span>
                    <span className="text-xs font-mono tabular-nums text-slate-200">
                      {formatClinical(key, value!)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset button */}
          <button
            type="button"
            onClick={onClear}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-800/40 bg-red-950/20 px-4 py-2.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-950/40 hover:border-red-700/50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Baseline
          </button>

        </div>
      )}
    </div>
  );
}
