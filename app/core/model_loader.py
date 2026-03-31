"""
app/core/model_loader.py
Loads and caches all artefacts required for inference.

Strategy
--------
Primary:   joblib file  (preserves sklearn wrapper + feature_importances_)
Fallback:  native XGBoost JSON (model.load_model) if joblib is absent.

The ModelBundle is a frozen dataclass so callers can never accidentally
mutate it. All paths come from app.config – no magic strings here.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import xgboost as xgb

from app.config import (
    FEATURES_FILE,
    IMPUTATION_FILE,
    MODEL_JOBLIB,
    MODEL_JSON,
    PREPROCESSING_SPEC,
    RISK_GROUPS_FILE,
)
from app.utils.file_io import load_json

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Risk group representation
# ──────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class RiskGroup:
    """A single risk tier with its probability bounds.

    Attributes:
        label:  Human-readable tier name, e.g. "High (25\u2013<50%)".
        lower:  Lower bound of the probability interval (inclusive).
        upper:  Upper bound of the probability interval (exclusive for all
                tiers except the last, which is closed on the right).
        color:  Optional CSS hex color hint from the JSON source (may be None).
    """

    label: str
    lower: float
    upper: float
    color: str | None = None


# ──────────────────────────────────────────────────────────────────────────────
# Data structure
# ──────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ModelBundle:
    """All artefacts needed for a single inference run.

    Attributes:
        model:            Fitted XGBClassifier ready for predict_proba().
        features:         Ordered list of 32 feature names (model input order).
        imputation:       Dict mapping feature name \u2192 median/mode impute value.
        spec:             Full preprocessing spec dict from JSON.
        risk_groups:      Ordered list of RiskGroup objects (Low \u2192 Very high).
        feature_importances: Array of shape (n_features,) \u2013 gain importances
                            from the booster, aligned to ``features``.
        ordinal_vars:     Feature names treated as ordinal.
        binary_vars:      Feature names treated as binary (0/1).
        continuous_vars:  Feature names treated as continuous.
    """

    model: xgb.XGBClassifier
    features: list[str]
    imputation: dict[str, float]
    spec: dict[str, Any]
    risk_groups: list[RiskGroup]
    feature_importances: np.ndarray
    ordinal_vars: list[str]
    binary_vars: list[str]
    continuous_vars: list[str]


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _load_model(joblib_path: Path, json_path: Path) -> xgb.XGBClassifier:
    """Load XGBClassifier preferring joblib, falling back to native JSON."""
    if joblib_path.is_file():
        import joblib  # lazy import – not needed if only JSON path is used
        logger.info("Loading model from joblib: %s", joblib_path)
        clf: xgb.XGBClassifier = joblib.load(joblib_path)
        if not isinstance(clf, xgb.XGBClassifier):
            raise TypeError(
                f"Expected XGBClassifier in joblib, got {type(clf).__name__}"
            )
        return clf

    if json_path.is_file():
        logger.info("Joblib not found; loading model from JSON: %s", json_path)
        clf = xgb.XGBClassifier()
        clf.load_model(str(json_path))
        return clf

    raise FileNotFoundError(
        f"Model file not found. Tried:\n  {joblib_path}\n  {json_path}"
    )


def _get_feature_importances(
    model: xgb.XGBClassifier,
    features: list[str],
) -> np.ndarray:
    """Return per-feature gain importances aligned to the *features* list.

    Falls back to uniform importances if the booster does not expose scores.
    """
    try:
        booster: xgb.Booster = model.get_booster()
        scores: dict[str, float] = booster.get_score(importance_type="gain")
        # XGBoost names features f0, f1, … when trained via numpy arrays,
        # unless feature_names were set explicitly.
        importances = np.zeros(len(features), dtype=float)
        for key, score in scores.items():
            # Handle both "f{i}" style and actual feature-name style.
            if key.startswith("f") and key[1:].isdigit():
                idx = int(key[1:])
                if idx < len(importances):
                    importances[idx] = score
            elif key in features:
                importances[features.index(key)] = score
        # Normalise so values sum to 1 (easier to interpret).
        total = importances.sum()
        if total > 0:
            importances /= total
        else:
            importances = np.ones(len(features), dtype=float) / len(features)
        return importances
    except Exception as exc:
        logger.warning("Could not extract feature importances: %s", exc)
        return np.ones(len(features), dtype=float) / len(features)


# ──────────────────────────────────────────────────────────────────────────────
# Fallback risk groups (PULSAR canonical thresholds)
# Used whenever pulsar_risk_groups.json is absent, empty, or unrecognised.
# ──────────────────────────────────────────────────────────────────────────────

_FALLBACK_RISK_GROUPS: list[RiskGroup] = [
    RiskGroup(label="Low (<10%)",              lower=0.00, upper=0.10),
    RiskGroup(label="Intermediate (10\u2013<25%)",  lower=0.10, upper=0.25),
    RiskGroup(label="High (25\u2013<50%)",          lower=0.25, upper=0.50),
    RiskGroup(label="Very high (\u226550%)",        lower=0.50, upper=1.00),
]

# Canonical display order for dict-style JSON sources.
_CANONICAL_ORDER: list[str] = [
    "Low (<10%)",
    "Intermediate (10\u2013<25%)",
    "High (25\u2013<50%)",
    "Very high (\u226550%)",
]


def _parse_risk_groups(raw: Any) -> list[RiskGroup]:
    """Parse pulsar_risk_groups.json into an ordered list of RiskGroup objects.

    Handles four common JSON structures gracefully:

    1. ``dict[str, list[float]]`` (current PULSAR format)::

           {"Low (<10%)": [0.0, 0.1], "High (25\u2013<50%)": [0.25, 0.5], ...}

    2. ``dict[str, dict]`` with ``lower``/``upper`` keys::

           {"Low (<10%)": {"lower": 0.0, "upper": 0.1, "color": "#00C896"}, ...}

    3. ``list[dict]`` with ``label``, ``lower``, ``upper`` keys::

           [{"label": "Low (<10%)", "lower": 0.0, "upper": 0.1}, ...]

    4. ``dict`` with a ``"groups"`` key whose value is a list (wraps case 3)::

           {"groups": [{"label": "Low (<10%)", "lower": 0.0, "upper": 0.1}]}

    If the input is ``None``, empty, or no valid tier can be extracted,
    the documented PULSAR fallback thresholds are used and a warning is logged.

    Returns:
        Non-empty list of RiskGroup objects ordered Low \u2192 Very high.
    """
    groups: list[RiskGroup] = []

    try:
        # ── Unwrap {"groups": [...]} envelope ────────────────────────────────
        if isinstance(raw, dict) and "groups" in raw and isinstance(raw["groups"], list):
            raw = raw["groups"]

        # ── Case 3: list of dicts ─────────────────────────────────────────────
        if isinstance(raw, list):
            for item in raw:
                if not isinstance(item, dict):
                    continue
                label = str(item.get("label", "")).strip()
                lower = item.get("lower", item.get("lo", item.get("min")))
                upper = item.get("upper", item.get("hi", item.get("max")))
                color = item.get("color") or item.get("colour")
                if label and lower is not None and upper is not None:
                    groups.append(RiskGroup(
                        label=label,
                        lower=float(lower),
                        upper=float(upper),
                        color=str(color) if color else None,
                    ))

        # ── Case 1 & 2: dict keyed by label ───────────────────────────────────
        elif isinstance(raw, dict):
            seen: set[str] = set()

            # First pass: iterate in canonical order to preserve tier sequence.
            for label in _CANONICAL_ORDER:
                if label not in raw:
                    continue
                val = raw[label]
                color: str | None = None

                if isinstance(val, (list, tuple)) and len(val) >= 2:
                    # Case 1: [lower, upper]
                    lower, upper = float(val[0]), float(val[1])
                elif isinstance(val, dict):
                    # Case 2: {"lower": ..., "upper": ..., "color": ...}
                    lower = float(val.get("lower", val.get("lo", val.get("min", 0))))
                    upper = float(val.get("upper", val.get("hi", val.get("max", 1))))
                    color = val.get("color") or val.get("colour")
                    color = str(color) if color else None
                else:
                    logger.warning(
                        "Risk group '%s' has unrecognised value type %s; skipping.",
                        label, type(val).__name__,
                    )
                    continue

                groups.append(RiskGroup(label=label, lower=lower, upper=upper, color=color))
                seen.add(label)

            # Second pass: pick up any extra non-canonical labels.
            for label, val in raw.items():
                if label in seen:
                    continue
                color = None
                if isinstance(val, (list, tuple)) and len(val) >= 2:
                    lower, upper = float(val[0]), float(val[1])
                elif isinstance(val, dict):
                    lower = float(val.get("lower", val.get("lo", 0)))
                    upper = float(val.get("upper", val.get("hi", 1)))
                    color = val.get("color") or val.get("colour")
                    color = str(color) if color else None
                else:
                    continue
                groups.append(RiskGroup(label=label, lower=lower, upper=upper, color=color))

    except Exception as exc:
        logger.error("Risk group parsing raised an unexpected error: %s", exc)
        groups = []

    if not groups:
        logger.warning(
            "Could not parse any valid risk groups from source data; "
            "using built-in PULSAR fallback thresholds."
        )
        return list(_FALLBACK_RISK_GROUPS)

    # Sort ascending by lower bound to guarantee correct tier ordering.
    groups.sort(key=lambda g: g.lower)
    logger.debug("Parsed %d risk groups: %s", len(groups), [g.label for g in groups])
    return groups


# ──────────────────────────────────────────────────────────────────────────────
# Public loader
# ──────────────────────────────────────────────────────────────────────────────

_cached_bundle: ModelBundle | None = None


def load_model_bundle(*, force_reload: bool = False) -> ModelBundle:
    """Load all artefacts and return a frozen ModelBundle.

    Results are cached in module-level ``_cached_bundle``.  Pass
    ``force_reload=True`` to discard the cache (useful in tests).

    Returns:
        ModelBundle with model, features, imputation values, spec, and
        risk-group definitions.

    Raises:
        FileNotFoundError: If a required file is missing from appdata/.
        ValueError:        On data inconsistency (e.g. feature count mismatch).
    """
    global _cached_bundle
    if _cached_bundle is not None and not force_reload:
        return _cached_bundle

    # ── Load artefacts ────────────────────────────────────────────────────────
    features_list: list[str] = load_json(FEATURES_FILE)
    imputation_map: dict[str, float] = {
        k: float(v) for k, v in load_json(IMPUTATION_FILE).items()
    }
    spec: dict[str, Any] = load_json(PREPROCESSING_SPEC)
    risk_groups_raw: dict[str, list[float]] = load_json(RISK_GROUPS_FILE)

    # ── Validate ──────────────────────────────────────────────────────────────
    spec_features: list[str] = spec.get("features", [])
    if spec_features and spec_features != features_list:
        logger.warning(
            "features.json and preprocessing_spec.json feature lists differ; "
            "using preprocessing_spec.json order."
        )
        features_list = spec_features

    n_expected: int = spec.get("n_features", len(features_list))
    if len(features_list) != n_expected:
        raise ValueError(
            f"Feature count mismatch: spec says {n_expected}, "
            f"but features list has {len(features_list)}."
        )

    # ── Load model ────────────────────────────────────────────────────────────
    model = _load_model(MODEL_JOBLIB, MODEL_JSON)

    # ── Build aligned feature importances ─────────────────────────────────────
    fi = _get_feature_importances(model, features_list)

    # ── Parse risk groups ─────────────────────────────────────────────────────
    risk_groups = _parse_risk_groups(risk_groups_raw)

    bundle = ModelBundle(
        model=model,
        features=features_list,
        imputation=imputation_map,
        spec=spec,
        risk_groups=risk_groups,
        feature_importances=fi,
        ordinal_vars=spec.get("ordinal_vars", []),
        binary_vars=spec.get("binary_vars", []),
        continuous_vars=spec.get("continuous_vars", []),
    )
    _cached_bundle = bundle
    logger.info(
        "ModelBundle loaded successfully. Features: %d, Risk groups: %d",
        len(features_list),
        len(risk_groups),
    )
    return bundle
