// FILE: frontend/components/hemodynamic-trends.tsx
"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import clsx from "clsx";
import {
  HEMO_VARS,
  TIMEPOINTS,
  TIMEPOINT_HOURS,
  TP_LABELS,
  VAR_META,
  THRESHOLDS,
  type SeriesState,
  type HemoVar,
} from "@/lib/series";

// ── Chart canvas constants ────────────────────────────────────────────────────

const SVG_W  = 340;
const SVG_H  = 175;
const PAD_T  = 24;   // top  — space for value labels above dots
const PAD_B  = 28;   // bottom — x-axis labels
const PAD_L  = 36;   // left  — y-axis labels
const PAD_R  = 12;   // right
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;

// X pixel position for each timepoint, proportional to actual elapsed hours
const MAX_HOURS = 48;
const X_POS = TIMEPOINTS.map(
  (tp) => PAD_L + (TIMEPOINT_HOURS[tp] / MAX_HOURS) * PLOT_W,
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function valToY(val: number, minY: number, maxY: number): number {
  if (maxY === minY) return PAD_T + PLOT_H / 2;
  return PAD_T + (1 - (val - minY) / (maxY - minY)) * PLOT_H;
}

function isOffTarget(val: number, variable: HemoVar): boolean {
  const t = THRESHOLDS[variable];
  return t.direction === "max" ? val >= t.value : val < t.value;
}

// ── Single-variable SVG chart ─────────────────────────────────────────────────

interface VarChartProps {
  variable: HemoVar;
  series:   SeriesState;
}

function VarChart({ variable, series }: VarChartProps) {
  const meta   = VAR_META[variable];
  const thresh = THRESHOLDS[variable];
  const values = series[variable];

  // Non-null observations in timepoint order
  type Pt = { i: number; tp: typeof TIMEPOINTS[number]; val: number };
  const pts: Pt[] = TIMEPOINTS
    .map((tp, i) => ({ i, tp, val: values[tp] }))
    .filter((p): p is Pt => p.val !== null && p.val !== undefined);

  // Y scale: include the threshold so it always falls within the chart
  const allY     = [...pts.map((p) => p.val), thresh.value];
  const rawMin   = Math.min(...allY);
  const rawMax   = Math.max(...allY);
  const yPad     = (rawMax - rawMin) * 0.22 || Math.abs(thresh.value) * 0.15 || 1;
  const minY     = rawMin - yPad;
  const maxY     = rawMax + yPad;
  const thrY     = valToY(thresh.value, minY, maxY);

  // SVG line path (M then L for each subsequent point)
  const linePath = pts.length >= 2
    ? pts
        .map((p, idx) => {
          const x = X_POS[p.i].toFixed(1);
          const y = valToY(p.val, minY, maxY).toFixed(1);
          return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ")
    : "";

  // Area fill below the line (closed back to x-axis)
  const areaPath =
    pts.length >= 2
      ? `${linePath} L ${X_POS[pts[pts.length - 1].i].toFixed(1)} ${(PAD_T + PLOT_H).toFixed(1)} L ${X_POS[pts[0].i].toFixed(1)} ${(PAD_T + PLOT_H).toFixed(1)} Z`
      : "";

  // Unique gradient ID per variable to avoid cross-SVG ID collisions in the DOM
  const gradId    = `hdt-grad-${variable}`;
  const lastPt    = pts.length > 0 ? pts[pts.length - 1] : null;
  const currOff   = lastPt ? isOffTarget(lastPt.val, variable) : null;

  // Y-axis labels: min, threshold, max  (to give clinical context)
  const yLabels = [
    { y: valToY(maxY, minY, maxY), text: meta.step < 1 ? maxY.toFixed(1) : Math.round(maxY).toString() },
    { y: thrY, text: thresh.value.toString(), isThresh: true },
    { y: valToY(minY, minY, maxY), text: meta.step < 1 ? minY.toFixed(1) : Math.round(minY).toString() },
  ];

  return (
    <div className="flex flex-col rounded-xl border border-[#1a3a57] bg-[#071929] overflow-hidden">

      {/* ── Card header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2 border-b border-[#1a3a57]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-none text-slate-200 truncate">
            {meta.label}
            {meta.unit && (
              <span className="ml-1 font-normal text-slate-600 text-[10px]">({meta.unit})</span>
            )}
          </p>
          <p className="mt-0.5 text-[9px] leading-none text-slate-600">{thresh.goalLabel}</p>
        </div>
        {currOff !== null && (
          <span
            className={clsx(
              "flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold border",
              currOff
                ? "bg-rose-900/30 border-rose-700/40 text-rose-300"
                : "bg-teal-900/30 border-teal-700/40 text-teal-300",
            )}
          >
            {currOff ? "Off" : "On"}
          </span>
        )}
      </div>

      {/* ── SVG chart ───────────────────────────────────────────────────── */}
      <div className="flex-1 px-0.5 pb-0.5 pt-0">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-auto"
          aria-label={`${meta.label} hemodynamic trend`}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#14b8a6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0"    />
            </linearGradient>
          </defs>

          {/* Subtle horizontal grid lines */}
          {[0, 0.5, 1].map((f) => (
            <line
              key={f}
              x1={PAD_L}           y1={PAD_T + f * PLOT_H}
              x2={SVG_W - PAD_R}   y2={PAD_T + f * PLOT_H}
              stroke="#0f2236" strokeWidth="0.8"
            />
          ))}

          {/* Y-axis */}
          <line
            x1={PAD_L} y1={PAD_T}
            x2={PAD_L} y2={PAD_T + PLOT_H}
            stroke="#1e4060" strokeWidth="0.8"
          />

          {/* X-axis baseline */}
          <line
            x1={PAD_L}          y1={PAD_T + PLOT_H}
            x2={SVG_W - PAD_R}  y2={PAD_T + PLOT_H}
            stroke="#1e4060" strokeWidth="0.8"
          />

          {/* Threshold line (dashed amber) */}
          <line
            x1={PAD_L}         y1={thrY}
            x2={SVG_W - PAD_R} y2={thrY}
            stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.75"
          />

          {/* Y-axis labels */}
          {yLabels.map((lbl, idx) => (
            <text
              key={idx}
              x={PAD_L - 3}
              y={lbl.y + 2.5}
              textAnchor="end"
              fontSize="6.5"
              fill={lbl.isThresh ? "#f59e0b" : "#334155"}
              opacity={lbl.isThresh ? "0.85" : "1"}
            >
              {lbl.text}
            </text>
          ))}

          {/* X-axis tick marks and labels */}
          {TIMEPOINTS.map((tp, i) => (
            <g key={tp}>
              <line
                x1={X_POS[i]} y1={PAD_T + PLOT_H}
                x2={X_POS[i]} y2={PAD_T + PLOT_H + 3}
                stroke="#1e4060" strokeWidth="0.8"
              />
              <text
                x={X_POS[i]} y={SVG_H - 4}
                textAnchor="middle" fontSize="7" fill="#475569"
              >
                {TP_LABELS[tp].replace(" ", "")}
              </text>
            </g>
          ))}

          {/* No-data placeholder */}
          {pts.length === 0 && (
            <text
              x={PAD_L + PLOT_W / 2}
              y={PAD_T + PLOT_H / 2 + 4}
              textAnchor="middle" fontSize="9" fill="#1e3a54"
            >
              No data
            </text>
          )}

          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill={`url(#${gradId})`} />
          )}

          {/* Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none" stroke="#14b8a6" strokeWidth="1.5"
              strokeLinejoin="round" strokeLinecap="round"
            />
          )}

          {/* Data point dots + value labels */}
          {pts.map((p) => {
            const cx         = X_POS[p.i];
            const cy         = valToY(p.val, minY, maxY);
            const off        = isOffTarget(p.val, variable);
            const dotColor   = off ? "#fb7185" : "#2dd4bf";
            const ringColor  = off ? "rgb(251,113,133,0.2)" : "rgb(45,212,191,0.2)";
            const strokeClr  = off ? "#e11d48" : "#0d9488";
            const formatted  = meta.step < 1 ? p.val.toFixed(2) : p.val.toFixed(0);

            return (
              <g key={p.tp}>
                {/* Glow ring */}
                <circle cx={cx} cy={cy} r="5.5" fill={ringColor} />
                {/* Dot */}
                <circle
                  cx={cx} cy={cy} r="3"
                  fill={dotColor} stroke={strokeClr} strokeWidth="0.8"
                />
                {/* Value label above */}
                <text
                  x={cx} y={cy - 8}
                  textAnchor="middle" fontSize="6.5"
                  fill={dotColor} fontFamily="monospace"
                >
                  {formatted}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface HemodynamicTrendsProps {
  series: SeriesState;
}

export default function HemodynamicTrends({ series }: HemodynamicTrendsProps) {
  const hasData = useMemo(
    () => HEMO_VARS.some((v) => TIMEPOINTS.some((tp) => series[v][tp] !== null)),
    [series],
  );

  return (
    <div className="card overflow-hidden">

      {/* ── Panel header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#1a3a57]">
        <TrendingUp className="h-4 w-4 text-teal-400 flex-shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Hemodynamic Trends
        </span>
        <div className="ml-auto hidden sm:flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="inline-block w-5 border-t border-dashed border-amber-400/75" />
            Threshold
          </span>
          <span className="flex items-center gap-1 text-slate-600">
            <span className="h-2 w-2 rounded-full bg-teal-400" />
            On-target
          </span>
          <span className="flex items-center gap-1 text-slate-600">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            Off-target
          </span>
        </div>
      </div>

      {/* ── Chart grid / empty state ──────────────────────────────────── */}
      {hasData ? (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HEMO_VARS.map((v) => (
            <VarChart key={v} variable={v} series={series} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-14 gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f2236]">
            <TrendingUp className="h-5 w-5 text-slate-600" />
          </div>
          <p className="text-sm text-slate-600">No haemodynamic data yet</p>
          <p className="text-xs text-slate-700">
            Enter values in the table above — charts appear automatically
          </p>
        </div>
      )}
    </div>
  );
}
