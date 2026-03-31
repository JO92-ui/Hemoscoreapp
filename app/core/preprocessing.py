"""
app/core/preprocessing.py
Turn a raw, possibly incomplete user-input dict into a numpy array
suitable for model.predict_proba().

Responsibilities
----------------
1. Accept any subset of the 32 feature keys.
2. Silently impute truly invalid values (None, empty string, NaN, ±inf,
   non-numeric strings) using training-set medians/modes from
   pulsar_imputation_values.json.
3. Pass every valid numeric value to the model WITHOUT modification.
   The user's input is the ground truth; we do not clip, round, or coerce.
4. Annotate out-of-reference-range fields as warning metadata only.
   The original numeric value is still used for inference.
5. Enforce the strict feature order required by the model.

No fitting, no scaling, no one-hot encoding – the PULSAR XGBoost model
was trained on raw clinical values without sklearn transformers.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

from app.core.model_loader import ModelBundle

# ──────────────────────────────────────────────────────────────────────────────
# Reference ranges used ONLY for out-of-range warning metadata.
# Values outside these ranges are still passed to the model unchanged.
# ──────────────────────────────────────────────────────────────────────────────
_REFERENCE_RANGES: dict[str, tuple[float, float]] = {
    # Continuous hemodynamic features
    "hr_pacath":               (20.0,   300.0),
    "cpi_rap_pacath":           (0.0,    10.0),
    "lactate":                  (0.1,    30.0),
    "pawp_pacath":              (0.0,    60.0),
    "rap_pacath":               (0.0,    40.0),
    "opp_pacath":               (0.0,   200.0),
    # Delta features
    "hr_pacath_delta":         (-200.0,  200.0),
    "cpi_rap_pacath_delta":    (-10.0,   10.0),
    "lactate_delta":           (-30.0,   30.0),
    "pawp_pacath_delta":       (-60.0,   60.0),
    "rap_pacath_delta":        (-40.0,   40.0),
    "opp_pacath_delta":        (-200.0,  200.0),
    # Cumulative exposure (hours)
    "hr_pacath_tot_hours":      (0.0,  8760.0),
    "cpi_rap_pacath_tot_hours": (0.0,  8760.0),
    "lactate_tot_hours":        (0.0,  8760.0),
    "pawp_pacath_tot_hours":    (0.0,  8760.0),
    "rap_pacath_tot_hours":     (0.0,  8760.0),
    "opp_pacath_tot_hours":     (0.0,  8760.0),
    # Baseline characteristics
    "base_age_years":           (0.0,   120.0),
    "base_cs_etiology":         (0.0,    10.0),
    "base_creatinine":          (0.0,    30.0),
    # Ordinal scores
    "base_scai_admission_num":  (1.0,    5.0),
    "base_scai_max_48h_num":    (1.0,    5.0),
    "scai_worsening":           (0.0,    4.0),
    "base_ventilation":         (0.0,    3.0),
    # Binary (0 / 1)
    "base_sex_female":          (0.0,    1.0),
    "base_diabetes":            (0.0,    1.0),
    "base_hypertension":        (0.0,    1.0),
    "base_iabp":                (0.0,    1.0),
    "base_impella":             (0.0,    1.0),
    "base_ecmo":                (0.0,    1.0),
    "base_renal_replacement_therapy": (0.0, 1.0),
}


# ──────────────────────────────────────────────────────────────────────────────
# Result dataclass
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class PreprocessingResult:
    """Output of the preprocessing step.

    Attributes:
        feature_vector:     Numpy array of shape (1, n_features) ready for
                            model.predict_proba().
        feature_dict:       Dict mapping each feature name to the float value
                            actually used (post-imputation; never clipped).
        imputed_fields:     Names of features that were absent or had an
                            invalid value (None / NaN / inf / non-numeric)
                            and were replaced with the training-set imputation.
        out_of_range_fields: Names of features whose submitted numeric value
                            falls outside the reference range in
                            _REFERENCE_RANGES.  Warning metadata only –
                            the original value was still used for inference.
    """

    feature_vector: np.ndarray
    feature_dict: dict[str, float]
    imputed_fields: list[str]
    out_of_range_fields: list[str]


# ──────────────────────────────────────────────────────────────────────────────
# Public function
# ──────────────────────────────────────────────────────────────────────────────

def preprocess_inputs(
    raw_inputs: dict[str, Any],
    bundle: ModelBundle,
) -> PreprocessingResult:
    """Convert a raw input dict into a model-ready numpy array.

    Only truly unrepresentable values are imputed (None, empty string,
    NaN, ±inf, non-numeric strings).  All valid numeric values are
    forwarded to the model exactly as provided, regardless of whether
    they fall within a physiological reference range.

    Args:
        raw_inputs: Dict of {feature_name: value} from the UI.  May be
                    partial – any of the 32 features can be omitted.  Extra
                    keys that are not model features are silently ignored.
        bundle:     Loaded ModelBundle (from model_loader.load_model_bundle).

    Returns:
        PreprocessingResult with the numpy feature vector and audit metadata.
    """
    imputed_fields: list[str] = []
    out_of_range_fields: list[str] = []
    feature_dict: dict[str, float] = {}

    for feat in bundle.features:
        raw_val = raw_inputs.get(feat)
        was_imputed = False

        # ── Resolve to a finite float or fall back to imputation ──────────────
        if raw_val is None or raw_val == "":
            value = bundle.imputation[feat]
            was_imputed = True
        else:
            # self-inequality test catches float NaN
            if isinstance(raw_val, float) and raw_val != raw_val:
                value = bundle.imputation[feat]
                was_imputed = True
            else:
                try:
                    value = float(raw_val)
                    if not np.isfinite(value):
                        value = bundle.imputation[feat]
                        was_imputed = True
                except (TypeError, ValueError):
                    value = bundle.imputation[feat]
                    was_imputed = True

        if was_imputed:
            imputed_fields.append(feat)

        # ── Out-of-range warning (no modification to value) ───────────────────
        if not was_imputed and feat in _REFERENCE_RANGES:
            lo, hi = _REFERENCE_RANGES[feat]
            if value < lo or value > hi:
                out_of_range_fields.append(feat)

        feature_dict[feat] = value

    # Build ordered numpy array (shape 1 × n_features)
    vector = np.array(
        [feature_dict[f] for f in bundle.features],
        dtype=np.float64,
    ).reshape(1, -1)

    return PreprocessingResult(
        feature_vector=vector,
        feature_dict=feature_dict,
        imputed_fields=imputed_fields,
        out_of_range_fields=out_of_range_fields,
    )
