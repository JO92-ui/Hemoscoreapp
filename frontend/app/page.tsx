// FILE: frontend/app/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Header from "@/components/header";
import Footer from "@/components/footer";
import InputPanel from "@/components/input-panel";
import SeriesPanel from "@/components/series-panel";
import HemodynamicTrends from "@/components/hemodynamic-trends";
import ResultPanel from "@/components/result-panel";
import BaselineCard from "@/components/baseline-card";
import BaselineReview from "@/components/baseline-review";
import InfluencePanel from "@/components/influence-panel";
import TimepointRisksPanel from "@/components/timepoint-risks-panel";
import { fetchMetadata, predict, compare } from "@/lib/api";
import { makeTestCaseSeries, makeTestCaseScai, makeTestCaseSupportSeries, TEST_CASE_CLINICAL } from "@/lib/test-case";
import {
  emptySeriesState,
  emptyScaiValues,
  emptySupportSeries,
  computeAll,
  computeScaiDerived,
  computeAllUpTo,
  computeScaiDerivedUpTo,
  hasDataAtTimepoint,
  derivedToFeatures,
  scaiToFeatures,
  supportToFeaturesAtTimepoint,
  HEMO_VARS,
  TIMEPOINTS,
  TP_LABELS,
  type SeriesState,
  type ScaiValues,
  type HemoVar,
  type Timepoint,
  type SupportSeries,
  type SupportVar,
} from "@/lib/series";
import type {
  BaselineRaw,
  BaselineSnapshot,
  CompareResponse,
  MetadataResponse,
  PatientRecord,
  PredictResponse,
  SaveStatus,
  TimepointRisks,
} from "@/lib/types";
import PatientBar from "@/components/patient-bar";
import PatientListModal from "@/components/patient-list-modal";
import { patientDB, handleDB, generateId } from "@/lib/db";
import { useAuth } from "@/lib/auth-context";
import {
  importPatientFromFile,
  exportPatientToFile,
  exportPatientExcel,
  writePatientToDir,
  pickFolder,
  verifyPermission,
  HANDLE_PATIENTS_KEY,
  HANDLE_EXPORTS_KEY,
} from "@/lib/file-system";

// =============================================================================
// State machine
// =============================================================================

interface State {
  metadata:         MetadataResponse | null;
  metaLoading:      boolean;
  series:           SeriesState;
  scai:             ScaiValues;
  support:          SupportSeries;
  clinicalInputs:   Record<string, number | null>;
  currentResult:    PredictResponse | null;
  compareResult:    CompareResponse | null;
  baseline:         BaselineSnapshot | null;
  /** Raw baseline-column inputs at capture time — used for drift detection. */
  baselineRaw:      BaselineRaw | null;
  /** Per-timepoint risk predictions (baseline, 6h, 12h, 24h, 48h). */
  timepointRisks:   TimepointRisks;
  loadingAction:    "predict" | "compare" | "testcase" | null;
  error:            string | null;
}

type Action =
  | { type: "META_LOADING" }
  | { type: "SET_METADATA";         payload: MetadataResponse }
  | { type: "META_ERROR";           payload: string }
  | { type: "PATCH_SERIES";         variable: HemoVar; timepoint: Timepoint; value: number | null }
  | { type: "SET_SERIES";           payload: SeriesState }
  | { type: "PATCH_SCAI";           timepoint: Timepoint; value: number | null }
  | { type: "SET_SCAI";             payload: ScaiValues }
  | { type: "PATCH_CLINICAL";       field: string; value: number | null }
  | { type: "SET_CLINICAL";         payload: Record<string, number | null> }
  | { type: "PATCH_SUPPORT";        device: SupportVar; timepoint: Timepoint; value: number | null }
  | { type: "SET_SUPPORT";          payload: SupportSeries }
  | { type: "SET_RESULT";           payload: PredictResponse }
  | { type: "SET_COMPARE";          payload: CompareResponse }
  | { type: "SET_BASELINE";         payload: BaselineSnapshot }
  | { type: "CLEAR_BASELINE" }
  | { type: "DISMISS_DRIFT" }
  | { type: "SET_TIMEPOINT_RISKS";  payload: TimepointRisks }
  | { type: "RESET" }
  | { type: "LOADING";              action: State["loadingAction"] }
  | { type: "DONE_LOADING" }
  | { type: "SET_ERROR";            payload: string | null };

const initialState: State = {
  metadata:         null,
  metaLoading:      true,
  series:           emptySeriesState(),
  scai:             emptyScaiValues(),
  support:          emptySupportSeries(),
  clinicalInputs: {},
  currentResult:  null,
  compareResult:    null,
  baseline:         null,
  baselineRaw:      null,
  timepointRisks:   {},
  loadingAction:    null,
  error:            null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "META_LOADING":
      return { ...state, metaLoading: true };
    case "SET_METADATA":
      return { ...state, metadata: action.payload, metaLoading: false, error: null };
    case "META_ERROR":
      return { ...state, metaLoading: false, error: action.payload };

    case "PATCH_SERIES":
      return {
        ...state,
        series: {
          ...state.series,
          [action.variable]: {
            ...state.series[action.variable],
            [action.timepoint]: action.value,
          },
        },
      };
    case "SET_SERIES":
      return { ...state, series: action.payload };

    case "PATCH_SCAI":
      return { ...state, scai: { ...state.scai, [action.timepoint]: action.value } };
    case "SET_SCAI":
      return { ...state, scai: action.payload };

    case "PATCH_CLINICAL":
      return { ...state, clinicalInputs: { ...state.clinicalInputs, [action.field]: action.value } };
    case "SET_CLINICAL":
      return { ...state, clinicalInputs: action.payload };

    case "PATCH_SUPPORT": {
      const sv = action.device;
      const updated = { ...state.support[sv] };
      updated[action.timepoint] = action.value;
      // Sticky forward fill: if turning on, propagate to subsequent null timepoints
      if (action.value !== null) {
        let seen = false;
        for (const tp of TIMEPOINTS) {
          if (tp === action.timepoint) { seen = true; continue; }
          if (!seen) continue;
          if (updated[tp] === null) updated[tp] = action.value;
        }
      }
      return { ...state, support: { ...state.support, [sv]: updated } };
    }
    case "SET_SUPPORT":
      return { ...state, support: action.payload };

    case "SET_RESULT":
      return { ...state, currentResult: action.payload, error: null };
    case "SET_COMPARE":
      return { ...state, compareResult: action.payload, error: null };
    case "SET_BASELINE":
      return { ...state, baseline: action.payload, baselineRaw: action.payload.rawInputs };
    case "CLEAR_BASELINE":
      return { ...state, baseline: null, baselineRaw: null, compareResult: null, timepointRisks: {} };
    case "DISMISS_DRIFT":
      // Acknowledges the drift: stops showing the warning by nulling baselineRaw.
      // The existing baseline featureMap is preserved for future comparisons.
      return { ...state, baselineRaw: null };
    case "SET_TIMEPOINT_RISKS":
      return { ...state, timepointRisks: action.payload };

    case "RESET":
      return {
        ...state,
        series:           emptySeriesState(),
        scai:             emptyScaiValues(),
        support:          emptySupportSeries(),
        clinicalInputs:   {},
        currentResult:    null,
        compareResult:    null,
        baseline:         null,
        baselineRaw:      null,
        timepointRisks:   {},
        error:            null,
        loadingAction:    null,
      };
    case "LOADING":
      return { ...state, loadingAction: action.action, error: null };
    case "DONE_LOADING":
      return { ...state, loadingAction: null };
    case "SET_ERROR":
      return { ...state, error: action.payload, loadingAction: null };
    default:
      return state;
  }
}

// =============================================================================
// Per-timepoint risk helper (module-level — uses only imported functions)
// =============================================================================

/**
 * For each timepoint that has at least one haemodynamic value, build the
 * feature vector using ONLY data up to that timepoint and call POST /predict.
 * All calls are made in parallel; failed timepoints are silently skipped.
 */
async function buildTimepointRisks(
  series: SeriesState,
  scai: ScaiValues,
  clinicalInputs: Record<string, number | null>,
  support: SupportSeries,
): Promise<TimepointRisks> {
  const out: TimepointRisks = {};
  await Promise.all(
    TIMEPOINTS
      .filter((tp) => hasDataAtTimepoint(series, tp))
      .map((tp) => {
        const features = {
          ...derivedToFeatures(computeAllUpTo(series, tp)),
          ...scaiToFeatures(computeScaiDerivedUpTo(scai, tp)),
          ...clinicalInputs,
          ...supportToFeaturesAtTimepoint(support, tp),
        };
        return predict(features, false)
          .then((r) => { out[tp] = r; })
          .catch(() => { /* skip failed timepoints */ });
      }),
  );
  return out;
}

// =============================================================================
// Page
// =============================================================================

export default function HomePage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [state, dispatch] = useReducer(reducer, initialState);
  const isLoading = state.loadingAction !== null;
  const [activeView, setActiveView] = useState<"clinical" | "insights" | "disclosures" | "copyright">("clinical");
  const [selectedTp, setSelectedTp] = useState<Timepoint | null>(null);

  // ── Patient management state ──────────────────────────────────────────────
  const [patientId,        setPatientId]        = useState<string>(() => generateId());
  const [patientName,      setPatientName]      = useState<string | null>(null);
  const [hospitalId,       setHospitalId]       = useState<string | null>(null);
  const [notes,            setNotes]            = useState<string | null>(null);          // eslint-disable-line @typescript-eslint/no-unused-vars
  const [saveStatus,       setSaveStatus]       = useState<SaveStatus>("idle");
  const [lastSavedAt,      setLastSavedAt]      = useState<string | null>(null);
  const [showPatientList,  setShowPatientList]  = useState(false);
  const patientCreatedAt = useRef<string>(new Date().toISOString());

  // ── Default folder handles (File System Access API) ───────────────────────
  const [patientsFolder, setPatientsFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [exportsFolder,  setExportsFolder]  = useState<FileSystemDirectoryHandle | null>(null);

  // Auto-select baseline when timepoint risks first compute
  useEffect(() => {
    setSelectedTp((curr) => {
      if (curr !== null) return curr;
      const first = TIMEPOINTS.find((tp) => state.timepointRisks[tp] != null) ?? null;
      return first;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.timepointRisks]);

  // ── Load stored folder handles from IndexedDB on first mount ─────────────
  useEffect(() => {
    handleDB.getHandle(HANDLE_PATIENTS_KEY).then((h) => { if (h) setPatientsFolder(h); }).catch(() => {});
    handleDB.getHandle(HANDLE_EXPORTS_KEY).then((h)  => { if (h) setExportsFolder(h);  }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live per-timepoint risk — auto-compute on input change (debounced) ────
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    const hasAny = TIMEPOINTS.some((tp) => hasDataAtTimepoint(state.series, tp));
    if (!hasAny) return;
    liveTimerRef.current = setTimeout(async () => {
      try {
        const tpRisks = await buildTimepointRisks(state.series, state.scai, state.clinicalInputs, state.support);
        if (Object.keys(tpRisks).length > 0) {
          dispatch({ type: "SET_TIMEPOINT_RISKS", payload: tpRisks });
        }
      } catch { /* silent */ }
    }, 600);
    return () => { if (liveTimerRef.current) clearTimeout(liveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.series, state.scai, state.clinicalInputs, state.support]);

  // ── Autosave to IndexedDB (debounced 1 500 ms after any input change) ─────
  useEffect(() => {
    if (autosaveRef.current) clearTimeout(autosaveRef.current);

    const hasData =
      TIMEPOINTS.some((tp) => hasDataAtTimepoint(state.series, tp)) ||
      Object.values(state.clinicalInputs).some((v) => v !== null)   ||
      !!state.baseline;

    if (!hasData) return;

    setSaveStatus("saving");
    autosaveRef.current = setTimeout(async () => {
      try {
        const now = new Date().toISOString();
        const record: PatientRecord = {
          patient_id:      patientId,
          patient_name:    patientName,
          hospital_id:     hospitalId,
          created_at:      patientCreatedAt.current,
          updated_at:      now,
          notes:           null,
          series:          state.series,
          scai:            state.scai,
          support:         state.support,
          clinical_inputs: state.clinicalInputs,
          baseline:        state.baseline,
          baseline_raw:    state.baselineRaw,
          timepoint_risks: state.timepointRisks,
          current_result:  state.currentResult,
          selected_tp:     selectedTp,
        };
        // Layer 1: always persist to IndexedDB
        await patientDB.save(record);
        // Layer 2: also write to real folder if the user has configured one
        if (patientsFolder) {
          const ok = await verifyPermission(patientsFolder).catch(() => false);
          if (ok) await writePatientToDir(patientsFolder, record).catch(() => {});
        }
        setLastSavedAt(now);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("idle");
      }
    }, 1500);
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.series, state.scai, state.support, state.clinicalInputs,
    state.baseline, state.baselineRaw, state.timepointRisks, state.currentResult,
    selectedTp, patientId, patientName, hospitalId, patientsFolder,
  ]);

  // ── Load metadata on mount ────────────────────────────────────────────────
  useEffect(() => {
    dispatch({ type: "META_LOADING" });
    fetchMetadata()
      .then((m) => dispatch({ type: "SET_METADATA", payload: m }))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Unknown error";
        dispatch({ type: "META_ERROR", payload: `Failed to load model metadata: ${msg}` });
      });
  }, []);

  // ── SCAI change ───────────────────────────────────────────────────────────
  const handleScaiChange = useCallback((timepoint: Timepoint, value: number | null) => {
    dispatch({ type: "PATCH_SCAI", timepoint, value });
  }, []);

  // ── Series change ─────────────────────────────────────────────────────────
  const handleSeriesChange = useCallback(
    (variable: HemoVar, timepoint: Timepoint, value: number | null) => {
      dispatch({ type: "PATCH_SERIES", variable, timepoint, value });
    },
    [],
  );

  // ── Clinical input change ──────────────────────────────────────────────────
  const handleClinicalChange = useCallback((field: string, value: number | null) => {
    dispatch({ type: "PATCH_CLINICAL", field, value });
  }, []);

  // ── Support change ───────────────────────────────────────────────────────
  const handleSupportChange = useCallback((sv: SupportVar, timepoint: Timepoint, value: number | null) => {
    dispatch({ type: "PATCH_SUPPORT", device: sv, timepoint, value });
  }, []);

  // ── Build flat 32-feature payload from series + SCAI + clinical inputs ────
  function buildFeatureMap(
    series: SeriesState,
    scai: ScaiValues,
    clinicalInputs: Record<string, number | null>,
    support: SupportSeries,
  ): Record<string, number | null> {
    const derived = computeAll(series);
    return {
      ...derivedToFeatures(derived),
      ...scaiToFeatures(computeScaiDerived(scai)),
      ...clinicalInputs,
      ...supportToFeaturesAtTimepoint(support, "48h"),
    };
  }

  // ── Build BaselineRaw snapshot from current state ────────────────────────
  function buildBaselineRaw(
    series: SeriesState,
    scai: ScaiValues,
    clinicalInputs: Record<string, number | null>,
  ): BaselineRaw {
    return {
      seriesBaseline: Object.fromEntries(HEMO_VARS.map((v) => [v, series[v].baseline])),
      scaiBaseline:   scai.baseline,
      clinical:       { ...clinicalInputs },
    };
  }

  // ── Drift detection — derived, not stored in state ────────────────────────
  const baselineDrift = useMemo(() => {
    if (!state.baselineRaw || !state.baseline) return false;
    const raw = state.baselineRaw;
    for (const v of HEMO_VARS) {
      if ((state.series[v].baseline ?? null) !== (raw.seriesBaseline[v] ?? null)) return true;
    }
    if ((state.scai.baseline ?? null) !== (raw.scaiBaseline ?? null)) return true;
    for (const k of Object.keys(raw.clinical)) {
      if ((state.clinicalInputs[k] ?? null) !== (raw.clinical[k] ?? null)) return true;
    }
    return false;
  }, [state.series, state.scai, state.clinicalInputs, state.baselineRaw, state.baseline]);

  // ── Load test case ────────────────────────────────────────────────────────
  const handleLoadTestCase = useCallback(async () => {
    dispatch({ type: "LOADING", action: "testcase" });
    try {
      // Populate form with rich 5-timepoint test case
      const newSeries      = makeTestCaseSeries();
      const newScai        = makeTestCaseScai();
      const clinicalInputs = { ...TEST_CASE_CLINICAL };
      const newSupport     = makeTestCaseSupportSeries();

      dispatch({ type: "SET_CLINICAL", payload: clinicalInputs });
      dispatch({ type: "SET_SCAI",     payload: newScai });
      dispatch({ type: "SET_SERIES",   payload: newSeries });
      dispatch({ type: "SET_SUPPORT",  payload: newSupport });

      // Predict from the rich inputs and auto-save baseline
      const allInputs = buildFeatureMap(newSeries, newScai, clinicalInputs, newSupport);
      const result    = await predict(allInputs, true);
      dispatch({ type: "SET_RESULT", payload: result });

      const snap: BaselineSnapshot = {
        featureMap:     result.feature_dict,
        clinicalInputs: { ...clinicalInputs },
        rawInputs:      buildBaselineRaw(newSeries, newScai, clinicalInputs),
        risk:           result.risk_result,
        savedAt:        new Date().toISOString(),
      };
      dispatch({ type: "SET_BASELINE", payload: snap });

      // Compute per-timepoint risks in parallel
      const tpRisks = await buildTimepointRisks(newSeries, newScai, clinicalInputs, newSupport);
      dispatch({ type: "SET_TIMEPOINT_RISKS", payload: tpRisks });
    } catch (e: unknown) {
      dispatch({ type: "SET_ERROR", payload: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      dispatch({ type: "DONE_LOADING" });
    }
  }, []);

  // ── Calculate Risk ────────────────────────────────────────────────────────
  // • No baseline yet  → predict + auto-save baseline
  // • Baseline exists  → compare automatically (shows directionality)
  // In both cases also compute per-timepoint risks.
  const handleCalculateRisk = useCallback(async () => {
    const allInputs = buildFeatureMap(state.series, state.scai, state.clinicalInputs, state.support);
    if (!state.baseline) {
      dispatch({ type: "LOADING", action: "predict" });
      try {
        const result = await predict(allInputs, true);
        dispatch({ type: "SET_RESULT", payload: result });
        const snap: BaselineSnapshot = {
          featureMap:     result.feature_dict,
          clinicalInputs: { ...state.clinicalInputs },
          rawInputs:      buildBaselineRaw(state.series, state.scai, state.clinicalInputs),
          risk:           result.risk_result,
          savedAt:        new Date().toISOString(),
        };
        dispatch({ type: "SET_BASELINE", payload: snap });

        // Compute per-timepoint risks in parallel
        const tpRisks = await buildTimepointRisks(state.series, state.scai, state.clinicalInputs, state.support);
        dispatch({ type: "SET_TIMEPOINT_RISKS", payload: tpRisks });
      } catch (e: unknown) {
        dispatch({ type: "SET_ERROR", payload: e instanceof Error ? e.message : "Unknown error" });
      } finally {
        dispatch({ type: "DONE_LOADING" });
      }
    } else {
      dispatch({ type: "LOADING", action: "compare" });
      try {
        const cmp = await compare(state.baseline.featureMap, allInputs, true);
        dispatch({ type: "SET_RESULT",  payload: cmp.current });
        dispatch({ type: "SET_COMPARE", payload: cmp });

        // Recompute per-timepoint risks with current inputs
        const tpRisks = await buildTimepointRisks(state.series, state.scai, state.clinicalInputs, state.support);
        dispatch({ type: "SET_TIMEPOINT_RISKS", payload: tpRisks });
      } catch (e: unknown) {
        dispatch({ type: "SET_ERROR", payload: e instanceof Error ? e.message : "Unknown error" });
      } finally {
        dispatch({ type: "DONE_LOADING" });
      }
    }
  }, [state.series, state.scai, state.clinicalInputs, state.support, state.baseline]);

  // ── Recapture baseline ────────────────────────────────────────────────────
  // Called from the drift banner. Re-predicts current inputs as the new baseline.
  const handleRecaptureBaseline = useCallback(async () => {
    dispatch({ type: "LOADING", action: "predict" });
    try {
      const allInputs = buildFeatureMap(state.series, state.scai, state.clinicalInputs, state.support);
      const result    = await predict(allInputs, true);
      dispatch({ type: "SET_RESULT",  payload: result });
      dispatch({ type: "SET_COMPARE", payload: null as unknown as CompareResponse }); // clear old compare
      const snap: BaselineSnapshot = {
        featureMap:     result.feature_dict,
        clinicalInputs: { ...state.clinicalInputs },
        rawInputs:      buildBaselineRaw(state.series, state.scai, state.clinicalInputs),
        risk:           result.risk_result,
        savedAt:        new Date().toISOString(),
      };
      dispatch({ type: "SET_BASELINE", payload: snap });
    } catch (e: unknown) {
      dispatch({ type: "SET_ERROR", payload: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      dispatch({ type: "DONE_LOADING" });
    }
  }, [state.series, state.scai, state.clinicalInputs]);

  const handleIgnoreDrift = useCallback(() => {
    dispatch({ type: "DISMISS_DRIFT" });
  }, []);

  const handleClearBaseline = useCallback(() => {
    dispatch({ type: "CLEAR_BASELINE" });
    setSelectedTp(null);
  }, []);

  const handleReset = useCallback(() => {
    dispatch({ type: "RESET" });
    setSelectedTp(null);
  }, []);

  // ── Explicit save (immediate flush) ──────────────────────────────────────
  const handleSavePatient = useCallback(async () => {
    setSaveStatus("saving");
    try {
      const now = new Date().toISOString();
      await patientDB.save({
        patient_id:      patientId,
        patient_name:    patientName,
        hospital_id:     hospitalId,
        created_at:      patientCreatedAt.current,
        updated_at:      now,
        notes:           null,
        series:          state.series,
        scai:            state.scai,
        support:         state.support,
        clinical_inputs: state.clinicalInputs,
        baseline:        state.baseline,
        baseline_raw:    state.baselineRaw,
        timepoint_risks: state.timepointRisks,
        current_result:  state.currentResult,
        selected_tp:     selectedTp,
      });
      setLastSavedAt(now);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selectedTp, patientId, patientName, hospitalId]);

  // ── Open / restore a saved patient ───────────────────────────────────────
  const handleOpenPatient = useCallback((record: PatientRecord) => {
    dispatch({ type: "SET_SERIES",   payload: record.series });
    dispatch({ type: "SET_SCAI",     payload: record.scai });
    dispatch({ type: "SET_SUPPORT",  payload: record.support });
    dispatch({ type: "SET_CLINICAL", payload: record.clinical_inputs });

    if (record.baseline) {
      dispatch({ type: "SET_BASELINE", payload: record.baseline });
    } else {
      dispatch({ type: "CLEAR_BASELINE" });
    }

    if (record.current_result) {
      dispatch({ type: "SET_RESULT", payload: record.current_result });
    }

    // Restore timepointRisks LAST — CLEAR_BASELINE would have zeroed it.
    dispatch({ type: "SET_TIMEPOINT_RISKS", payload: record.timepoint_risks });

    setSelectedTp(record.selected_tp as Timepoint | null);
    setPatientId(record.patient_id);
    setPatientName(record.patient_name);
    setHospitalId(record.hospital_id);
    patientCreatedAt.current = record.created_at;
    setLastSavedAt(record.updated_at);
    setSaveStatus("saved");
    setShowPatientList(false);
  }, []);

  // ── Handle ?open=1 and ?patient=ID query params from home screen ──────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params       = new URLSearchParams(window.location.search);
    const patientParam = params.get("patient");
    const openParam    = params.get("open");
    if (patientParam) {
      patientDB.getById(patientParam).then((record) => {
        if (record) handleOpenPatient(record);
      }).catch(() => {});
    } else if (openParam === "1") {
      setShowPatientList(true);
    }
  // Run once on mount after handleOpenPatient is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── New patient (flush-saves current, then resets) ────────────────────────
  const handleNewPatient = useCallback(async () => {
    // Flush any pending autosave timer — we'll save immediately below.
    if (autosaveRef.current) clearTimeout(autosaveRef.current);

    const hasData =
      TIMEPOINTS.some((tp) => hasDataAtTimepoint(state.series, tp)) ||
      Object.values(state.clinicalInputs).some((v) => v !== null)   ||
      !!state.baseline;

    if (hasData) {
      await patientDB.save({
        patient_id:      patientId,
        patient_name:    patientName,
        hospital_id:     hospitalId,
        created_at:      patientCreatedAt.current,
        updated_at:      new Date().toISOString(),
        notes:           null,
        series:          state.series,
        scai:            state.scai,
        support:         state.support,
        clinical_inputs: state.clinicalInputs,
        baseline:        state.baseline,
        baseline_raw:    state.baselineRaw,
        timepoint_risks: state.timepointRisks,
        current_result:  state.currentResult,
        selected_tp:     selectedTp,
      }).catch(() => {});
    }

    dispatch({ type: "RESET" });
    setSelectedTp(null);
    setPatientId(generateId());
    setPatientName(null);
    setHospitalId(null);
    setNotes(null);
    setSaveStatus("idle");
    setLastSavedAt(null);
    patientCreatedAt.current = new Date().toISOString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selectedTp, patientId, patientName, hospitalId]);

  // ── Delete current patient ────────────────────────────────────────────────
  const handleDeleteCurrentPatient = useCallback(async () => {
    if (!confirm("Delete this patient record? This action cannot be undone.")) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    await patientDB.delete(patientId).catch(() => {});
    dispatch({ type: "RESET" });
    setSelectedTp(null);
    setPatientId(generateId());
    setPatientName(null);
    setHospitalId(null);
    setNotes(null);
    setSaveStatus("idle");
    setLastSavedAt(null);
    patientCreatedAt.current = new Date().toISOString();
  }, [patientId]);

  // ── File system: import patient from .json ────────────────────────────────
  const handleImport = useCallback(async () => {
    try {
      const record = await importPatientFromFile();
      if (!record) return;
      await patientDB.save(record);
      handleOpenPatient(record);
    } catch (e: unknown) {
      dispatch({ type: "SET_ERROR", payload: e instanceof Error ? e.message : "Import failed" });
    }
  }, [handleOpenPatient]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File system: export current patient as JSON ───────────────────────────
  const handleExport = useCallback(async () => {
    const record: PatientRecord = {
      patient_id:      patientId,
      patient_name:    patientName,
      hospital_id:     hospitalId,
      created_at:      patientCreatedAt.current,
      updated_at:      new Date().toISOString(),
      notes:           null,
      series:          state.series,
      scai:            state.scai,
      support:         state.support,
      clinical_inputs: state.clinicalInputs,
      baseline:        state.baseline,
      baseline_raw:    state.baselineRaw,
      timepoint_risks: state.timepointRisks,
      current_result:  state.currentResult,
      selected_tp:     selectedTp,
    };
    await exportPatientToFile(record).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selectedTp, patientId, patientName, hospitalId]);

  // ── File system: export current patient as CSV/Excel ─────────────────────
  const handleExportExcel = useCallback(async () => {
    const record: PatientRecord = {
      patient_id:      patientId,
      patient_name:    patientName,
      hospital_id:     hospitalId,
      created_at:      patientCreatedAt.current,
      updated_at:      new Date().toISOString(),
      notes:           null,
      series:          state.series,
      scai:            state.scai,
      support:         state.support,
      clinical_inputs: state.clinicalInputs,
      baseline:        state.baseline,
      baseline_raw:    state.baselineRaw,
      timepoint_risks: state.timepointRisks,
      current_result:  state.currentResult,
      selected_tp:     selectedTp,
    };
    await exportPatientExcel(record).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selectedTp, patientId, patientName, hospitalId]);

  // ── File system: Save As (copies current patient to a chosen location) ────
  const handleSaveAs = useCallback(async () => {
    const record: PatientRecord = {
      patient_id:      patientId,
      patient_name:    patientName,
      hospital_id:     hospitalId,
      created_at:      patientCreatedAt.current,
      updated_at:      new Date().toISOString(),
      notes:           null,
      series:          state.series,
      scai:            state.scai,
      support:         state.support,
      clinical_inputs: state.clinicalInputs,
      baseline:        state.baseline,
      baseline_raw:    state.baselineRaw,
      timepoint_risks: state.timepointRisks,
      current_result:  state.currentResult,
      selected_tp:     selectedTp,
    };
    const suggested = `${patientName ?? "patient"}_${new Date().toISOString().slice(0, 10)}.json`;
    await exportPatientToFile(record, suggested).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selectedTp, patientId, patientName, hospitalId]);

  // ── Set default patients folder (persistent, used by autosave) ───────────
  const handleSetPatientsFolder = useCallback(async () => {
    const dir = await pickFolder().catch(() => null);
    if (!dir) return;
    await handleDB.saveHandle(HANDLE_PATIENTS_KEY, dir).catch(() => {});
    setPatientsFolder(dir);
  }, []);

  // ── Set default exports folder ────────────────────────────────────────────
  const handleSetExportsFolder = useCallback(async () => {
    const dir = await pickFolder().catch(() => null);
    if (!dir) return;
    await handleDB.saveHandle(HANDLE_EXPORTS_KEY, dir).catch(() => {});
    setExportsFolder(dir);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  // Show spinner while auth state resolves or redirect is pending
  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1929]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a3a57] border-t-blue-500" />
      </div>
    );
  }

  const showRightPanel = Object.keys(state.timepointRisks).length > 0 || !!state.currentResult || isLoading;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <PatientBar
        patientName={patientName}
        hospitalId={hospitalId}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        hasSavedRecord={lastSavedAt !== null}
        patientsFolderName={patientsFolder?.name ?? null}
        exportsFolderName={exportsFolder?.name ?? null}
        onNew={handleNewPatient}
        onOpenList={() => setShowPatientList(true)}
        onSave={handleSavePatient}
        onDelete={handleDeleteCurrentPatient}
        onImport={handleImport}
        onExport={handleExport}
        onExportExcel={handleExportExcel}
        onSaveAs={handleSaveAs}
        onSetPatientsFolder={handleSetPatientsFolder}
        onSetExportsFolder={handleSetExportsFolder}
        onNameChange={setPatientName}
        onFolioChange={setHospitalId}
      />

      <main className="flex-1 mx-auto w-full max-w-screen-2xl px-4 sm:px-6 xl:px-10 py-8">

        {/* ── Page heading ─────────────────────────────────────────────── */}
        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Risk Assessment Dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              PULSAR XGBoost · In-hospital mortality prediction · Cardiogenic shock
            </p>
          </div>
          {state.metadata && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#1a3a57] bg-[#0f2236] px-3 py-1.5 text-xs text-slate-500">
              <span className="font-mono text-slate-400">{state.metadata.n_features}</span>
              &nbsp;features ·&nbsp;
              <span className="font-mono text-slate-400">{state.metadata.risk_groups.length}</span>
              &nbsp;risk tiers
            </div>
          )}
        </div>

        {/* ── View tabs ──────────────────────────────────────────────── */}
        <div className="mb-6 flex gap-1 rounded-xl border border-[#1a3a57] bg-[#0a1929] p-1 w-fit overflow-x-auto max-w-full">
          {(["clinical", "insights", "disclosures", "copyright"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setActiveView(v)}
              className={clsx(
                "rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
                activeView === v
                  ? "bg-[#152e47] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-300",
              )}
            >
              {v === "clinical" ? "Clinical View" : v === "insights" ? "Model Insights" : v === "disclosures" ? "Disclosures" : "Copyright"}
            </button>
          ))}
        </div>

        {/* ── Metadata loading ─────────────────────────────────────────── */}
        {state.metaLoading && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#1a3a57] bg-[#0f2236] px-5 py-4 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1a3a57] border-t-blue-500" />
            Loading model metadata…
          </div>
        )}

        {/* ── Global error banner ───────────────────────────────────────── */}
        {state.error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-800/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            <span className="mt-0.5 flex-shrink-0 font-bold">!</span>
            <span>{state.error}</span>
            <button
              className="ml-auto flex-shrink-0 text-red-400 hover:text-red-200"
              onClick={() => dispatch({ type: "SET_ERROR", payload: null })}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Drift banner ─────────────────────────────────────────────────── */}
        {state.baseline && baselineDrift && (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-800/50 bg-amber-950/20 px-4 py-3">
            <span className="text-sm font-semibold text-amber-300">⚠ Baseline inputs modified</span>
            <span className="flex-1 text-xs text-amber-600/80 min-w-0">
              The baseline timepoint values have changed since the baseline was captured.
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleRecaptureBaseline}
                disabled={isLoading}
                className="rounded-lg border border-amber-700/60 bg-amber-900/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-900/50 disabled:opacity-50 transition-colors"
              >
                {isLoading ? "Working…" : "Recapture Baseline"}
              </button>
              <button
                onClick={handleIgnoreDrift}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-[#152e47] transition-colors"
              >
                Ignore
              </button>
            </div>
          </div>
        )}

        {activeView === "clinical" && (<>
        {/*
         *
         * DOM order (also mobile / tablet stacking order):
         *   1. Left   — action card + clinical inputs
         *   2. Center — haemodynamic series table + SCAI
         *   3. Trends — Hemodynamic Trends panel (full-width on desktop)
         *   4. Right  — baseline card, risk result, influence
         *
         * Desktop (xl ≥ 1280 px):
         *   Row 1 → [Left: 3 cols] [Center: 6 cols] [Right: 3 cols]
         *   Row 2 → [Trends: full 12 cols]
         *
         * Tablet / mobile (< xl):
         *   Single column stack in DOM order (Left → Center → Trends → Right)
         */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">

          {/* Zone 1 — Left: action card + clinical inputs */}
          <div className="xl:col-span-3 xl:[grid-row:1]">
            <InputPanel
              metadata={state.metadata}
              clinicalInputs={state.clinicalInputs}
              loadingAction={state.loadingAction}
              hasResult={!!state.currentResult}
              onClinicalChange={handleClinicalChange}
              onCalculateRisk={handleCalculateRisk}
              onLoadTestCase={handleLoadTestCase}
              onReset={handleReset}
            />
          </div>

          {/* Zone 2+3 — Center: haemodynamic series + trends stacked */}
          <div className="xl:col-span-6 xl:[grid-row:1] space-y-6">
            <SeriesPanel
              series={state.series}
              scai={state.scai}
              supportSeries={state.support}
              onChange={handleSeriesChange}
              onScaiChange={handleScaiChange}
              onSupportChange={handleSupportChange}
            />
            <HemodynamicTrends series={state.series} />
          </div>

          {/* Zone 4 — Right: baseline card + review + risk result + influence */}
          <div className="xl:col-span-3 xl:col-start-[10] xl:[grid-row:1] space-y-5">

            {/* 1. Risk Timeline selector */}
            {Object.keys(state.timepointRisks).length > 0 && (
              <TimepointRisksPanel
                timepointRisks={state.timepointRisks}
                selectedTp={selectedTp}
                onSelectTp={setSelectedTp}
              />
            )}

            {/* 2. Baseline comparison: baseline vs selectedTp, computed locally */}
            {state.baseline && (
              <BaselineCard
                baseline={state.baseline}
                timepointRisks={state.timepointRisks}
                selectedTp={selectedTp}
                onClear={handleClearBaseline}
              />
            )}

            {/* 3. Risk Assessment for the selected timepoint */}
            {selectedTp && state.timepointRisks[selectedTp] && !isLoading && (
              <ResultPanel
                result={state.timepointRisks[selectedTp]!}
                timepointLabel={TP_LABELS[selectedTp]}
                metadata={state.metadata}
              />
            )}

            {/* 4. Baseline inputs review */}
            {state.baseline && (
              <BaselineReview
                baseline={state.baseline}
                onClear={handleClearBaseline}
              />
            )}

            {isLoading && (
              <div className="card flex flex-col items-center justify-center py-16 text-center animate-fade-in">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#1a3a57] border-t-blue-500" />
                <p className="text-sm font-medium text-slate-300">
                  {state.loadingAction === "predict"  && "Running inference…"}
                  {state.loadingAction === "compare"  && "Comparing vs baseline…"}
                  {state.loadingAction === "testcase" && "Loading test case…"}
                </p>
                <p className="mt-1 text-xs text-slate-600">PULSAR XGBoost · 32 features</p>
              </div>
            )}

            {!showRightPanel && (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#152e47]">
                  <svg
                    className="h-6 w-6 text-slate-500"
                    fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3"
                    />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-300">No prediction yet</p>
                <p className="mt-1.5 text-xs text-slate-600 max-w-[180px]">
                  Fill in the inputs and press{" "}
                  <span className="text-blue-400 font-medium">Calculate Risk</span>.
                </p>
              </div>
            )}
          </div>
        </div>
        </>)}

        {/* ── Disclosures ──────────────────────────────────────────────── */}
        {activeView === "disclosures" && (
          <div className="max-w-3xl space-y-6">

            {/* Intended Use — top amber warning */}
            <div className="rounded-2xl border border-amber-800/50 bg-amber-950/20 p-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-lg">⚠</span>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-amber-300">Intended Use</h3>
                  <p className="mt-2 text-sm text-amber-200/70 leading-relaxed">
                    HEMOSCOREAPP is intended exclusively for research, academic, and educational purposes.
                    It is designed to support scientific exploration and risk stratification research and is{" "}
                    <strong>not</strong> intended to diagnose, treat, cure, prevent, or direct the management
                    of any medical condition. The tool must not be used as the sole basis for clinical
                    decision-making and does not replace physician judgment, multidisciplinary discussion,
                    or institutional protocols.
                  </p>
                </div>
              </div>
            </div>

            {/* About */}
            <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] p-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">About HEMOSCOREAPP / PULSAR</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                HEMOSCOREAPP incorporates the PULSAR model, a gradient-boosted XGBoost classifier developed
                from retrospective multicenter clinical data in patients with cardiogenic shock. The model uses
                serial hemodynamic, laboratory, and mechanical circulatory support variables obtained at
                predefined timepoints (baseline, 6 h, 12 h, 24 h, and 48 h) to estimate the probability of
                in-hospital mortality.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                This application was developed as an investigator-initiated academic project by the{" "}
                <span className="text-slate-300 font-medium">ITA-MEX collaborative group</span>, including
                Jorge A. Ortega-Hernández, MD; Luca Baldetti, MD; Guglielmo Gallone, MD; Giulio Cacioli;
                and Pier Paolo Bocchino, MD, in collaboration with participating academic institutions in
                Mexico and Italy.
              </p>
            </div>

            {/* Model Performance */}
            <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] p-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Model Performance and Validation</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Model performance was evaluated using retrospective data and internal validation procedures
                within the available multicenter dataset. Although the model was developed using data from
                multiple institutions, fully independent prospective external validation has not yet been
                completed. Accordingly, predictive performance may differ across hospitals, clinical
                workflows, patient populations, monitoring systems, and treatment practices not represented
                in the development dataset.
              </p>
            </div>

            {/* Limitations */}
            <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] p-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Limitations</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Predictions generated by HEMOSCOREAPP are probabilistic estimates only and do not represent
                certain outcomes. Model outputs may be affected by missing data, imputed values, measurement
                variability, data-entry errors, or incomplete capture of relevant clinical context. In
                particular, the reliability of predictions depends on the accurate entry of hemodynamic
                variables, laboratory values, SCAI shock stage, and mechanical circulatory support status.
                The model does not account for all therapeutic interventions, evolving goals of care,
                withdrawal of life-sustaining treatment, palliative transitions, or clinician-driven decisions
                occurring after data entry.
              </p>
            </div>

            {/* Data Privacy */}
            <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] p-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Data Privacy and Local Storage</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                All patient information entered into HEMOSCOREAPP is stored locally on the user&apos;s device.
                No patient-identifiable information is intentionally transmitted to external servers, cloud
                services, or third parties as part of routine local use. Where applicable, the inference
                engine processes only the feature data necessary for model estimation.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Users are solely responsible for ensuring compliance with all applicable institutional,
                regional, national, and international requirements governing privacy, confidentiality, and
                protected health information, including but not limited to HIPAA, GDPR, and
                NOM-024-SSA3-2012, as applicable.
              </p>
            </div>

            {/* Regulatory */}
            <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] p-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Regulatory Status</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                HEMOSCOREAPP has not been submitted to, reviewed by, cleared by, or approved by any
                regulatory authority, including but not limited to the U.S. Food and Drug Administration
                (FDA), the European Medicines Agency (EMA), or COFEPRIS. It is not approved as a medical
                device in any jurisdiction.
              </p>
            </div>

            {/* No Warranty */}
            <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] p-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">No Warranty / User Responsibility</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                HEMOSCOREAPP is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis,
                without warranties of any kind, whether express or implied, including but not limited to
                accuracy, completeness, reliability, fitness for a particular purpose, merchantability,
                regulatory suitability, or non-infringement. By using this application, the user
                acknowledges that all interpretation and use of outputs occur at the user&apos;s own
                discretion and sole risk.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                To the maximum extent permitted by applicable law, the developers, collaborators, and
                affiliated institutions of the ITA-MEX group shall not be liable for any direct, indirect,
                incidental, consequential, special, exemplary, clinical, administrative, legal, or economic
                damages arising from or related to the use, misuse, interpretation, reliance upon, or
                inability to use this application or its outputs.
              </p>
            </div>

            {/* Footer */}
            <div className="rounded-xl border border-[#1a3a57] bg-[#0a1929] px-5 py-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-600 uppercase tracking-wide">ITA-MEX Collaborative Group</span>
              <span className="text-xs font-mono text-slate-500">HEMOSCOREAPP · PULSAR XGBoost · Research build · {new Date().getFullYear()}</span>
            </div>

          </div>
        )}

        {/* ── Copyright ────────────────────────────────────────────────── */}
        {activeView === "copyright" && (
          <div className="max-w-3xl space-y-6">

            {/* Header */}
            <div className="rounded-2xl border border-blue-800/40 bg-blue-950/20 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Investigator-Initiated Academic Project</p>
                  <h3 className="mt-0.5 text-lg font-bold text-white">ITA-MEX Collaborative Group</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    &copy; {new Date().getFullYear()} ITA-MEX Collaborative Group. All rights reserved.
                  </p>
                </div>
              </div>
            </div>

            {/* Authors */}
            <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Authors</h3>
              <div className="space-y-3">
                {[
                  { name: "Jorge A. Ortega-Hernández, MD", note: "a,b", lead: true },
                  { name: "Luca Baldetti, MD", note: "c" },
                  { name: "Guglielmo Gallone, MD", note: "d,e" },
                  { name: "Giulio Cacioli", note: "f" },
                  { name: "Pier Paolo Bocchino, MD", note: "d" },
                ].map(({ name, note, lead }) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#152e47] text-xs font-bold text-blue-400">
                      {name.split(" ").filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("")}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-sm font-medium ${lead ? "text-white" : "text-slate-300"}`}>{name}</span>
                      <sup className="text-[10px] text-slate-500">{note}</sup>
                      {lead && <span className="rounded border border-blue-800/60 bg-blue-950/40 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">Corresponding</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Affiliations */}
            <div className="rounded-2xl border border-[#1a3a57] bg-[#0a1929] p-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Affiliations</h3>
              <ol className="space-y-2.5 text-sm text-slate-400 leading-relaxed list-none">
                {[
                  { sup: "a", text: "Instituto Nacional de Cardiología Ignacio Chávez, Coronary Care Unit, Juan Badiano 1, Sección XVI, Tlalpan 14080, Mexico City, Mexico" },
                  { sup: "b", text: "Programa de Maestría y Doctorado en Ciencias Médicas, Odontológicas y de la Salud, Universidad Nacional Autónoma de México, Mexico City, Mexico" },
                  { sup: "c", text: "Cardiac Intensive Care Unit, IRCCS San Raffaele Scientific Institute, Milan, Italy" },
                  { sup: "d", text: "Division of Cardiology, Città della Salute e della Scienza Hospital, Turin, Italy" },
                  { sup: "e", text: "Department of Medical Sciences, University of Turin, Turin, Italy" },
                  { sup: "f", text: "Cardiac Surgery and Heart Transplant Unit, Azienda Ospedaliera San Camillo Forlanini, Rome, Italy" },
                ].map(({ sup, text }) => (
                  <li key={sup} className="flex items-start gap-2">
                    <sup className="mt-1 flex-shrink-0 text-[11px] font-bold text-blue-400">{sup}</sup>
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Footer */}
            <div className="rounded-xl border border-[#1a3a57] bg-[#0a1929] px-5 py-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-600 uppercase tracking-wide">HEMOSCOREAPP · PULSAR XGBoost</span>
              <span className="text-xs font-mono text-slate-500">&copy; {new Date().getFullYear()} ITA-MEX Collaborative Group · Research build</span>
            </div>

          </div>
        )}

        {/* ── Model Insights ───────────────────────────────────────────── */}
        {activeView === "insights" && (
          <div className="space-y-6">
            {state.currentResult ? (
              <InfluencePanel explanation={state.currentResult.explanation ?? null} />
            ) : (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#152e47]">
                  <svg className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-300">No model insights yet</p>
                <p className="mt-1.5 text-xs text-slate-600 max-w-[200px]">
                  Switch to{" "}
                  <span className="text-blue-400 font-medium">Clinical View</span>{" "}
                  and run a prediction first.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />

      {showPatientList && (
        <PatientListModal
          currentPatientId={patientId}
          onOpen={handleOpenPatient}
          onClose={() => setShowPatientList(false)}
        />
      )}
    </div>
  );
}