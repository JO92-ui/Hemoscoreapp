// FILE: frontend/components/input-panel.tsx
"use client";

import { useState, useMemo } from "react";
import {
  FlaskConical,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Zap,
  Loader2,
  HelpCircle,
} from "lucide-react";
import clsx from "clsx";
import type { MetadataResponse } from "@/lib/types";
import { CLINICAL_FEATURE_NAMES } from "@/lib/series";

// =============================================================================
// Static enrichment catalog — CLINICAL features only (14 fixed inputs).
// Haemodynamic variables (current/delta/TOT-hours) are handled by SeriesPanel.
// =============================================================================

interface FieldEnrichment {
  label: string;
  unit?: string;
  group: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: number; label: string }[];
}

const ENRICHMENT: Record<string, FieldEnrichment> = {
  // -- Patient baseline -------------------------------------------------------
  base_age_years:    { label: "Age",          unit: "yrs",   group: "Patient", min: 18,  max: 110, step: 1,   help: "Patient age in years" },
  base_sex_female:   { label: "Sex",          unit: "",      group: "Patient", options: [{ value: 0, label: "Male" }, { value: 1, label: "Female" }] },
  base_diabetes:     { label: "Diabetes",     unit: "",      group: "Patient", options: [{ value: 0, label: "No" },   { value: 1, label: "Yes"    }] },
  base_hypertension: { label: "Hypertension", unit: "",      group: "Patient", options: [{ value: 0, label: "No" },   { value: 1, label: "Yes"    }] },
  base_cs_etiology:  {
    label: "CS Aetiology", unit: "", group: "Patient",
    help: "Underlying aetiology of cardiogenic shock",
    options: [
      { value: 1, label: "AMI-CS" },
      { value: 2, label: "HF-CS" },
    ],
  },
  base_creatinine:   { label: "Creatinine",   unit: "mg/dL", group: "Patient", min: 0.3, max: 20, step: 0.1 },
  // -- Support devices --------------------------------------------------------
  base_iabp:       { label: "IABP",    unit: "", group: "Support", options: [{ value: 0, label: "No" }, { value: 1, label: "Yes" }] },
  base_impella:    { label: "Impella", unit: "", group: "Support", options: [{ value: 0, label: "No" }, { value: 1, label: "Yes" }] },
  base_ecmo:       { label: "ECMO",    unit: "", group: "Support", options: [{ value: 0, label: "No" }, { value: 1, label: "Yes" }] },
  base_ventilation: {
    label: "Ventilation", unit: "", group: "Support",
    options: [
      { value: 0, label: "None"  },
      { value: 1, label: "NIV"   },
      { value: 2, label: "IMV"   },
    ],
  },
  base_renal_replacement_therapy: {
    label: "Renal Replacement", unit: "", group: "Support",
    options: [{ value: 0, label: "No" }, { value: 1, label: "Yes" }],
  },
};

// Support is rendered inside SeriesPanel (clinical flow: SCAI → Support → Hemo)
const GROUP_ORDER = ["Patient"];

const DEFAULT_OPEN: Record<string, boolean> = {
  Patient: true,
};

// =============================================================================
// Toggle button group — replaces <select> for all option-based fields
// =============================================================================

function ToggleGroup({
  name,
  options,
  value,
  onChange,
}: {
  name:    string;
  options: { value: number; label: string }[];
  value:   number | null | undefined;
  onChange: (field: string, v: number | null) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-[#1a3a57] divide-x divide-[#1a3a57]">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(name, active ? null : opt.value)}
            className={clsx(
              "flex-1 py-2 text-xs font-semibold transition-colors duration-100 leading-none",
              active
                ? "bg-teal-700/40 text-teal-200 border-teal-600/40"
                : "bg-[#07111e] text-slate-500 hover:bg-[#0f2236] hover:text-slate-300",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// Derived field type from metadata
// =============================================================================

type FieldType = "continuous" | "binary" | "ordinal";

function resolveType(name: string, metadata: MetadataResponse | null): FieldType {
  if (!metadata) {
    const e = ENRICHMENT[name];
    if (e?.options) return e.options.length === 2 ? "binary" : "ordinal";
    return "continuous";
  }
  if (metadata.binary_vars.includes(name))  return "binary";
  if (metadata.ordinal_vars.includes(name)) return "ordinal";
  // If the backend doesn't classify the field but ENRICHMENT defines options, use them
  const e = ENRICHMENT[name];
  if (e?.options) return e.options.length === 2 ? "binary" : "ordinal";
  return "continuous";
}

// =============================================================================
// Tooltip sub-component
// =============================================================================

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-slate-600 hover:text-slate-400 transition-colors"
        aria-label="More info"
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-48 rounded-lg border border-[#1a3a57] bg-[#0b1929] px-2.5 py-2 text-[11px] text-slate-300 shadow-xl leading-snug pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

// =============================================================================
// FieldInput — renders one input control
// =============================================================================

function FieldInput({
  name,
  metadata,
  value,
  imputation,
  onChange,
}: {
  name: string;
  metadata: MetadataResponse | null;
  value: number | null | undefined;
  imputation: number | undefined;
  onChange: (field: string, v: number | null) => void;
}) {
  const enrich  = ENRICHMENT[name] ?? { label: name, group: "Other" };
  const type    = resolveType(name, metadata);
  const options = enrich.options;

  const imputedStr = imputation != null
    ? `default ${Number.isInteger(imputation) ? imputation : imputation.toFixed(2)}`
    : "auto";

  const labelEl = (
    <label htmlFor={name} className="field-label flex items-center gap-1">
      {enrich.label}
      {enrich.unit && (
        <span className="normal-case font-normal text-slate-600">({enrich.unit})</span>
      )}
      {enrich.help && <Tooltip text={enrich.help} />}
    </label>
  );

  if ((type === "binary" || type === "ordinal") && options) {
    return (
      <div>
        {labelEl}
        <ToggleGroup name={name} options={options} value={value} onChange={onChange} />
      </div>
    );
  }

  return (
    <div>
      {labelEl}
      <input
        id={name}
        type="number"
        className="field-input"
        min={enrich.min}
        max={enrich.max}
        step={enrich.step ?? 0.1}
        placeholder={imputedStr}
        value={value != null ? String(value) : ""}
        onChange={(e) => onChange(name, e.target.value === "" ? null : Number(e.target.value))}
      />
    </div>
  );
}

// =============================================================================
// GroupSection — collapsible clinical field group
// =============================================================================

function GroupSection({
  name,
  fields,
  metadata,
  inputs,
  imputation,
  onChange,
}: {
  name: string;
  fields: string[];
  metadata: MetadataResponse | null;
  inputs: Record<string, number | null>;
  imputation: Record<string, number>;
  onChange: (f: string, v: number | null) => void;
}) {
  const [open, setOpen] = useState(DEFAULT_OPEN[name] ?? false);
  const filled = fields.filter((f) => inputs[f] != null).length;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-[#152e47]"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {name}
          </span>
          {filled > 0 && (
            <span className="rounded-full bg-blue-900/50 px-2 py-0.5 text-[10px] font-medium text-blue-400">
              {filled}/{fields.length}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp   className="h-4 w-4 text-slate-500" />
          : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>

      {open && (
        <div className="border-t border-[#1a3a57] px-5 pb-5 pt-3 grid grid-cols-2 gap-x-4 gap-y-3.5">
          {fields.map((f) => (
            <FieldInput
              key={f}
              name={f}
              metadata={metadata}
              value={inputs[f]}
              imputation={imputation[f]}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Props
// =============================================================================

interface InputPanelProps {
  metadata:      MetadataResponse | null;
  clinicalInputs: Record<string, number | null>;
  loadingAction: "predict" | "compare" | "testcase" | null;
  hasResult:     boolean;
  onClinicalChange:  (field: string, value: number | null) => void;
  onCalculateRisk:   () => void;
  onLoadTestCase:    () => void;
  onReset:           () => void;
}

// =============================================================================
// Main component
// =============================================================================

export default function InputPanel({
  metadata,
  clinicalInputs,
  loadingAction,
  hasResult,
  onClinicalChange,
  onCalculateRisk,
  onLoadTestCase,
  onReset,
}: InputPanelProps) {
  const isLoading = loadingAction !== null;

  // Only show clinical features (14 fixed inputs)
  const clinicalFeatureList = useMemo<string[]>(
    () => (metadata
      ? metadata.features.filter((f) => (CLINICAL_FEATURE_NAMES as readonly string[]).includes(f))
      : Array.from(CLINICAL_FEATURE_NAMES)),
    [metadata],
  );

  const groups = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const feat of clinicalFeatureList) {
      const group = ENRICHMENT[feat]?.group ?? "Other";
      if (!map[group]) map[group] = [];
      map[group].push(feat);
    }
    const ordered = GROUP_ORDER.filter((g) => map[g]).map((g) => ({ name: g, fields: map[g] }));
    if (map["Other"]) ordered.push({ name: "Other", fields: map["Other"] });
    return ordered;
  }, [clinicalFeatureList]);

  const imputation    = metadata?.imputation_defaults ?? {};
  const filledCount   = Object.values(clinicalInputs).filter((v) => v != null).length;
  const totalClinical = CLINICAL_FEATURE_NAMES.length; // 11

  return (
    <div className="space-y-3">

      {/* -- Sticky action card ----------------------------------------------- */}
      <div className="card p-5 space-y-3 sticky top-20 z-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white leading-none">Clinical Inputs</h3>
            <p className="mt-1 text-[11px] text-slate-500">
              {filledCount > 0
                ? `${filledCount} / ${totalClinical} clinical fields filled`
                : `All ${totalClinical} clinical fields optional — blanks use population medians`}
            </p>
          </div>
          {totalClinical > 0 && (
            <div className="relative h-8 w-8 flex-shrink-0">
              <svg viewBox="0 0 32 32" className="h-8 w-8 -rotate-90">
                <circle cx="16" cy="16" r="14" fill="none" stroke="#1a3a57" strokeWidth="3" />
                <circle
                  cx="16" cy="16" r="14" fill="none"
                  stroke="#3b82f6" strokeWidth="3"
                  strokeDasharray={`${(filledCount / totalClinical) * 88} 88`}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-blue-400">
                {Math.round((filledCount / totalClinical) * 100)}
              </span>
            </div>
          )}
        </div>

        {/* Primary: Calculate Risk */}
        <button
          type="button"
          onClick={onCalculateRisk}
          disabled={isLoading}
          className={clsx(
            "btn-primary w-full justify-center text-sm",
            isLoading && (loadingAction === "predict" || loadingAction === "compare") ? "opacity-80" : "",
            isLoading && loadingAction === "testcase" ? "opacity-50 cursor-not-allowed" : "",
          )}
        >
          {loadingAction === "predict"
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Calculating…</>
            : loadingAction === "compare"
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Comparing…</>
            : <><Zap className="h-4 w-4" /> Calculate Risk</>}
        </button>

        {/* Utility row */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onLoadTestCase}
            disabled={isLoading}
            className={clsx(
              "btn-secondary justify-center text-xs py-2",
              isLoading && "opacity-50 cursor-not-allowed",
            )}
          >
            {loadingAction === "testcase"
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <FlaskConical className="h-3.5 w-3.5" />}
            Test Case
          </button>

          <button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            className={clsx(
              "btn-secondary justify-center text-xs py-2",
              isLoading && "opacity-50 cursor-not-allowed",
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>

      </div>

      {/* -- Clinical field groups -------------------------------------------- */}
      {groups.map((g) => (
        <GroupSection
          key={g.name}
          name={g.name}
          fields={g.fields}
          metadata={metadata}
          inputs={clinicalInputs}
          imputation={imputation}
          onChange={onClinicalChange}
        />
      ))}
    </div>
  );
}