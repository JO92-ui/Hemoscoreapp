"""
backend/app/api/routes_health.py
GET /health  –  Liveness and readiness probe.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    timestamp: str


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness / readiness probe",
    description=(
        "Returns 200 with ``status: ok`` as soon as the service is up.  "
        "``model_loaded: true`` indicates the XGBoost bundle was successfully "
        "pre-loaded during startup and is ready to serve predictions."
    ),
)
def health(request: Request) -> HealthResponse:
    service = request.app.state.service
    model_loaded = service._bundle is not None

    return HealthResponse(
        status="ok",
        model_loaded=model_loaded,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
