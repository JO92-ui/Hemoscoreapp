"""
backend/app/core/__init__.py
Bridge that makes the original HEMOSCOREAPP inference logic available to the
FastAPI backend without any code duplication.

How it works
------------
1. Adds the Hemoscoreapp project root to ``sys.path`` so that the desktop
   app's ``app.core.*`` modules can be imported directly.

2. Injects ``backend/app/config.py`` into ``sys.modules`` as ``app.config``
   **before** any ``app.core`` import, so all path constants (model artefacts,
   appdata directory) resolve to ``backend/appdata/`` rather than the desktop
   app's ``appdata/``.

3. Re-exports the public inference API so backend route modules only need:
       from backend.app.core import InferenceService, PredictionResult, …

Prerequisites
-------------
- ``backend/appdata/`` must contain the full set of PULSAR model artefacts
  copied from the desktop app's ``appdata/`` directory.
- The Hemoscoreapp project root must be accessible on the filesystem at the
  expected relative path (``backend/../``).
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


# ── 1. Resolve directory layout ───────────────────────────────────────────────

_BACKEND_APP  = Path(__file__).resolve().parent.parent  # backend/app/
_PROJECT_ROOT = _BACKEND_APP.parent.parent              # Hemoscoreapp/

if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))


# ── 2. Inject backend config as app.config (must happen BEFORE any app.core
#        import; model_loader.py imports app.config at module level) ──────────

_config_path = _BACKEND_APP / "config.py"
_spec = importlib.util.spec_from_file_location("app.config", str(_config_path))
_backend_config_module = importlib.util.module_from_spec(_spec)
sys.modules["app.config"] = _backend_config_module
_spec.loader.exec_module(_backend_config_module)


# ── 3. Import public inference API ────────────────────────────────────────────
# These imports now resolve against _PROJECT_ROOT/app/core/*.py
# and all FROM app.config references pick up the backend version above.

from app.core.inference_service import InferenceService, PredictionResult  # noqa: E402
from app.core.risk_logic import (                                           # noqa: E402
    ChangeLabel,
    ComparisonResult,
    RiskCategory,
    RiskResult,
)
from app.core.explanation_proxy import ExplanationResult, FeatureContribution  # noqa: E402


__all__ = [
    "InferenceService",
    "PredictionResult",
    "ComparisonResult",
    "RiskCategory",
    "ChangeLabel",
    "RiskResult",
    "ExplanationResult",
    "FeatureContribution",
]
