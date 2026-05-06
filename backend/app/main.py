"""
backend/app/main.py
FastAPI application factory for HEMOSCOREAPP backend.

Startup sequence
----------------
1. The ``lifespan`` event handler instantiates ``InferenceService`` and
   pre-loads (warms) the XGBoost model bundle so the first request is fast.
2. The service is stored on ``app.state.service`` and accessed from route
   handlers via ``request.app.state.service``.

CORS
----
All origins are permitted in development.  Restrict ``allow_origins`` via
the ``CORS_ORIGINS`` environment variable before deploying to production.

Run locally
-----------
    cd backend
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import the bridge first so sys.path and app.config are wired BEFORE anything
# from the inference pipeline is imported inside route modules.
from backend.app.core import InferenceService  # noqa: F401 — triggers bridge setup
from backend.app.api import routes_health, routes_metadata, routes_predict, routes_compare

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# CORS origins
# ──────────────────────────────────────────────────────────────────────────────

_CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "*").split(",")
    if o.strip()
]


# ──────────────────────────────────────────────────────────────────────────────
# Lifespan  (startup / shutdown)
# ──────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Pre-load the model bundle so the first real request is not slow."""
    logger.info("HEMOSCOREAPP API starting – loading model bundle …")
    service = InferenceService()
    try:
        service._get_bundle()           # force-load; raises on artefact error
        logger.info("Model bundle loaded successfully.")
    except Exception as exc:
        # Log the error but still start the server – /health can report it
        logger.error("Model bundle load failed: %s", exc)

    application.state.service = service
    yield
    logger.info("HEMOSCOREAPP API shutting down.")


# ──────────────────────────────────────────────────────────────────────────────
# Application
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="HEMOSCOREAPP API",
    summary="PULSAR XGBoost — Cardiogenic Shock In-Hospital Mortality Risk",
    description=(
        "REST API that exposes the PULSAR XGBoost model for cardiogenic shock "
        "in-hospital mortality risk prediction.  "
        "\n\n"
        "**Important:** All explanation endpoints return non-causal heuristic "
        "estimates (ICE-delta perturbation proxy).  These are **not** equivalent "
        "to SHAP or LIME and must not be used as the sole basis for clinical "
        "decisions.  For research use only."
    ),
    version="1.0.0",
    contact={
        "name": "ITAMEX Hemodinámica",
    },
    license_info={
        "name": "Proprietary – Research Use Only",
    },
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(routes_health.router)
app.include_router(routes_metadata.router)
app.include_router(routes_predict.router)
app.include_router(routes_compare.router)

# ── Static frontend (Next.js export) ──────────────────────────────────────────
# Mounted last so it never shadows API routes.
# In frozen (PyInstaller) mode the static files are in _MEIPASS/frontend_out/.
# In development they live in frontend/out/ relative to the project root.

def _resolve_frontend_out() -> "Path | None":
    import sys
    from pathlib import Path

    if getattr(sys, "frozen", False):
        candidate = Path(sys._MEIPASS) / "frontend_out"
    else:
        # backend/app/main.py → backend/app/ → backend/ → project root
        candidate = Path(__file__).resolve().parent.parent.parent / "frontend" / "out"

    return candidate if candidate.is_dir() else None


_frontend_out = _resolve_frontend_out()
if _frontend_out is not None:
    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=str(_frontend_out), html=True), name="frontend")
