/**
 * Synthetic multi-timepoint case for UI demonstration.
 *
 * Clinical scenario: 63-year-old male, AMI-CS, SCAI C on admission.
 * Typical trajectory: initial deterioration to SCAI D at 6–12 h,
 * then progressive recovery to SCAI C by 24–48 h with IABP support.
 *
 * Timepoints: baseline (0 h) → 6 h → 12 h → 24 h → 48 h
 *
 * Clinical thresholds (for reference):
 *   HR        ≥ 100 bpm     → bad
 *   CPI-RAP   ≤ 0.28 W/m²   → off target
 *   Lactate   ≥ 2.0 mmol/L  → bad
 *   PAWP      ≥ 18 mmHg     → bad
 *   RAP       ≥ 12 mmHg     → bad
 *   OPP       < 57 mmHg     → bad
 */

import type { SeriesState, SeriesValues, ScaiValues, SupportSeries } from "@/lib/series";

/** Returns a fresh SeriesState populated with all 5 timepoints. */
export function makeTestCaseSeries(): SeriesState {
  return {
    //            baseline    6h      12h     24h     48h
    hr:      { baseline: 110, "6h": 116, "12h": 108, "24h": 100, "48h":  92 },
    cpi_rap: { baseline: 0.20,"6h": 0.17, "12h": 0.23,"24h": 0.29,"48h": 0.35 },
    lactate: { baseline: 3.4, "6h": 3.9,  "12h": 2.9, "24h": 2.2, "48h": 1.9  },
    pawp:    { baseline: 24,  "6h": 27,   "12h": 23,  "24h": 20,  "48h": 17   },
    rap:     { baseline: 15,  "6h": 18,   "12h": 15,  "24h": 13,  "48h": 11   },
    opp:     { baseline: 52,  "6h": 44,   "12h": 57,  "24h": 64,  "48h": 71   },
  };
}

/** Returns a fresh ScaiValues with all 5 timepoints set.
 *  Trajectory: C → D → D → C → C (typical AMI-CS worsening then recovery). */
export function makeTestCaseScai(): ScaiValues {
  return { baseline: 3, "6h": 4, "12h": 4, "24h": 3, "48h": 3 };
}

/** Support-device time series for the test case.
 *  Clinical scenario: IABP from admission, IMV weaned to NIV at 12 h then off. */
export function makeTestCaseSupportSeries(): SupportSeries {
  return {
    base_iabp:                      { baseline: 1,  "6h": 1,  "12h": 1,  "24h": 1,  "48h": 1  },
    base_impella:                   { baseline: 0,  "6h": 0,  "12h": 0,  "24h": 0,  "48h": 0  },
    base_ecmo:                      { baseline: 0,  "6h": 0,  "12h": 0,  "24h": 0,  "48h": 0  },
    base_ventilation:               { baseline: 2,  "6h": 2,  "12h": 1,  "24h": 1,  "48h": 0  },
    base_renal_replacement_therapy: { baseline: 0,  "6h": 0,  "12h": 0,  "24h": 0,  "48h": 0  },
  };
}

/** Clinical inputs for the test case patient (non-support fields only). */
export const TEST_CASE_CLINICAL: Record<string, number | null> = {
  base_age_years:    63,
  base_sex_female:   0,   // Male
  base_diabetes:     0,
  base_hypertension: 1,
  base_cs_etiology:  1,   // AMI-CS
  base_creatinine:   1.4,
};

export const SYNTHETIC_CASES = [
  {
    id: "recovery",
    label: "Recovery after initial worsening",
    description: "AMI-CS with an early rise in lactate, followed by improving perfusion over 48 hours.",
  },
  {
    id: "stable",
    label: "Stable haemodynamics",
    description: "HF-CS with little change in measured perfusion, filling pressures or SCAI stage.",
  },
  {
    id: "deterioration",
    label: "Progressive deterioration",
    description: "HF-CS with rising lactate, falling perfusion pressure and increasing support.",
  },
] as const;

export type SyntheticCaseId = (typeof SYNTHETIC_CASES)[number]["id"];

function measurements(baseline: number, h6: number, h12: number, h24: number, h48: number): SeriesValues {
  return { baseline, "6h": h6, "12h": h12, "24h": h24, "48h": h48 };
}

function noSupport(): SupportSeries {
  return {
    base_iabp: measurements(0, 0, 0, 0, 0),
    base_impella: measurements(0, 0, 0, 0, 0),
    base_ecmo: measurements(0, 0, 0, 0, 0),
    base_ventilation: measurements(0, 0, 0, 0, 0),
    base_renal_replacement_therapy: measurements(0, 0, 0, 0, 0),
  };
}

/** Return fresh, invented inputs. The recovery case is also the API smoke fixture. */
export function makeSyntheticCase(id: SyntheticCaseId): {
  series: SeriesState;
  scai: ScaiValues;
  support: SupportSeries;
  clinicalInputs: Record<string, number | null>;
} {
  switch (id) {
    case "recovery":
      return {
        series: makeTestCaseSeries(),
        scai: makeTestCaseScai(),
        support: makeTestCaseSupportSeries(),
        clinicalInputs: { ...TEST_CASE_CLINICAL },
      };
    case "stable":
      return {
        series: {
          hr: measurements(89, 91, 88, 87, 88),
          cpi_rap: measurements(0.33, 0.34, 0.34, 0.35, 0.35),
          lactate: measurements(2.1, 1.9, 1.8, 1.8, 1.7),
          pawp: measurements(18, 18, 17, 17, 17),
          rap: measurements(10, 10, 10, 9, 9),
          opp: measurements(63, 64, 64, 65, 65),
        },
        scai: measurements(3, 3, 3, 3, 3),
        support: noSupport(),
        clinicalInputs: {
          base_age_years: 56,
          base_sex_female: 1,
          base_diabetes: 0,
          base_hypertension: 0,
          base_cs_etiology: 2,
          base_creatinine: 1.1,
        },
      };
    case "deterioration":
      return {
        series: {
          hr: measurements(92, 109, 116, 122, 127),
          cpi_rap: measurements(0.35, 0.27, 0.23, 0.19, 0.16),
          lactate: measurements(1.7, 3.4, 4.8, 6.4, 7.2),
          pawp: measurements(17, 22, 24, 26, 27),
          rap: measurements(10, 13, 15, 17, 18),
          opp: measurements(66, 56, 51, 47, 44),
        },
        scai: measurements(3, 3, 4, 4, 4),
        support: {
          ...noSupport(),
          base_ventilation: measurements(0, 0, 0, 1, 1),
        },
        clinicalInputs: {
          base_age_years: 65,
          base_sex_female: 0,
          base_diabetes: 1,
          base_hypertension: 1,
          base_cs_etiology: 2,
          base_creatinine: 1.6,
        },
      };
  }
}
