"""
app/core/__init__.py
Core inference package for HEMOSCOREAPP.

Public API re-exported for convenient access:
    from app.core import InferenceService, PredictionResult, ComparisonResult
"""

from app.core.inference_service import InferenceService
from app.core.risk_logic import (
    RiskCategory,
    ComparisonResult,
    categorize_risk,
    compare_predictions,
)
from app.core.preprocessing import PreprocessingResult
from app.core.explanation_proxy import ExplanationResult, FeatureContribution

# Convenience singleton – import and call .predict_from_inputs() directly.
# The first access triggers lazy model loading.
from app.core.inference_service import PredictionResult

__all__ = [
    "InferenceService",
    "PredictionResult",
    "ComparisonResult",
    "PreprocessingResult",
    "ExplanationResult",
    "FeatureContribution",
    "RiskCategory",
    "categorize_risk",
    "compare_predictions",
]
