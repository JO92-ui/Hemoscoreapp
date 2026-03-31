"""
app/core/risk_logic.py
Risk categorisation and baseline-vs-current comparison.

Tier thresholds are loaded from the ModelBundle (pulsar_risk_groups.json)
at call time, so they stay in sync with the model definiton without
being hard-coded here.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.core.model_loader import ModelBundle, RiskGroup


# ──────────────────────────────────────────────────────────────────────────────
# Enumerations
# ──────────────────────────────────────────────────────────────────────────────

class RiskCategory(str, Enum):
    """Canonical risk tier identifiers.

    The string value matches the ``risk_badge`` Qt dynamic property used
    in the stylesheet (app/styles.py), so it can be set directly on a QLabel.
    """
    LOW       = "low"
    MEDIUM    = "medium"        # "Intermediate" in clinical language
    HIGH      = "high"
    VERY_HIGH = "very_high"


class ChangeLabel(str, Enum):
    IMPROVED   = "improved"
    WORSENED   = "worsened"
    UNCHANGED  = "unchanged"


# ──────────────────────────────────────────────────────────────────────────────
# Internal tier map  (label in JSON → RiskCategory)
# ──────────────────────────────────────────────────────────────────────────────

_LABEL_TO_CATEGORY: dict[str, RiskCategory] = {
    "Low (<10%)":              RiskCategory.LOW,
    "Intermediate (10\u2013<25%)":  RiskCategory.MEDIUM,
    "High (25\u2013<50%)":    RiskCategory.HIGH,
    "Very high (\u226550%)":  RiskCategory.VERY_HIGH,
}

# Numeric ordering for category shift detection
_CATEGORY_ORDER: dict[RiskCategory, int] = {
    RiskCategory.LOW:       0,
    RiskCategory.MEDIUM:    1,
    RiskCategory.HIGH:      2,
    RiskCategory.VERY_HIGH: 3,
}

# Threshold below which |delta_absolute| is treated as "unchanged"
_UNCHANGED_THRESHOLD: float = 0.005


# ──────────────────────────────────────────────────────────────────────────────
# DataClasses
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class RiskResult:
    """Risk tier for a single probability estimate.

    Attributes:
        probability:    Raw model output (0.0 – 1.0).
        risk_percent:   Probability expressed as a percentage (0 – 100).
        label:          Human-readable tier label from risk_groups.json,
                        e.g. "High (25–<50%)".
        category:       Machine-readable RiskCategory enum value.
    """

    probability: float
    risk_percent: float
    label: str
    category: RiskCategory


@dataclass
class ComparisonResult:
    """Baseline vs current risk comparison.

    Attributes:
        baseline:          RiskResult for the earlier measurement.
        current:           RiskResult for the newer measurement.
        delta_absolute:    current.probability − baseline.probability.
        delta_relative:    delta_absolute / baseline.probability
                           (None if baseline probability is zero).
        change_label:      ChangeLabel enum ('improved', 'worsened', 'unchanged').
        category_shift:    Human-readable string, e.g. "High → Intermediate".
                           Empty string if category is unchanged.
    """

    baseline: RiskResult
    current: RiskResult
    delta_absolute: float
    delta_relative: float | None
    change_label: ChangeLabel
    category_shift: str


# ──────────────────────────────────────────────────────────────────────────────
# Public functions
# ──────────────────────────────────────────────────────────────────────────────

def _category_for_group(grp: RiskGroup, tier_index: int) -> RiskCategory:
    """Resolve a RiskGroup to a RiskCategory.

    Lookup order:
    1. Exact label match in ``_LABEL_TO_CATEGORY``.
    2. Positional fallback by tier_index (0=LOW, 1=MEDIUM, 2=HIGH, 3+=VERY_HIGH).
    """
    if grp.label in _LABEL_TO_CATEGORY:
        return _LABEL_TO_CATEGORY[grp.label]
    _positional: list[RiskCategory] = [
        RiskCategory.LOW,
        RiskCategory.MEDIUM,
        RiskCategory.HIGH,
        RiskCategory.VERY_HIGH,
    ]
    return _positional[min(tier_index, len(_positional) - 1)]


def categorize_risk(probability: float, bundle: ModelBundle) -> RiskResult:
    """Map a raw probability to a RiskResult using the bundle's risk groups.

    Interval semantics: [lower, upper) for every tier except the last,
    which is closed on the right [lower, upper] to capture probability = 1.0.

    Args:
        probability: Model output in [0.0, 1.0].
        bundle:      Loaded ModelBundle.

    Returns:
        RiskResult with the probability, percentage, label, and category.
    """
    probability = max(0.0, min(1.0, float(probability)))

    groups = bundle.risk_groups
    matched_grp: RiskGroup = groups[-1]   # default: highest tier
    matched_idx: int = len(groups) - 1

    for i, grp in enumerate(groups):
        is_last = i == len(groups) - 1
        if is_last:
            if probability >= grp.lower:
                matched_grp, matched_idx = grp, i
                break
        else:
            if grp.lower <= probability < grp.upper:
                matched_grp, matched_idx = grp, i
                break

    category = _category_for_group(matched_grp, matched_idx)

    return RiskResult(
        probability=probability,
        risk_percent=round(probability * 100.0, 1),
        label=matched_grp.label,
        category=category,
    )


def compare_predictions(
    baseline_probability: float,
    current_probability: float,
    bundle: ModelBundle,
) -> ComparisonResult:
    """Compare two probability estimates and summarise the clinical change.

    Args:
        baseline_probability: Earlier (e.g. admission) probability.
        current_probability:  Latest (e.g. 24-hour follow-up) probability.
        bundle:               Loaded ModelBundle (for risk categorisation).

    Returns:
        ComparisonResult with deltas, change label, and category shift.
    """
    baseline_result = categorize_risk(baseline_probability, bundle)
    current_result = categorize_risk(current_probability, bundle)

    delta_abs = current_probability - baseline_probability

    if baseline_probability > 0.0:
        delta_rel: float | None = delta_abs / baseline_probability
    else:
        delta_rel = None

    # Change label – hysteresis applied to avoid noise triggering label change
    if abs(delta_abs) <= _UNCHANGED_THRESHOLD:
        change = ChangeLabel.UNCHANGED
    elif delta_abs < 0:
        change = ChangeLabel.IMPROVED
    else:
        change = ChangeLabel.WORSENED

    # Category shift string
    if baseline_result.category == current_result.category:
        shift_str = ""
    else:
        shift_str = f"{baseline_result.label} → {current_result.label}"

    return ComparisonResult(
        baseline=baseline_result,
        current=current_result,
        delta_absolute=round(delta_abs, 4),
        delta_relative=round(delta_rel, 4) if delta_rel is not None else None,
        change_label=change,
        category_shift=shift_str,
    )
