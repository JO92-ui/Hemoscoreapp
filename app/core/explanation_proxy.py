"""
app/core/explanation_proxy.py
Model explanation proxy for HEMOSCOREAPP.

Design rationale
----------------
This module implements a non-causal heuristic called ICE-delta
(Individual Conditional Expectation delta) to surface probable local
influences of individual input values on the predicted risk score.

Algorithm:
  1. Build a population-median reference row using all imputation values.
  2. Compute the baseline prediction probability (p_base) for that row.
  3. For each feature in turn, substitute that feature's patient value
     while keeping all other features at their reference values.
  4. Compute the perturbed probability (p_i).
  5. local_influence_i = p_i - p_base  (signed, marginal, non-interactive).
  6. Sort features by |local_influence_i|, return top-N annotated entries.

Important limitations (reflected verbatim in all text fields):
  - Results are a non-causal heuristic, NOT causal attribution.
  - This method is NOT equivalent to SHAP or LIME.
  - Feature interactions are NOT captured (one-at-a-time perturbation).
  - Direction labels express probable local model behaviour, not patient
    physiology or clinical causation.
  - Low-magnitude effects are explicitly flagged as uncertain.

Complexity: n_features + 1 forward passes ≈ 1-5 ms on CPU for XGBoost.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np

from app.core.model_loader import ModelBundle

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────────────────────────────────────

# |delta| below this threshold is treated as negligible / uncertain.
_UNCERTAINTY_THRESHOLD: float = 0.005   # 0.5 percentage points

METHOD_NAME: str = "perturbation_proxy_ice_delta"

EXPLANATION_METHOD: str = (
    "Model Explanation Proxy – ICE-delta (non-causal heuristic)"
)

EXPLANATION_DISCLAIMER: str = (
    "MODEL EXPLANATION PROXY — The values below are non-causal heuristic "
    "estimates of probable local model influence, computed by one-at-a-time "
    "feature perturbation (ICE-delta method). They are NOT equivalent to SHAP, "
    "LIME, or any causal attribution method. Feature interactions are not "
    "captured. Direction labels reflect isolated marginal model behaviour and "
    "do NOT imply clinical causation. For research use only. Do not use as "
    "the sole basis for clinical decisions."
)

INTERPRETATION_NOTE: str = (
    "Each entry shows the isolated change in predicted probability that occurs "
    "when this feature is set to the patient\u2019s value while all other features "
    "remain at population-median reference values. This is a local, marginal, "
    "non-interactive estimate. Interaction effects between features are not "
    "reflected. Features with |\u0394p| \u2264 0.5\u202f% are marked as neutral/uncertain."
)

# Features to always surface in top-N even when their delta is small,
# because they carry high clinical relevance in cardiogenic shock.
_ALWAYS_SHOW: frozenset[str] = frozenset({
    "lactate",
    "base_scai_admission_num",
    "base_scai_max_48h_num",
    "scai_worsening",
    "base_creatinine",
    "cpi_rap_pacath",
})


# ──────────────────────────────────────────────────────────────────────────────
# DataClasses
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class FeatureContribution:
    """Probable local influence of a single feature on the predicted risk.

    Attributes:
        feature:           Feature name (as in pulsar_features.json).
        patient_value:     The value actually used for this patient.
        reference_value:   Population median/mode used as the baseline
                           (from pulsar_imputation_values.json).
        delta_probability: Marginal change in predicted probability when this
                           feature is substituted from reference to patient
                           value in isolation (non-causal, non-interactive).
                           Positive: probable local upward influence.
                           Negative: probable local downward influence.
        direction:         Internal direction code: "up", "down", or "uncertain".
        direction_label:   Human-readable label ready for UI display.
                           One of:
                             "likely pushes risk up"
                             "likely pushes risk down"
                             "neutral / uncertain"
        importance_rank:   1-based rank by |delta_probability| among all features.
    """

    feature: str
    patient_value: float
    reference_value: float
    delta_probability: float
    direction: str
    direction_label: str
    importance_rank: int


@dataclass
class ExplanationResult:
    """Non-causal heuristic explanation for a single model prediction.

    Attributes:
        method:               Short identifier of the computation method.
        explanation_method:   Human-readable method name for display.
        explanation_disclaimer: Mandatory full disclaimer string for the UI.
        interpretation_note:  Guidance on how to interpret the values.
        baseline_probability: Probability when all features are at their
                              population-median reference values.
        top_increasing:       Up to ``top_n`` features with probable local
                              upward influence, sorted by |delta| descending.
        top_decreasing:       Up to ``top_n`` features with probable local
                              downward influence, sorted by |delta| descending.
        all_contributions:    Full sorted list of all feature contributions
                              (for detailed view or export).
    """

    method: str
    explanation_method: str
    explanation_disclaimer: str
    interpretation_note: str
    baseline_probability: float
    top_increasing: list[FeatureContribution]
    top_decreasing: list[FeatureContribution]
    all_contributions: list[FeatureContribution]


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _predict_single(model, row: np.ndarray) -> float:
    """Run predict_proba on a single (1, n_features) row and return p(death)."""
    return float(model.predict_proba(row)[0, 1])


def _build_reference_row(bundle: ModelBundle) -> np.ndarray:
    """Build the all-imputed population-median reference row (1, n_features)."""
    return np.array(
        [bundle.imputation[f] for f in bundle.features],
        dtype=np.float64,
    ).reshape(1, -1)


def _direction_label(delta: float) -> tuple[str, str]:
    """Return (direction_code, direction_label) for a delta value.

    delta below the uncertainty threshold in absolute value is treated as
    neutral/uncertain regardless of sign.

    Returns:
        Tuple of (direction_code, direction_label) where direction_code is
        one of 'up', 'down', 'uncertain' and direction_label is the
        human-readable string ready for UI display.
    """
    if abs(delta) <= _UNCERTAINTY_THRESHOLD:
        return "uncertain", "neutral / uncertain"
    if delta > 0:
        return "up", "likely pushes risk up"
    return "down", "likely pushes risk down"


# ──────────────────────────────────────────────────────────────────────────────
# Public function
# ──────────────────────────────────────────────────────────────────────────────

def build_explanation(
    feature_dict: dict[str, float],
    bundle: ModelBundle,
    *,
    top_n: int = 5,
) -> ExplanationResult:
    """Compute probable local feature influences via the ICE-delta proxy.

    For each feature the patient value is substituted into an otherwise
    population-median row and the marginal change in predicted probability
    is recorded.  This is a non-causal heuristic and does not capture
    feature interactions.

    Args:
        feature_dict: Final feature values used for the prediction (output of
                      PreprocessingResult.feature_dict).
        bundle:       Loaded ModelBundle.
        top_n:        How many features to surface in top_increasing /
                      top_decreasing lists.  Defaults to 5.

    Returns:
        ExplanationResult with contribution lists and all disclaimer fields.
    """
    # ── Step 1: reference baseline (population-median row) ────────────────────
    ref_row = _build_reference_row(bundle)
    try:
        p_base = _predict_single(bundle.model, ref_row)
    except Exception as exc:
        logger.error("ExplanationProxy: failed to compute baseline: %s", exc)
        return _empty_explanation()

    # ── Step 2: perturbation loop ─────────────────────────────────────────────
    raw_deltas: list[tuple[str, float, float, float]] = []
    # elements: (feature_name, patient_value, reference_value, delta)

    for i, feat in enumerate(bundle.features):
        patient_val = feature_dict[feat]
        ref_val = bundle.imputation[feat]

        if patient_val == ref_val:
            raw_deltas.append((feat, patient_val, ref_val, 0.0))
            continue

        row = ref_row.copy()
        row[0, i] = patient_val
        try:
            p_i = _predict_single(bundle.model, row)
            delta = p_i - p_base
        except Exception as exc:
            logger.warning(
                "ExplanationProxy: perturbation failed for '%s': %s", feat, exc
            )
            delta = 0.0

        raw_deltas.append((feat, patient_val, ref_val, delta))

    # ── Step 3: sort by |delta| descending and build contribution objects ──────
    raw_deltas.sort(key=lambda t: abs(t[3]), reverse=True)

    contributions: list[FeatureContribution] = []
    for rank, (feat, pval, rval, delta) in enumerate(raw_deltas, start=1):
        code, label = _direction_label(delta)
        contributions.append(
            FeatureContribution(
                feature=feat,
                patient_value=round(pval, 6),
                reference_value=round(rval, 6),
                delta_probability=round(delta, 6),
                direction=code,
                direction_label=label,
                importance_rank=rank,
            )
        )

    # ── Step 4: build top-N lists, honouring _ALWAYS_SHOW ────────────────────
    # Uncertain contributions are excluded from directional top lists
    # (they may still appear in all_contributions for full transparency).
    increasing = [
        c for c in contributions
        if c.direction == "up"
    ]
    decreasing = [
        c for c in contributions
        if c.direction == "down"
    ]

    top_increasing = _top_with_priority(increasing, top_n)
    top_decreasing = _top_with_priority(decreasing, top_n)

    return ExplanationResult(
        method=METHOD_NAME,
        explanation_method=EXPLANATION_METHOD,
        explanation_disclaimer=EXPLANATION_DISCLAIMER,
        interpretation_note=INTERPRETATION_NOTE,
        baseline_probability=round(p_base, 6),
        top_increasing=top_increasing,
        top_decreasing=top_decreasing,
        all_contributions=contributions,
    )


def _top_with_priority(
    candidates: list[FeatureContribution],
    top_n: int,
) -> list[FeatureContribution]:
    """Return up to top_n contributions, prioritising _ALWAYS_SHOW features."""
    priority: list[FeatureContribution] = []
    normal: list[FeatureContribution] = []

    for c in candidates:
        if c.feature in _ALWAYS_SHOW:
            priority.append(c)
        else:
            normal.append(c)

    # Priority features first (already sorted by |delta|), then normal.
    return (priority + normal)[:top_n]


def _empty_explanation() -> ExplanationResult:
    """Return a safe empty ExplanationResult when perturbation fails entirely."""
    return ExplanationResult(
        method=METHOD_NAME,
        explanation_method=EXPLANATION_METHOD,
        explanation_disclaimer=EXPLANATION_DISCLAIMER,
        interpretation_note=INTERPRETATION_NOTE,
        baseline_probability=float("nan"),
        top_increasing=[],
        top_decreasing=[],
        all_contributions=[],
    )
