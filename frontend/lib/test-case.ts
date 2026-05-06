/**
 * Rich multi-timepoint test case for UI demonstration.
 *
 * Clinical scenario: 63-year-old male, AMI-CS, SCAI C on admission.
 * Typical trajectory: initial deterioration to SCAI D at 6–12 h,
 * then progressive recovery to SCAI C by 24–48 h with IABP support.
 *
 * Timepoints: baseline (0 h) → 6 h → 12 h → 24 h → 48 h
 *
 * Clinical thresholds (for reference):
 *   HR        ≥ 100 bpm     → bad
 *   CPI/RAP   < 0.28        → bad
 *   Lactate   ≥ 2.0 mmol/L  → bad
 *   PAWP      ≥ 18 mmHg     → bad
 *   RAP       ≥ 12 mmHg     → bad
 *   OPP       < 57 mmHg     → bad
 */

import type { SeriesState, ScaiValues, SupportSeries } from "@/lib/series";

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
