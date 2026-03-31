// FILE: frontend/lib/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central TypeScript type definitions for HEMOSCOREAPP frontend.
// Mirrors backend Pydantic schemas exactly — field names must stay in sync.
// ─────────────────────────────────────────────────────────────────────────────

import type { SeriesState, ScaiValues, SupportSeries } from "@/lib/series";

// ══════════════════════════════════════════════════════════════════════════════
// Enums / union literals
// ══════════════════════════════════════════════════════════════════════════════

export type RiskCategory = "low" | "medium" | "high" | "very_high";
export type ChangeLabel  = "improved" | "worsened" | "unchanged";
export type Direction    = "up" | "down" | "uncertain";

// ══════════════════════════════════════════════════════════════════════════════
// Metadata
// ══════════════════════════════════════════════════════════════════════════════

export interface RiskGroupMeta {
  label: string;
  lower: number;
  upper: number;
  color: string | null;
}

export interface FeatureImportanceMeta {
  feature: string;
  importance: number;
}

export interface MetadataResponse {
  model_name: string;
  api_version: string;
  n_features: number;
  features: string[];
  continuous_vars: string[];
  binary_vars: string[];
  ordinal_vars: string[];
  risk_groups: RiskGroupMeta[];
  top_features_by_importance: FeatureImportanceMeta[];
  /** Population-median imputation defaults keyed by feature name. */
  imputation_defaults: Record<string, number>;
  xgb_params: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Prediction
// ══════════════════════════════════════════════════════════════════════════════

export interface RiskResult {
  probability: number;
  risk_percent: number;
  label: string;
  category: RiskCategory;
}

export interface FeatureContribution {
  feature: string;
  patient_value: number;
  reference_value: number;
  delta_probability: number;
  direction: Direction;
  direction_label: string;
  importance_rank: number;
}

export interface ExplanationResult {
  method: string;
  explanation_method: string;
  explanation_disclaimer: string;
  interpretation_note: string;
  baseline_probability: number | null;
  top_increasing: FeatureContribution[];
  top_decreasing: FeatureContribution[];
  all_contributions: FeatureContribution[];
}

export interface PredictRequest {
  inputs: Record<string, number | null>;
  include_explanation: boolean;
}

export interface PredictResponse {
  probability: number;
  risk_percent: number;
  risk_result: RiskResult;
  imputed_fields: string[];
  out_of_range_fields: string[];
  feature_dict: Record<string, number>;
  explanation: ExplanationResult;
  timestamp: string;
  model_name: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Comparison
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareRequest {
  baseline_inputs: Record<string, number | null>;
  current_inputs: Record<string, number | null>;
  include_explanation: boolean;
}

export interface CompareResponse {
  current: PredictResponse;
  baseline_risk: RiskResult;
  delta_absolute: number;
  delta_absolute_pp: number;
  delta_relative: number | null;
  change_label: ChangeLabel;
  category_shift: string;
  timestamp: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Health
// ══════════════════════════════════════════════════════════════════════════════

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  timestamp: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// UI-local state shapes
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Raw baseline-column inputs at the moment the baseline was captured.
 * Used for drift detection: if any of these change after capture, the UI
 * shows a "Baseline inputs modified" warning.
 */
export interface BaselineRaw {
  /** series[v]["baseline"] value per haemodynamic variable at capture time. */
  seriesBaseline: Record<string, number | null>;
  /** scai["baseline"] at capture time. */
  scaiBaseline:   number | null;
  /** clinicalInputs at capture time. */
  clinical:       Record<string, number | null>;
}

/**
 * Snapshot saved by the user as "baseline".
 * Persisted in component state only (no backend storage).
 *
 * featureMap: flat 32-feature dict from the last PredictResponse.feature_dict —
 *   used directly as baseline_inputs for POST /compare.
 * clinicalInputs: the 14 fixed clinical fields at time of save (for display).
 * rawInputs: baseline-column values — used for drift detection and Review panel.
 */
export interface BaselineSnapshot {
  featureMap:     Record<string, number>;
  clinicalInputs: Record<string, number | null>;
  rawInputs:      BaselineRaw;
  risk:    RiskResult;
  savedAt: string; // ISO string
}

/**
 * Per-feature form field descriptor built from MetadataResponse.
 */
export interface FieldMeta {
  name: string;
  label: string;        // friendly display name
  type: "continuous" | "binary" | "ordinal";
  unit?: string;        // e.g. "mmol/L", "bpm"
  min?: number;
  max?: number;
  step?: number;
  /** Ordered levels for ordinal / binary selects */
  options?: { value: number; label: string }[];
  description?: string;
}

/** Aggregated app-level state passed down via context or props */
export interface AppState {
  metadata: MetadataResponse | null;
  inputs: Record<string, number | null>;
  currentResult: PredictResponse | null;
  compareResult: CompareResponse | null;
  baseline: BaselineSnapshot | null;
  loading: boolean;
  error: string | null;
}

/**
 * Risk results keyed by timepoint string ("baseline", "6h", "12h", "24h", "48h").
 * Only includes timepoints for which data was available and prediction succeeded.
 */
export type TimepointRisks = Partial<Record<string, PredictResponse>>;

// ══════════════════════════════════════════════════════════════════════════════
// Patient persistence
// ══════════════════════════════════════════════════════════════════════════════

/** Autosave indicator shown in the patient bar. */
export type SaveStatus = "idle" | "saving" | "saved";

/**
 * Full snapshot of a patient's clinical session, persisted to IndexedDB.
 * Includes all data needed to fully restore the app state on re-open.
 */
export interface PatientRecord {
  // Identity
  patient_id:      string;
  patient_name:    string | null;
  hospital_id:     string | null;   // folio
  created_at:      string;           // ISO
  updated_at:      string;           // ISO
  notes:           string | null;

  // Clinical inputs
  series:          SeriesState;
  scai:            ScaiValues;
  support:         SupportSeries;
  clinical_inputs: Record<string, number | null>;

  // Derived / computed
  baseline:        BaselineSnapshot | null;
  baseline_raw:    BaselineRaw | null;
  timepoint_risks: TimepointRisks;
  current_result:  PredictResponse | null;

  // UI state
  selected_tp:     string | null;    // Timepoint | null stored as string
}
