/**
 * Rich multi-timepoint test case for UI demonstration.
 *
 * Clinical scenario: 63-year-old male, AMI-CS, SCAI E on admission.
 * Haemodynamics show a clear improving trajectory (all 6 variables cross
 * their clinical thresholds over the 48-hour monitoring window).
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
    hr:      { baseline: 108, "6h": 103, "12h":  98, "24h":  95, "48h":  92 },
    cpi_rap: { baseline: 0.18,"6h": 0.22, "12h": 0.28,"24h": 0.32,"48h": 0.35 },
    lactate: { baseline: 4.8, "6h": 3.6,  "12h": 2.8, "24h": 2.1, "48h": 1.9  },
    pawp:    { baseline: 26,  "6h": 23,   "12h": 21,  "24h": 19,  "48h": 17   },
    rap:     { baseline: 20,  "6h": 17,   "12h": 15,  "24h": 13,  "48h": 11   },
    opp:     { baseline: 43,  "6h": 52,   "12h": 60,  "24h": 66,  "48h": 71   },
  };
}

/** Returns a fresh ScaiValues with baseline and 48 h set. */
export function makeTestCaseScai(): ScaiValues {
  return { baseline: 5, "6h": null, "12h": null, "24h": null, "48h": 5 };
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
