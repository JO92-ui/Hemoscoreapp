"""
app/utils/friendly_labels.py
Clinical-friendly display labels, unit suffixes, and tooltip text for every
PULSAR model feature.
"""

from __future__ import annotations

# ──────────────────────────────────────────────────────────────────────────────
# (label, unit)  –  one entry per model feature
# ──────────────────────────────────────────────────────────────────────────────
FEATURE_LABELS: dict[str, tuple[str, str]] = {
    # ── A. Hemodynamics – Current ─────────────────────────────────────────────
    "hr_pacath":            ("Heart Rate  (PA Cath)",              "bpm"),
    "cpi_rap_pacath":       ("CPI – RAP",                          "W/m²"),
    "lactate":              ("Lactate",                            "mmol/L"),
    "pawp_pacath":          ("PAWP  (PA Cath)",                    "mmHg"),
    "rap_pacath":           ("RAP  (PA Cath)",                     "mmHg"),
    "opp_pacath":           ("OPP  (PA Cath)",                     "mmHg"),

    # ── B. Hemodynamics – Delta ───────────────────────────────────────────────
    "hr_pacath_delta":          ("Δ Heart Rate  (PA Cath)",        "bpm"),
    "cpi_rap_pacath_delta":     ("Δ CPI – RAP",                    "W/m²"),
    "lactate_delta":            ("Δ Lactate",                      "mmol/L"),
    "pawp_pacath_delta":        ("Δ PAWP  (PA Cath)",              "mmHg"),
    "rap_pacath_delta":         ("Δ RAP  (PA Cath)",               "mmHg"),
    "opp_pacath_delta":         ("Δ OPP  (PA Cath)",               "mmHg"),

    # ── C. Time Off Target – Hours ────────────────────────────────────────────
    "hr_pacath_tot_hours":          ("TOT Hours — Heart Rate",     "h"),
    "cpi_rap_pacath_tot_hours":     ("TOT Hours — CPI-RAP",        "h"),
    "lactate_tot_hours":            ("TOT Hours — Lactate",        "h"),
    "pawp_pacath_tot_hours":        ("TOT Hours — PAWP",           "h"),
    "rap_pacath_tot_hours":         ("TOT Hours — RAP",            "h"),
    "opp_pacath_tot_hours":         ("TOT Hours — OPP",            "h"),

    # ── D. Clinical Fixed Variables ───────────────────────────────────────────
    "base_age_years":               ("Age",                        "years"),
    "base_sex_female":              ("Sex",                        ""),
    "base_diabetes":                ("Diabetes",                   ""),
    "base_hypertension":            ("Hypertension",               ""),
    "base_cs_etiology":             ("CS Etiology",                ""),
    "base_creatinine":              ("Creatinine  (baseline)",     "mg/dL"),

    # ── E. Shock Severity – SCAI ──────────────────────────────────────────────
    "base_scai_admission_num":      ("SCAI Stage — Admission",     ""),
    "base_scai_max_48h_num":        ("SCAI Stage — Max 48 h",      ""),
    "scai_worsening":               ("SCAI Stage Worsening",       "stages"),

    # ── F. Mechanical & Organ Support ────────────────────────────────────────
    "base_iabp":                      ("IABP",                       ""),
    "base_impella":                   ("Impella",                    ""),
    "base_ecmo":                      ("VA-ECMO",                    ""),
    "base_ventilation":               ("Mechanical Ventilation",     ""),
    "base_renal_replacement_therapy": ("Renal Replacement Therapy",  ""),
}

# ──────────────────────────────────────────────────────────────────────────────
# Short tooltip text for complex or non-obvious variables
# ──────────────────────────────────────────────────────────────────────────────
FEATURE_TOOLTIPS: dict[str, str] = {
    "cpi_rap_pacath": (
        "Cardiac Power Index minus Right Atrial Pressure — PA-catheter composite "
        "hemodynamic adequacy index.  Higher values indicate better RV-LV coupling."
    ),
    "cpi_rap_pacath_delta": (
        "Change in CPI-RAP between the two most recent PA catheter assessments."
    ),
    "opp_pacath": (
        "Oscillatory Pulse Pressure — derived from PA catheter waveform.  "
        "Marker of vascular pulsatility and right-heart interaction."
    ),
    "opp_pacath_delta": (
        "Change in OPP between the two most recent PA catheter assessments."
    ),
    "hr_pacath_tot_hours": (
        "Cumulative hours heart rate was outside the predefined target range "
        "(Time Off Target = TOT)."
    ),
    "cpi_rap_pacath_tot_hours": (
        "Cumulative hours CPI-RAP remained below the target threshold."
    ),
    "lactate_tot_hours": (
        "Cumulative hours serum lactate was elevated above target (> 2 mmol/L)."
    ),
    "pawp_pacath_tot_hours": (
        "Cumulative hours PAWP exceeded target range (> 18 mmHg)."
    ),
    "rap_pacath_tot_hours": (
        "Cumulative hours RAP exceeded target range (> 14 mmHg)."
    ),
    "opp_pacath_tot_hours": (
        "Cumulative hours OPP was outside the target range."
    ),
    "base_scai_admission_num": (
        "SCAI Cardiogenic Shock Classification at hospital admission  "
        "(A = At Risk  →  E = Extremis)."
    ),
    "base_scai_max_48h_num": (
        "Highest SCAI stage observed during the first 48 hours in the ICU."
    ),
    "scai_worsening": (
        "Net SCAI stage increase from admission to maximum 48-hour stage  "
        "(0 = unchanged or improved;  1–4 = stages worsened)."
    ),
    "base_cs_etiology": (
        "Primary aetiology of cardiogenic shock:  "
        "AMI-CS (acute MI-related)  or  HF-CS (de-novo heart failure-related)."
    ),
    "base_renal_replacement_therapy": (
        "Whether continuous renal replacement therapy (CRRT) or intermittent "
        "haemodialysis was initiated during the current admission."
    ),
}


# ──────────────────────────────────────────────────────────────────────────────
# Public helpers
# ──────────────────────────────────────────────────────────────────────────────

def get_label(feature: str) -> str:
    """Return the friendly display label for *feature*.

    Falls back to a humanised version of the technical name if no explicit
    mapping exists (strips ``base_`` prefix, replaces underscores, title-cases).
    """
    if feature in FEATURE_LABELS:
        return FEATURE_LABELS[feature][0]
    name = feature.removeprefix("base_")
    return name.replace("_", " ").title()


def get_unit(feature: str) -> str:
    """Return the measurement unit suffix for *feature*, or an empty string."""
    return FEATURE_LABELS.get(feature, ("", ""))[1]


def get_tooltip(feature: str) -> str:
    """Return the tooltip text for *feature*, or an empty string."""
    return FEATURE_TOOLTIPS.get(feature, "")
