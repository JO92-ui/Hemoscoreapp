"""
backend/app/api/routes_compare.py
POST /compare  –  Baseline-vs-current risk comparison.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from backend.app.schemas.common import RiskResultSchema, dataclass_to_dict
from backend.app.schemas.compare import CompareRequest, CompareResponse
from backend.app.schemas.predict import PredictResponse

router = APIRouter(tags=["Comparison"])


# ══════════════════════════════════════════════════════════════════════════════
# Route
# ══════════════════════════════════════════════════════════════════════════════

@router.post(
    "/compare",
    response_model=CompareResponse,
    summary="Compare baseline vs current risk assessment",
    description=(
        "Runs the PULSAR model on both ``baseline_inputs`` and "
        "``current_inputs``, then computes:  \n"
        "- Absolute and relative probability deltas\n"
        "- Change label: ``improved`` / ``worsened`` / ``unchanged``\n"
        "- Category shift string (e.g. *High → Very high*)\n\n"
        "The full ``current`` prediction (including optional ICE-delta "
        "explanation) is included in the response.  "
        "The baseline result carries only the risk tier summary — no "
        "explanation is computed for the baseline."
    ),
)
def compare(body: CompareRequest, request: Request) -> CompareResponse:
    service = request.app.state.service

    # Strip null values from both input dicts
    clean_baseline = {k: v for k, v in body.baseline_inputs.items() if v is not None}
    clean_current  = {k: v for k, v in body.current_inputs.items()  if v is not None}

    # ── 1. Full current prediction (with optional explanation) ────────────────
    try:
        current_result = service.predict_from_inputs(
            clean_current,
            include_explanation=body.include_explanation,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Current prediction failed: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error in current prediction: {exc}",
        ) from exc

    # ── 2. Comparison (baseline + deltas) ─────────────────────────────────────
    try:
        comparison = service.compare(
            clean_baseline,
            clean_current,
            include_explanation=False,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Comparison failed: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error in comparison: {exc}",
        ) from exc

    # ── 3. Build response ─────────────────────────────────────────────────────
    current_resp = PredictResponse.model_validate(dataclass_to_dict(current_result))

    baseline_risk = RiskResultSchema(
        probability=comparison.baseline.probability,
        risk_percent=comparison.baseline.risk_percent,
        label=comparison.baseline.label,
        category=comparison.baseline.category.value
        if hasattr(comparison.baseline.category, "value")
        else str(comparison.baseline.category),
    )

    delta_abs = comparison.delta_absolute               # probability scale, signed
    delta_abs_pp = delta_abs * 100.0                    # percentage points

    delta_rel: float | None = None
    if comparison.delta_relative is not None:
        import math
        if not math.isnan(comparison.delta_relative):
            delta_rel = comparison.delta_relative

    change_label = (
        comparison.change_label.value
        if hasattr(comparison.change_label, "value")
        else str(comparison.change_label)
    )

    return CompareResponse(
        current=current_resp,
        baseline_risk=baseline_risk,
        delta_absolute=delta_abs,
        delta_absolute_pp=round(delta_abs_pp, 2),
        delta_relative=delta_rel,
        change_label=change_label,
        category_shift=comparison.category_shift,
        timestamp=current_result.timestamp,
    )
