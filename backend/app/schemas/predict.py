"""
backend/app/schemas/predict.py
Request / response schemas for POST /predict and GET /test-case.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.common import ExplanationSchema, RiskResultSchema


class PredictRequest(BaseModel):
    """Input body for POST /predict."""

    inputs: dict[str, float | None] = Field(
        default_factory=dict,
        description=(
            "Map of PULSAR feature names to their values.  "
            "Omit any feature to let the model impute the population median.  "
            "Explicitly set a feature to ``null`` to request imputation for "
            "that specific variable."
        ),
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
            "Whether to compute the non-causal ICE-delta explanation proxy.  "
            "Set to ``false`` for low-latency polling; set to ``true`` for "
            "detailed results."
        ),
    )


class PredictResponse(BaseModel):
    """Full result of a single PULSAR inference call."""
    model_config = ConfigDict(populate_by_name=True)

    probability: float = Field(
        description="Raw predicted probability of in-hospital death (0–1)."
    )
    risk_percent: float = Field(
        description="Probability as a percentage, rounded to 1 decimal."
    )
    risk_result: RiskResultSchema = Field(
        description="Risk tier label, category key, and probability."
    )
    imputed_fields: list[str] = Field(
        description="Feature names that were absent or invalid and were filled from the imputation table.",
    )
    out_of_range_fields: list[str] = Field(
        description=(
            "Feature names whose submitted value fell outside the clinical "
            "reference range.  The original value was still used for inference; "
            "this is a warning only."
        ),
    )
    feature_dict: dict[str, float] = Field(
        description="Final feature vector used for inference (imputed where needed)."
    )
    explanation: ExplanationSchema = Field(
        description=(
            "Non-causal heuristic explanation.  ``all_contributions`` is empty "
            "when ``include_explanation`` was ``false``."
        )
    )
    timestamp: str = Field(description="ISO-style datetime of the prediction.")
    model_name: str = Field(description="Model identifier from the preprocessing spec.")
