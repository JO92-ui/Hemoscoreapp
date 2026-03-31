"""
backend/app/api/routes_predict.py
POST /predict  –  Single-patient risk prediction.
GET  /test-case  –  Run the reference test case and return the result.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from backend.app.schemas.common import dataclass_to_dict
from backend.app.schemas.predict import PredictRequest, PredictResponse

router = APIRouter(tags=["Prediction"])


# ══════════════════════════════════════════════════════════════════════════════
# Internal serialisation helper
# ══════════════════════════════════════════════════════════════════════════════

def _prediction_to_response(result) -> PredictResponse:
    """Convert a ``PredictionResult`` dataclass to a ``PredictResponse``.

    Uses ``dataclasses.asdict`` for deep conversion, then normalises
    NaN / Enum values via ``dataclass_to_dict``.
    """
    return PredictResponse.model_validate(dataclass_to_dict(result))


# ══════════════════════════════════════════════════════════════════════════════
# Routes
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/predict",
    response_model=PredictResponse,
    summary="Run PULSAR mortality risk prediction",
    description=(
        "Accepts any subset of the 32 PULSAR model features.  "
        "Missing or null-valued features are automatically imputed with "
        "population-median reference values.  "
        "\n\n"
        "Set ``include_explanation: false`` for low-latency polling (< 5 ms).  "
        "Set ``include_explanation: true`` (default) to receive the full "
        "ICE-delta non-causal heuristic explanation in the response."
    ),
)
def predict(body: PredictRequest, request: Request) -> PredictResponse:
    service = request.app.state.service

    # Strip null values — the inference service handles missing features itself
    clean_inputs = {k: v for k, v in body.inputs.items() if v is not None}

    try:
        result = service.predict_from_inputs(
            clean_inputs,
            include_explanation=body.include_explanation,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Inference failed: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during prediction: {exc}",
        ) from exc

    return _prediction_to_response(result)


@router.get(
    "/test-case",
    response_model=PredictResponse,
    summary="Run the reference test case",
    description=(
        "Loads ``pulsar_test_case.json`` from the backend appdata directory "
        "and runs a full inference pass with explanation enabled.  "
        "Useful for verifying that the model artefacts are correctly installed "
        "and the pipeline is operating as expected."
    ),
)
def run_test_case(request: Request) -> PredictResponse:
    service = request.app.state.service

    try:
        result = service.run_test_case()
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Test case file not found: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Test case execution failed: {exc}",
        ) from exc

    return _prediction_to_response(result)
