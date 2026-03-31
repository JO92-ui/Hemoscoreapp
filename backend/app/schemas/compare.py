"""
backend/app/schemas/compare.py
Request / response schemas for POST /compare.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.common import RiskResultSchema
from backend.app.schemas.predict import PredictResponse


class CompareRequest(BaseModel):
    """Input body for POST /compare."""

    baseline_inputs: dict[str, float | None] = Field(
        default_factory=dict,
        description=(
            "Feature values from the earlier (baseline) assessment.  "
            "Omit or null-out any feature to impute the population median."
        ),
        examples=[{"lactate": 3.0, "base_scai_admission_num": 3}],
    )
    current_inputs: dict[str, float | None] = Field(
        default_factory=dict,
        description="Feature values from the current (most recent) assessment.",
        examples=[
            {
                "lactate": 8.5,
                "base_scai_admission_num": 5,
                "base_ecmo": 1,
                "scai_worsening": 2,
            }
        ],
    )
    include_explanation: bool = Field(
        default=True,
        description=(
            "Whether to compute the ICE-delta explanation proxy for the "
            "**current** prediction.  Baseline explanation is never computed."
        ),
    )


class CompareResponse(BaseModel):
    """Baseline-vs-current comparison result."""
    model_config = ConfigDict(populate_by_name=True)

    # Full current prediction (includes explanation when requested)
    current: PredictResponse = Field(
        description="Complete inference result for the current assessment."
    )

    # Baseline summary (lightweight — no explanation by design)
    baseline_risk: RiskResultSchema = Field(
        description="Risk tier and probability from the baseline assessment."
    )

    # Deltas
    delta_absolute: float = Field(
        description="current.probability − baseline.probability  (signed, 0–1 scale)."
    )
    delta_absolute_pp: float = Field(
        description="Same delta expressed in percentage points (×100)."
    )
    delta_relative: float | None = Field(
        default=None,
        description=(
            "Relative change: delta_absolute / baseline.probability.  "
            "``null`` when baseline probability is zero."
        ),
    )

    # Categorical outcome
    change_label: str = Field(
        description='"improved" | "worsened" | "unchanged".'
    )
    category_shift: str = Field(
        description=(
            'Human-readable category shift string, e.g. "High (25–<50%) → Very high (≥50%)".  '
            'Empty string when the risk category did not change.'
        ),
    )

    timestamp: str = Field(
        description="Timestamp of the current prediction."
    )
