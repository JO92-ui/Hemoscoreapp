// FILE: frontend/components/series-panel.tsx
"use client";

import { useMemo } from "react";
import { Activity, Clock, TrendingDown, TrendingUp, Minus, Shield } from "lucide-react";
import clsx from "clsx";
import {
  HEMO_VARS,
  TIMEPOINTS,
  TP_LABELS,
  VAR_META,
  THRESHOLDS,
  computeAll,
  computeScaiDerived,
  getSupportAtTimepoint,
  type SeriesState,
  type ScaiValues,
  type SupportSeries,
  type SupportVar,
  type HemoVar,
  type Timepoint,
} from "@/lib/series";

// =============================================================================
// Support field UI metadata
// =============================================================================

const SUPPORT_FIELD_META: {
  sv: SupportVar;
  label: string;
  options: { value: number; label: string }[];
}[] = [
  { sv: "base_iabp",    label: "IABP",        options: [{value:0,label:"Off"},{value:1,label:"On"}] },
  { sv: "base_impella", label: "Impella",     options: [{value:0,label:"Off"},{value:1,label:"On"}] },
  { sv: "base_ecmo",    label: "ECMO",        options: [{value:0,label:"Off"},{value:1,label:"On"}] },
  { sv: "base_ventilation", label: "Ventil.", options: [{value:0,label:"No"},{value:1,label:"NIV"},{value:2,label:"IMV"}] },
  { sv: "base_renal_replacement_therapy", label: "Renal Repl.", options: [{value:0,label:"Off"},{value:1,label:"On"}] },
];

// =============================================================================
// Props
// =============================================================================

interface SeriesPanelProps {
  series:          SeriesState;
  scai:            ScaiValues;
  supportSeries:   SupportSeries;
  onChange:        (variable: HemoVar, timepoint: Timepoint, value: number | null) => void;
  onScaiChange:    (timepoint: Timepoint, value: number | null) => void;
  onSupportChange: (sv: SupportVar, timepoint: Timepoint, value: number | null) => void;
}

// =============================================================================
// DeltaBadge
// =============================================================================

function DeltaBadge({ delta, step }: { delta: number | null; step: number }) {
  if (delta === null) {
    return <span className="text-slate-700 text-xs">&#8211;</span>;
  }
  const decimals = step < 1 ? 2 : 0;
  const sign     = delta > 0 ? "+" : "";
  const colorCls =
    delta === 0 ? "text-slate-400"
    : delta > 0 ? "text-rose-400"
    :             "text-emerald-400";

  return (
    <span className={clsx("flex items-center justify-center gap-0.5 font-mono text-xs font-semibold", colorCls)}>
      {delta > 0
        ? <TrendingUp   className="h-2.5 w-2.5 flex-shrink-0" />
        : delta < 0
          ? <TrendingDown className="h-2.5 w-2.5 flex-shrink-0" />
          : <Minus        className="h-2.5 w-2.5 flex-shrink-0" />}
      {sign}{Math.abs(delta).toFixed(decimals)}
    </span>
  );
}

// =============================================================================
// SCAI options
// =============================================================================

const SCAI_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "A" },
  { value: 2, label: "B" },
  { value: 3, label: "C" },
  { value: 4, label: "D" },
  { value: 5, label: "E" },
];

// =============================================================================
// SeriesPanel
// =============================================================================

export default function SeriesPanel({
  series,
  scai,
  supportSeries,
  onChange,
  onScaiChange,
  onSupportChange,
}: SeriesPanelProps) {
  const derived     = useMemo(() => computeAll(series), [series]);
  const scaiDerived = useMemo(() => computeScaiDerived(scai), [scai]);

  return (
    <div className="card overflow-hidden">

      {/* ── 1. SCAI STAGING ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1a3a57] bg-[#07111e]/30">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          SCAI Staging
        </span>
        <span className="ml-auto text-[10px] text-slate-600">
          AUTO derives Admission · Max 48 h · Worsening
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[660px]">
          <thead>
            <tr className="border-b border-[#1a3a57]">
              <th className="sticky left-0 z-10 bg-[#0a1929] px-4 py-2 text-left w-[120px]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Stage</span>
              </th>
              {TIMEPOINTS.map((tp) => (
                <th key={tp} className="px-1.5 py-2 text-center w-[68px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {TP_LABELS[tp]}
                  </span>
                </th>
              ))}
              <th className="px-2 py-2 text-center w-[72px] border-l border-[#1e4060]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600/80">Adm.</span>
              </th>
              <th className="px-2 py-2 text-center w-[72px]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600/80">Max 48h</span>
              </th>
              <th className="px-2 py-2 text-center w-[72px]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600/80">Worsening</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-[#0d2035]/40 transition-colors group">
              <td className="sticky left-0 z-10 bg-[#0a1929] group-hover:bg-[#0d2035]/80 transition-colors px-4 py-3">
                <p className="text-xs font-semibold text-slate-200">SCAI</p>
                <p className="mt-1 text-[10px] text-slate-600">Stages A–E (1–5)</p>
              </td>
              {TIMEPOINTS.map((tp) => (
                <td key={tp} className="px-1.5 py-2.5 text-center">
                  <select
                    aria-label={`SCAI at ${TP_LABELS[tp]}`}
                    value={scai[tp] ?? ""}
                    onChange={(e) =>
                      onScaiChange(tp, e.target.value === "" ? null : Number(e.target.value))
                    }
                    className={clsx(
                      "w-full rounded-md border bg-[#07111e]",
                      "px-1 py-1.5 text-center text-[11px] font-mono text-slate-200",
                      "focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500",
                      "transition-colors duration-100 cursor-pointer",
                      scai[tp] !== null ? "border-[#1e5080]" : "border-[#0f2236]",
                    )}
                  >
                    <option value="">–</option>
                    {SCAI_OPTIONS.map((o) => (
                      <option key={o.value} value={String(o.value)}>{o.label}</option>
                    ))}
                  </select>
                </td>
              ))}
              <td className="px-2 py-2.5 text-center border-l border-[#1e4060] bg-[#07111e]/30">
                {scaiDerived.admission !== null ? (
                  <span className="font-mono text-xs font-bold text-teal-300">
                    {SCAI_OPTIONS.find(o => o.value === scaiDerived.admission)?.label ?? scaiDerived.admission}
                  </span>
                ) : <span className="text-slate-700 text-xs">–</span>}
              </td>
              <td className="px-2 py-2.5 text-center bg-[#07111e]/30">
                {scaiDerived.max48h !== null ? (
                  <span className="font-mono text-xs font-bold text-teal-300">
                    {SCAI_OPTIONS.find(o => o.value === scaiDerived.max48h)?.label ?? scaiDerived.max48h}
                  </span>
                ) : <span className="text-slate-700 text-xs">–</span>}
              </td>
              <td className="px-2 py-2.5 text-center bg-[#07111e]/30">
                {scaiDerived.worsening !== null ? (
                  <span className={clsx(
                    "font-mono text-xs font-bold",
                    scaiDerived.worsening === 0 ? "text-slate-400"
                    : scaiDerived.worsening === 1 ? "text-yellow-400"
                    : "text-rose-400",
                  )}>
                    {scaiDerived.worsening > 0 ? `+${scaiDerived.worsening}` : "0"}
                  </span>
                ) : <span className="text-slate-700 text-xs">–</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── 2. SUPPORT DEVICES (per-timepoint, sticky forward) ──────────── */}
      <div className="border-t-2 border-[#1e4060]">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[#1a3a57] bg-[#07111e]/30">
          <Shield className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Support Devices
          </span>
          <span className="ml-auto text-[10px] text-slate-600">
            Activation propagates forward automatically
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[660px]">
            <thead>
              <tr className="border-b border-[#1a3a57]">
                <th className="sticky left-0 z-10 bg-[#0a1929] px-4 py-2 text-left w-[120px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Device</span>
                </th>
                {TIMEPOINTS.map((tp) => (
                  <th key={tp} className="px-1.5 py-2 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {TP_LABELS[tp]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a3a57]">
              {SUPPORT_FIELD_META.map((f) => (
                <tr key={f.sv} className="hover:bg-[#0d2035]/40 transition-colors group">
                  <td className="sticky left-0 z-10 bg-[#0a1929] group-hover:bg-[#0d2035]/80 transition-colors px-4 py-2.5">
                    <p className="text-xs font-semibold text-slate-200">{f.label}</p>
                  </td>
                  {TIMEPOINTS.map((tp) => {
                    const explicit  = supportSeries[f.sv][tp];
                    const effective = getSupportAtTimepoint(supportSeries, f.sv, tp);
                    const isInherited = explicit === null && effective !== null;
                    const displayVal  = isInherited ? effective : explicit;
                    return (
                      <td key={tp} className="px-1.5 py-2 text-center">
                        <div className={clsx(
                          "flex rounded-md overflow-hidden border divide-x",
                          isInherited
                            ? "border-[#1a3a57]/40 divide-[#1a3a57]/40"
                            : "border-[#1a3a57] divide-[#1a3a57]",
                        )}>
                          {f.options.map((opt) => {
                            const isActive = displayVal === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  if (isInherited) {
                                    onSupportChange(f.sv, tp, opt.value);
                                  } else {
                                    onSupportChange(f.sv, tp, explicit === opt.value ? null : opt.value);
                                  }
                                }}
                                className={clsx(
                                  "flex-1 py-1.5 text-[10px] font-semibold transition-colors leading-none min-w-[26px]",
                                  isActive && !isInherited
                                    ? "bg-blue-700/50 text-blue-200"
                                    : isActive && isInherited
                                      ? "bg-blue-700/20 text-blue-400/60"
                                      : "bg-[#07111e] text-slate-600 hover:text-slate-300 hover:bg-[#0f2236]",
                                )}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. HAEMODYNAMIC SERIES ──────────────────────────────────────── */}
      <div className="border-t-2 border-[#1e4060]">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1a3a57] bg-[#07111e]/30">
          <Activity className="h-3.5 w-3.5 text-teal-400 flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Haemodynamic Series
          </span>
          <span className="ml-auto hidden sm:block text-[10px] text-slate-600">
            Values at each timepoint – AUTO derives Current · Delta · TOT-h
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[660px]">
            <thead>
              <tr className="border-b border-[#1a3a57]">
                <th className="sticky left-0 z-10 bg-[#0a1929] px-4 py-2.5 text-left w-[120px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Variable
                  </span>
                </th>
                {TIMEPOINTS.map((tp) => (
                  <th key={tp} className="px-1.5 py-2.5 text-center w-[68px]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {TP_LABELS[tp]}
                    </span>
                  </th>
                ))}
                <th className="px-2 py-2.5 text-center w-[64px] border-l border-[#1e4060]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600/80">
                    Current
                  </span>
                </th>
                <th className="px-2 py-2.5 text-center w-[58px]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600/80">
                    Delta
                  </span>
                </th>
                <th className="px-2 py-2.5 text-center w-[64px]">
                  <span className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600/80">
                    <Clock className="h-2.5 w-2.5" />TOT-h
                  </span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1a3a57]">
              {HEMO_VARS.map((v) => {
                const meta  = VAR_META[v];
                const thr   = THRESHOLDS[v];
                const d     = derived[v];
                const isOff =
                  d.current !== null &&
                  (thr.direction === "max"
                    ? d.current >= thr.value
                    : d.current < thr.value);

                return (
                  <tr key={v} className="hover:bg-[#0d2035]/40 transition-colors group">
                    <td className="sticky left-0 z-10 bg-[#0a1929] group-hover:bg-[#0d2035]/80 transition-colors px-4 py-3">
                      <p className={clsx(
                        "text-xs font-semibold leading-none",
                        isOff ? "text-rose-300" : "text-slate-200",
                      )}>
                        {meta.label}
                        {meta.unit && (
                          <span className="ml-1 font-normal text-slate-600">({meta.unit})</span>
                        )}
                      </p>
                      <p className="mt-1 text-[10px] leading-none text-slate-600">
                        {thr.goalLabel}
                      </p>
                    </td>
                    {TIMEPOINTS.map((tp) => (
                      <td key={tp} className="px-1.5 py-2.5 text-center">
                        <input
                          type="number"
                          aria-label={`${meta.label} at ${TP_LABELS[tp]}`}
                          min={meta.min}
                          max={meta.max}
                          step={meta.step}
                          value={series[v][tp] ?? ""}
                          onChange={(e) =>
                            onChange(v, tp, e.target.value === "" ? null : Number(e.target.value))
                          }
                          className={clsx(
                            "w-full rounded-md border bg-[#07111e]",
                            "px-1 py-1.5 text-center text-[11px] font-mono text-slate-200",
                            "placeholder:text-slate-700",
                            "focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500",
                            "transition-colors duration-100",
                            series[v][tp] !== null ? "border-[#1e5080]" : "border-[#0f2236]",
                          )}
                          placeholder="–"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2.5 text-center border-l border-[#1e4060] bg-[#07111e]/30">
                      {d.current !== null ? (
                        <span className={clsx(
                          "font-mono text-xs font-bold",
                          isOff ? "text-rose-300" : "text-teal-300",
                        )}>
                          {d.current.toFixed(meta.step < 1 ? 2 : 0)}
                        </span>
                      ) : (
                        <span className="text-slate-700 text-xs">–</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-center bg-[#07111e]/30">
                      <DeltaBadge delta={d.delta} step={meta.step} />
                    </td>
                    <td className="px-2 py-2.5 text-center bg-[#07111e]/30">
                      <span className={clsx(
                        "font-mono text-xs font-bold",
                        d.tot_hours === 0  ? "text-slate-600"
                        : d.tot_hours < 6  ? "text-yellow-400"
                        : d.tot_hours < 12 ? "text-amber-400"
                        :                    "text-rose-400",
                      )}>
                        {d.tot_hours.toFixed(1)} h
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-2 border-t border-[#1a3a57] bg-[#07111e]/50">
          <p className="text-[10px] text-slate-600">
            <span className="text-teal-600 font-semibold">AUTO</span>
            {" "}– Current = last value · Delta = last − baseline · TOT-h via linear interpolation.
          </p>
        </div>
      </div>

    </div>
  );
}
