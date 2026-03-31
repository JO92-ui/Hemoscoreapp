"""
app/core/inference_service.py
High-level inference façade for HEMOSCOREAPP.

This is the only module the UI layer needs to import from app.core.
It orchestrates model loading, preprocessing, prediction, risk
categorisation, and explanation generation.

Typical UI usage:
    from app.core.inference_service import InferenceService

    service = InferenceService()            # lazy-loads model on first call
    result = service.predict_from_inputs({
        "lactate": 3.5,
        "base_scai_admission_num": 4,
        ...  # partial input is fine
    })

    print(result.risk_percent)              # e.g. 38.2
    print(result.risk_result.label)         # "High (25–<50%)"
    print(result.explanation.top_increasing[0].feature)

For baseline-vs-current comparison:
    comparison = service.compare(baseline_inputs, current_inputs)
    print(comparison.change_label.value)    # "worsened" | "improved" | "unchanged"
    print(comparison.category_shift)        # "Intermediate → High"
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from app.core.explanation_proxy import ExplanationResult, build_explanation
from app.core.model_loader import ModelBundle, load_model_bundle
from app.core.preprocessing import PreprocessingResult, preprocess_inputs
from app.core.risk_logic import ComparisonResult, RiskResult, categorize_risk, compare_predictions
from app.utils.formatters import now_display

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Result dataclass
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class PredictionResult:
    """Complete output of a single inference call.

    Attributes:
        probability:       Raw predicted probability of in-hospital death (0–1).
        risk_percent:      Probability as a percentage, rounded to 1 decimal.
        risk_result:       Full RiskResult (label, category enum, probability).
        imputed_fields:      Feature names that were absent or had an invalid
                             value and were filled from the imputation table.
        out_of_range_fields: Feature names whose submitted value fell outside
                             the clinical reference range (warning only –
                             original value was used for inference).
        feature_dict:        Final feature values used (imputed where invalid;
                             never clipped or coerced).
        explanation:       ExplanationResult with perturbation-proxy contributions.
        timestamp:         Human-readable datetime of the prediction.
        model_name:        Identifier from preprocessing_spec.json.
    """

    probability: float
    risk_percent: float
    risk_result: RiskResult
    imputed_fields: list[str]
    out_of_range_fields: list[str]
    feature_dict: dict[str, float]
    explanation: ExplanationResult
    timestamp: str
    model_name: str


# ──────────────────────────────────────────────────────────────────────────────
# Service class
# ──────────────────────────────────────────────────────────────────────────────

class InferenceService:
    """Stateless inference service with a lazily loaded ModelBundle cache.

    The service can be instantiated cheaply multiple times – the underlying
    model is loaded once and shared via the module-level cache in
    model_loader.py.

    Args:
        explanation_top_n: How many features to surface in the explanation's
                           top-increasing / top-decreasing lists (default 5).
    """

    def __init__(self, *, explanation_top_n: int = 5) -> None:
        self._top_n = explanation_top_n
        self._bundle: ModelBundle | None = None

    # ── Bundle access ─────────────────────────────────────────────────────────

    def _get_bundle(self) -> ModelBundle:
        """Return the cached ModelBundle, triggering a load on first access."""
        if self._bundle is None:
            self._bundle = load_model_bundle()
        return self._bundle

    def reload_model(self) -> None:
        """Force-reload all artefacts from disk (useful after file updates)."""
        self._bundle = load_model_bundle(force_reload=True)
        logger.info("InferenceService: ModelBundle reloaded.")

    # ── Primary public API ────────────────────────────────────────────────────

    def predict_from_inputs(
        self,
        raw_inputs: dict[str, Any],
        *,
        include_explanation: bool = True,
    ) -> PredictionResult:
        """Run end-to-end inference from a raw input dict.

        Missing features are silently imputed.  The call is safe to make
        from the main GUI thread – it typically completes in < 10 ms.

        Args:
            raw_inputs:          Dict of {feature_name: value}.  Any of the
                                 32 model features can be omitted.  Extra keys
                                 that are not model features are ignored.
            include_explanation: If False, the explanation step is skipped and
                                 ExplanationResult will have empty lists.  Use
                                 this when you only need the number quickly
                                 (e.g. live slider updates).

        Returns:
            PredictionResult with all inference artefacts.

        Raises:
            RuntimeError: If the model cannot be loaded or prediction fails.
        """
        bundle = self._get_bundle()

        # ── 1. Preprocess ──────────────────────────────────────────────────────
        prep: PreprocessingResult = preprocess_inputs(raw_inputs, bundle)

        # ── 2. Predict ────────────────────────────────────────────────────────
        try:
            proba_array = bundle.model.predict_proba(prep.feature_vector)
            probability = float(proba_array[0, 1])
        except Exception as exc:
            raise RuntimeError(
                f"Model prediction failed: {exc}"
            ) from exc

        # ── 3. Risk categorisation ────────────────────────────────────────────
        risk_result: RiskResult = categorize_risk(probability, bundle)

        # ── 4. Explanation proxy ──────────────────────────────────────────────
        if include_explanation:
            explanation = build_explanation(
                prep.feature_dict,
                bundle,
                top_n=self._top_n,
            )
        else:
            from app.core.explanation_proxy import (
                ExplanationResult,
                METHOD_NAME,
                EXPLANATION_METHOD,
                EXPLANATION_DISCLAIMER,
                INTERPRETATION_NOTE,
            )
            explanation = ExplanationResult(
                method=METHOD_NAME,
                explanation_method=EXPLANATION_METHOD,
                explanation_disclaimer=EXPLANATION_DISCLAIMER,
                interpretation_note=INTERPRETATION_NOTE,
                baseline_probability=float("nan"),
                top_increasing=[],
                top_decreasing=[],
                all_contributions=[],
            )

        return PredictionResult(
            probability=probability,
            risk_percent=risk_result.risk_percent,
            risk_result=risk_result,
            imputed_fields=prep.imputed_fields,
            out_of_range_fields=prep.out_of_range_fields,
            feature_dict=prep.feature_dict,
            explanation=explanation,
            timestamp=now_display(),
            model_name=bundle.spec.get("model_name", "PULSAR XGBoost"),
        )

    # ── Comparison API ────────────────────────────────────────────────────────

    def compare(
        self,
        baseline_inputs: dict[str, Any],
        current_inputs: dict[str, Any],
        *,
        include_explanation: bool = False,
    ) -> ComparisonResult:
        """Compare a baseline measurement with a current measurement.

        Both input dicts are run through the full prediction pipeline.
        Explanations for comparisons are disabled by default to keep
        the response fast; pass ``include_explanation=True`` to enable
        them (they will only be computed for the *current* run).

        Args:
            baseline_inputs:     Input dict for the earlier assessment.
            current_inputs:      Input dict for the more recent assessment.
            include_explanation: Whether to generate an explanation for the
                                 current prediction (default False).

        Returns:
            ComparisonResult with deltas, change label, and category shift.
        """
        bundle = self._get_bundle()

        baseline_prep = preprocess_inputs(baseline_inputs, bundle)
        current_prep = preprocess_inputs(current_inputs, bundle)

        try:
            baseline_prob = float(
                bundle.model.predict_proba(baseline_prep.feature_vector)[0, 1]
            )
            current_prob = float(
                bundle.model.predict_proba(current_prep.feature_vector)[0, 1]
            )
        except Exception as exc:
            raise RuntimeError(
                f"Comparison prediction failed: {exc}"
            ) from exc

        return compare_predictions(baseline_prob, current_prob, bundle)

    # ── Convenience: run the built-in test case ───────────────────────────────

    def run_test_case(self) -> PredictionResult:
        """Run inference on the reference test case from appdata/.

        Useful for smoke-testing that the model and environment are
        correctly configured.  Loads pulsar_test_case.json at call time.

        Returns:
            PredictionResult for the test case.
        """
        from app.config import TEST_CASE_FILE
        from app.utils.file_io import load_json

        test_inputs: dict[str, Any] = load_json(TEST_CASE_FILE)
        logger.info("InferenceService: running built-in test case.")
        return self.predict_from_inputs(test_inputs)
