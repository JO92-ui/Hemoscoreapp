"""
backend/app/schemas/common.py
Shared Pydantic response schemas used by both /predict and /compare endpoints.

Mirrors the Python dataclasses from app.core exactly, but as JSON-serialisable
Pydantic models.  NaN / Inf values in floats are normalised to None by the
``sanitize`` helper before Pydantic validation.
"""

from __future__ import annotations

import dataclasses
import math
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ══════════════════════════════════════════════════════════════════════════════
# Serialisation helpers
# ══════════════════════════════════════════════════════════════════════════════

def _sanitize(obj: Any) -> Any:
    """Recursively clean a dataclass-derived dict for JSON serialisation.

    Transformations applied:
    - ``float NaN`` or ``float ±Inf``  →  ``None``
    - ``Enum`` instances               →  their ``.value`` string / int
    - ``dict`` / ``list``              →  recursed
    """
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, Enum):
        return obj.value
    return obj


def dataclass_to_dict(obj: Any) -> dict[str, Any]:
    """Convert a Python dataclass (and nested dataclasses) to a clean dict.

    Calls ``dataclasses.asdict`` for full recursive conversion, then runs
    ``_sanitize`` to strip NaN / coerce Enum values.

    Args:
        obj: Any Python ``@dataclass`` instance.

    Returns:
        Plain dict suitable for Pydantic ``model_validate``.
    """
    return _sanitize(dataclasses.asdict(obj))


# ══════════════════════════════════════════════════════════════════════════════
# Sub-schemas
# ══════════════════════════════════════════════════════════════════════════════

class RiskResultSchema(BaseModel):
    """Risk tier outcome for a single probability estimate."""
    model_config = ConfigDict(populate_by_name=True)

    probability: float = Field(
        description="Raw model output in [0, 1]."
    )
    risk_percent: float = Field(
        description="Probability expressed as a percentage (0–100)."
    )
    label: str = Field(
        description='Human-readable tier label, e.g. "High (25–<50%)".'
    )
    category: str = Field(
        description='Machine-readable tier key: "low" | "medium" | "high" | "very_high".'
    )


class FeatureContributionSchema(BaseModel):
    """Probable local influence of one feature — ICE-delta proxy."""
    model_config = ConfigDict(populate_by_name=True)

    feature: str = Field(description="Feature name as in pulsar_features.json.")
    patient_value: float = Field(description="Value used for this patient.")
    reference_value: float = Field(description="Population-median imputation reference.")
    delta_probability: float = Field(
        description="Marginal change in predicted probability (non-causal)."
    )
    direction: str = Field(description='"up" | "down" | "uncertain".')
    direction_label: str = Field(
        description='"likely pushes risk up" | "likely pushes risk down" | "neutral / uncertain".'
    )
    importance_rank: int = Field(description="1-based rank by |delta_probability|.")


class ExplanationSchema(BaseModel):
    """Non-causal heuristic explanation (ICE-delta perturbation proxy)."""
    model_config = ConfigDict(populate_by_name=True)

    method: str = Field(description="Short internal method identifier.")
    explanation_method: str = Field(description="Human-readable method name.")
    explanation_disclaimer: str = Field(
        description="Mandatory disclaimer — must be surfaced in any UI that shows these values."
    )
    interpretation_note: str = Field(
        description="Guidance on how to interpret the contribution values."
    )
    baseline_probability: float | None = Field(
        default=None,
        description="Population-reference probability (NaN when explanation was skipped → None).",
    )
    top_increasing: list[FeatureContributionSchema] = Field(
        default_factory=list,
        description="Top features with probable upward local influence.",
    )
    top_decreasing: list[FeatureContributionSchema] = Field(
        default_factory=list,
        description="Top features with probable downward local influence.",
    )
    all_contributions: list[FeatureContributionSchema] = Field(
        default_factory=list,
        description="All 32 feature contributions sorted by |delta_probability|.",
    )


class RiskGroupSchema(BaseModel):
    """A single risk tier with its probability bounds."""
    label: str
    lower: float
    upper: float
    color: str | None = None


class FeatureImportanceSchema(BaseModel):
    """Normalised gain-based feature importance entry."""
    feature: str
    importance: float


class MetadataResponse(BaseModel):
    """Full model and configuration metadata."""
    model_config = ConfigDict(populate_by_name=True)

    model_name: str
    api_version: str
    n_features: int
    features: list[str]
    continuous_vars: list[str]
    binary_vars: list[str]
    ordinal_vars: list[str]
    risk_groups: list[RiskGroupSchema]
    top_features_by_importance: list[FeatureImportanceSchema]
    imputation_defaults: dict[str, float]
    xgb_params: dict[str, Any] = Field(default_factory=dict)
