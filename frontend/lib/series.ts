// FILE: frontend/lib/series.ts
// ─────────────────────────────────────────────────────────────────────────────
// Time-series data model and automatic derivation of the 18 haemodynamic
// features fed to the PULSAR XGBoost model:
//   · current value  – last observed measurement in the series
//   · delta          – last value minus first (baseline) value
//   · TOT-hours      – hours accumulated off clinical target (linear interpolation)
//
// The user enters values at up to 5 fixed timepoints:
//   baseline (0 h),  6 h,  12 h,  24 h,  48 h
// Any subset of timepoints may be filled; missing points are skipped.
// ─────────────────────────────────────────────────────────────────────────────

// ── Timepoints ────────────────────────────────────────────────────────────────

export const TIMEPOINTS = ["baseline", "6h", "12h", "24h", "48h"] as const;
export type Timepoint = (typeof TIMEPOINTS)[number];

export const TIMEPOINT_HOURS: Record<Timepoint, number> = {
  baseline: 0,
  "6h":  6,
  "12h": 12,
  "24h": 24,
  "48h": 48,
};

export const TP_LABELS: Record<Timepoint, string> = {
  baseline: "Baseline",
  "6h":  "6 h",
  "12h": "12 h",
  "24h": "24 h",
  "48h": "48 h",
};

// ── Haemodynamic variables ────────────────────────────────────────────────────

export const HEMO_VARS = ["hr", "cpi_rap", "lactate", "pawp", "rap", "opp"] as const;
export type HemoVar = (typeof HEMO_VARS)[number];

/** UI display metadata for each haemodynamic variable. */
export interface VarMeta {
  label: string;
  unit:  string;
  min:   number;
  max:   number;
  step:  number;
}

export const VAR_META: Record<HemoVar, VarMeta> = {
  hr:      { label: "HR",      unit: "bpm",    min: 20, max: 250, step: 1    },
  cpi_rap: { label: "CPI/RAP", unit: "",       min: 0,  max: 10,  step: 0.01 },
  lactate: { label: "Lactate", unit: "mmol/L", min: 0,  max: 30,  step: 0.1  },
  pawp:    { label: "PAWP",    unit: "mmHg",   min: 0,  max: 60,  step: 0.5  },
  rap:     { label: "RAP",     unit: "mmHg",   min: 0,  max: 40,  step: 0.5  },
  opp:     { label: "OPP",     unit: "mmHg",   min: 0,  max: 200, step: 0.5  },
};

// ── Model feature-name mapping ────────────────────────────────────────────────

export const FEATURE_NAMES: Record<HemoVar, { current: string; delta: string; tot: string }> = {
  hr:      { current: "hr_pacath",      delta: "hr_pacath_delta",      tot: "hr_pacath_tot_hours"      },
  cpi_rap: { current: "cpi_rap_pacath", delta: "cpi_rap_pacath_delta", tot: "cpi_rap_pacath_tot_hours" },
  lactate: { current: "lactate",        delta: "lactate_delta",        tot: "lactate_tot_hours"        },
  pawp:    { current: "pawp_pacath",    delta: "pawp_pacath_delta",    tot: "pawp_pacath_tot_hours"    },
  rap:     { current: "rap_pacath",     delta: "rap_pacath_delta",     tot: "rap_pacath_tot_hours"     },
  opp:     { current: "opp_pacath",     delta: "opp_pacath_delta",     tot: "opp_pacath_tot_hours"     },
};

// ── Clinical fixed features (14 inputs not derived from the series) ───────────

// SCAI is no longer a manual clinical input — it is derived from the SCAI
// time series (see ScaiValues / computeScaiDerived below).
export const CLINICAL_FEATURE_NAMES = [
  "base_age_years",
  "base_sex_female",
  "base_diabetes",
  "base_hypertension",
  "base_cs_etiology",
  "base_creatinine",
  "base_iabp",
  "base_impella",
  "base_ecmo",
  "base_ventilation",
  "base_renal_replacement_therapy",
] as const;

export type ClinicalFeatureName = (typeof CLINICAL_FEATURE_NAMES)[number];

// ── Clinical thresholds for TOT-hours ────────────────────────────────────────

export interface ThresholdSpec {
  /**
   * "min" → goal is to stay ABOVE threshold; off-target when value < threshold.
   * "max" → goal is to stay BELOW threshold; off-target when value > threshold.
   */
  direction: "min" | "max";
  value:     number;
  goalLabel: string;
}

// Official PULSAR thresholds.  Direction semantics:
//   "max" → op "ge"  — off-target when value >= threshold
//   "min" → op "lt"  — off-target when value <  threshold
export const THRESHOLDS: Record<HemoVar, ThresholdSpec> = {
  hr:      { direction: "max", value: 100.0, goalLabel: "Goal < 100 bpm"  },
  cpi_rap: { direction: "min", value: 0.28,  goalLabel: "Goal ≥ 0.28"     },
  lactate: { direction: "max", value: 2.0,   goalLabel: "Goal < 2 mmol/L" },
  pawp:    { direction: "max", value: 18.0,  goalLabel: "Goal < 18 mmHg"  },
  rap:     { direction: "max", value: 12.0,  goalLabel: "Goal < 12 mmHg"  },
  opp:     { direction: "min", value: 57.0,  goalLabel: "Goal ≥ 57 mmHg"  },
};

// ── Series state shapes ───────────────────────────────────────────────────────

export type SeriesValues = Record<Timepoint, number | null>;
export type SeriesState  = Record<HemoVar, SeriesValues>;

export function emptySeriesState(): SeriesState {
  const state = {} as SeriesState;
  for (const v of HEMO_VARS) {
    const vals = {} as SeriesValues;
    for (const tp of TIMEPOINTS) vals[tp] = null;
    state[v] = vals;
  }
  return state;
}

// ── TOT-hours algorithm ───────────────────────────────────────────────────────

function isOffTarget(value: number, thresh: ThresholdSpec): boolean {
  // "max" → op "ge": off-target when value >= threshold
  // "min" → op "lt": off-target when value <  threshold
  return thresh.direction === "max" ? value >= thresh.value : value < thresh.value;
}

/**
 * Computes the time off-target for a single linear segment [t1, y1] → [t2, y2].
 *
 * Cases:
 * 1. Both off-target        → full interval duration
 * 2. Both on-target         → zero
 * 3. Crosses the threshold  → partial duration via linear interpolation:
 *      t* = t1 + (c − y1) / (y2 − y1) · (t2 − t1)
 *    - started off, ended on → off_i = t* − t1
 *    - started on, ended off → off_i = t2 − t*
 */
function segmentOffTime(
  t1: number, y1: number,
  t2: number, y2: number,
  thresh: ThresholdSpec,
): number {
  const off1 = isOffTarget(y1, thresh);
  const off2 = isOffTarget(y2, thresh);
  const dt   = t2 - t1;

  if (off1 && off2)   return dt;
  if (!off1 && !off2) return 0;

  // Linear crossing: t* = t1 + (c − y1) / (y2 − y1) * dt
  const c      = thresh.value;
  const dy     = y2 - y1;
  const tStar  = t1 + ((c - y1) / dy) * dt;
  const tCross = Math.max(t1, Math.min(t2, tStar));

  return off1 ? tCross - t1 : t2 - tCross;
}

// ── Derived value type ────────────────────────────────────────────────────────

export interface DerivedValues {
  /** Last observed value in the series; null if no measurements entered. */
  current:   number | null;
  /** Last value − first (baseline) value; null if fewer than 2 measurements. */
  delta:     number | null;
  /** Total hours accumulated off clinical target (linear interpolation). */
  tot_hours: number;
}

/** Derive current, delta, and TOT-hours from a single variable's series. */
export function computeDerived(
  values: SeriesValues,
  thresh: ThresholdSpec,
): DerivedValues {
  // Collect non-null observations in timepoint order
  const pts: { t: number; y: number }[] = [];
  for (const tp of TIMEPOINTS) {
    const v = values[tp];
    if (v !== null && v !== undefined) {
      pts.push({ t: TIMEPOINT_HOURS[tp], y: v });
    }
  }

  if (pts.length === 0) return { current: null, delta: null, tot_hours: 0 };

  const first = pts[0].y;
  const last  = pts[pts.length - 1].y;

  let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    tot += segmentOffTime(pts[i].t, pts[i].y, pts[i + 1].t, pts[i + 1].y, thresh);
  }

  return {
    current:   last,
    delta:     pts.length >= 2 ? last - first : null,
    tot_hours: tot,
  };
}

/** Derive values for all 6 haemodynamic variables. */
export function computeAll(series: SeriesState): Record<HemoVar, DerivedValues> {
  const out = {} as Record<HemoVar, DerivedValues>;
  for (const v of HEMO_VARS) {
    out[v] = computeDerived(series[v], THRESHOLDS[v]);
  }
  return out;
}

/**
 * Convert derived haemodynamic values to the 18 flat model feature entries.
 * Null values are passed as-is; the backend will impute them.
 */
export function derivedToFeatures(
  derived: Record<HemoVar, DerivedValues>,
): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  for (const v of HEMO_VARS) {
    const fn = FEATURE_NAMES[v];
    const d  = derived[v];
    map[fn.current] = d.current;
    map[fn.delta]   = d.delta;
    map[fn.tot]     = d.tot_hours;
  }
  return map;
}

// ── SCAI time-series ──────────────────────────────────────────────────────────

/** One SCAI measurement per timepoint (integer 1–5 or null). */
export type ScaiValues = Record<Timepoint, number | null>;

export function emptyScaiValues(): ScaiValues {
  const s = {} as ScaiValues;
  for (const tp of TIMEPOINTS) s[tp] = null;
  return s;
}

export interface ScaiDerived {
  /** SCAI at the first filled timepoint → base_scai_admission_num */
  admission: number | null;
  /** Maximum SCAI across all filled timepoints → base_scai_max_48h_num */
  max48h: number | null;
  /** max48h − admission (≥ 0) → scai_worsening */
  worsening: number | null;
}

/** Derive the 3 SCAI model features from the SCAI time series. */
export function computeScaiDerived(scai: ScaiValues): ScaiDerived {
  let first: number | null = null;
  let maxVal = -Infinity;
  let hasAny = false;

  for (const tp of TIMEPOINTS) {
    const v = scai[tp];
    if (v !== null && v !== undefined) {
      if (first === null) first = v;
      if (v > maxVal) maxVal = v;
      hasAny = true;
    }
  }

  if (!hasAny) return { admission: null, max48h: null, worsening: null };

  const worsening = first !== null ? Math.max(0, maxVal - first) : null;
  return { admission: first, max48h: maxVal, worsening };
}

/** Convert SCAI-derived values to the 3 flat model feature entries. */
export function scaiToFeatures(d: ScaiDerived): Record<string, number | null> {
  return {
    base_scai_admission_num: d.admission,
    base_scai_max_48h_num:   d.max48h,
    scai_worsening:          d.worsening,
  };
}

// ── Per-timepoint feature computation ────────────────────────────────────────

/**
 * Like computeDerived but only considers timepoints up to and including `upTo`.
 * Used to build the feature vector as it would look at a specific point in time.
 */
export function computeDerivedUpTo(
  values: SeriesValues,
  thresh: ThresholdSpec,
  upTo: Timepoint,
): DerivedValues {
  const cutoff = TIMEPOINT_HOURS[upTo];
  const pts: { t: number; y: number }[] = [];
  for (const tp of TIMEPOINTS) {
    if (TIMEPOINT_HOURS[tp] > cutoff) break;
    const v = values[tp];
    if (v !== null && v !== undefined) pts.push({ t: TIMEPOINT_HOURS[tp], y: v });
  }
  if (pts.length === 0) return { current: null, delta: null, tot_hours: 0 };
  const first = pts[0].y;
  const last  = pts[pts.length - 1].y;
  let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    tot += segmentOffTime(pts[i].t, pts[i].y, pts[i + 1].t, pts[i + 1].y, thresh);
  }
  return { current: last, delta: pts.length >= 2 ? last - first : null, tot_hours: tot };
}

/** Derive values for all haemodynamic variables using only data up to `upTo`. */
export function computeAllUpTo(
  series: SeriesState,
  upTo: Timepoint,
): Record<HemoVar, DerivedValues> {
  const out = {} as Record<HemoVar, DerivedValues>;
  for (const v of HEMO_VARS) out[v] = computeDerivedUpTo(series[v], THRESHOLDS[v], upTo);
  return out;
}

/** SCAI derived values using only timepoints up to and including `upTo`. */
export function computeScaiDerivedUpTo(scai: ScaiValues, upTo: Timepoint): ScaiDerived {
  const cutoff = TIMEPOINT_HOURS[upTo];
  let first: number | null = null;
  let maxVal = -Infinity;
  let hasAny = false;
  for (const tp of TIMEPOINTS) {
    if (TIMEPOINT_HOURS[tp] > cutoff) break;
    const v = scai[tp];
    if (v !== null && v !== undefined) {
      if (first === null) first = v;
      if (v > maxVal) maxVal = v;
      hasAny = true;
    }
  }
  if (!hasAny) return { admission: null, max48h: null, worsening: null };
  return {
    admission:  first,
    max48h:     maxVal,
    worsening:  first !== null ? Math.max(0, maxVal - first) : null,
  };
}

/** Returns true if at least one haemodynamic variable has a non-null value at exactly `tp`. */
export function hasDataAtTimepoint(series: SeriesState, tp: Timepoint): boolean {
  return HEMO_VARS.some((v) => series[v][tp] !== null);
}

// ── Support devices time-series ───────────────────────────────────────────────

export const SUPPORT_VARS = [
  "base_iabp",
  "base_impella",
  "base_ecmo",
  "base_ventilation",
  "base_renal_replacement_therapy",
] as const;
export type SupportVar = (typeof SUPPORT_VARS)[number];

export type SupportValues = Record<Timepoint, number | null>;
export type SupportSeries = Record<SupportVar, SupportValues>;

export function emptySupportSeries(): SupportSeries {
  const out = {} as SupportSeries;
  for (const sv of SUPPORT_VARS) {
    const vals = {} as SupportValues;
    for (const tp of TIMEPOINTS) vals[tp] = null;
    out[sv] = vals;
  }
  return out;
}

/**
 * Forward-propagation: returns the effective value for device `sv` at `tp`.
 * Finds the most-recent non-null value at or before `tp`; returns null if none.
 */
export function getSupportAtTimepoint(
  support: SupportSeries,
  sv: SupportVar,
  tp: Timepoint,
): number | null {
  const cutoff = TIMEPOINT_HOURS[tp];
  let last: number | null = null;
  for (const t of TIMEPOINTS) {
    if (TIMEPOINT_HOURS[t] > cutoff) break;
    const v = support[sv][t];
    if (v !== null) last = v;
  }
  return last;
}

/** Flat feature map for all support devices at a given timepoint (with forward-propagation). */
export function supportToFeaturesAtTimepoint(
  support: SupportSeries,
  tp: Timepoint,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const sv of SUPPORT_VARS) {
    out[sv] = getSupportAtTimepoint(support, sv, tp);
  }
  return out;
}
