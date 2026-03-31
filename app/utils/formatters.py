"""
app/utils/formatters.py
Formatting utilities: timestamps, numbers, risk tiers.

All helpers are pure functions with no side-effects.
Risk-tier color values are intentionally duplicated from app.styles.Color
to keep this module importable without a running QApplication.
"""

from __future__ import annotations

from datetime import datetime


# ──────────────────────────────────────────────────────────────────────────────
# Timestamps
# ──────────────────────────────────────────────────────────────────────────────

def now_timestamp(fmt: str = "%Y%m%d_%H%M%S") -> str:
    """Return the current datetime formatted for use in filenames.

    Args:
        fmt: strftime format string. Default produces e.g. "20260315_143022".

    Returns:
        Formatted datetime string safe for use in file/path names.
    """
    return datetime.now().strftime(fmt)


def now_display(fmt: str = "%d %b %Y  %H:%M") -> str:
    """Return the current datetime as a human-readable display string.

    Args:
        fmt: strftime format string. Default produces e.g. "15 Mar 2026  14:30".

    Returns:
        Formatted datetime string intended for UI labels.
    """
    return datetime.now().strftime(fmt)


# ──────────────────────────────────────────────────────────────────────────────
# Numeric formatters
# ──────────────────────────────────────────────────────────────────────────────

def format_percentage(value: float, *, decimals: int = 1) -> str:
    """Format a probability or percentage as a display string with the % sign.

    Accepts both raw probabilities (0.0–1.0) and percentage values (0–100).
    Values ≤ 1.0 are automatically multiplied by 100.

    Args:
        value:    Numeric value to format.
        decimals: Number of decimal places (default 1).

    Returns:
        Formatted string, e.g. "23.4\u202f%" (uses narrow no-break space).

    Examples:
        >>> format_percentage(0.234)
        '23.4\u202f%'
        >>> format_percentage(23.4)
        '23.4\u202f%'
    """
    pct = value * 100.0 if value <= 1.0 else value
    return f"{pct:.{decimals}f}\u202f%"


def format_float(value: float, *, decimals: int = 2) -> str:
    """Return *value* formatted to *decimals* decimal places.

    Args:
        value:    Numeric value to format.
        decimals: Number of decimal places (default 2).

    Returns:
        Formatted string, e.g. "3.14".
    """
    return f"{value:.{decimals}f}"


# ──────────────────────────────────────────────────────────────────────────────
# Risk tier helpers
# ──────────────────────────────────────────────────────────────────────────────
#
# Thresholds mirror those used in the PULSAR inference module and
# pulsar_risk_groups.json:
#   < 0.10  → Low
#   0.10–<0.25 → Intermediate
#   0.25–<0.50 → High
#   ≥ 0.50  → Very High
# ──────────────────────────────────────────────────────────────────────────────

def risk_label(probability: float) -> str:
    """Map a raw probability (0.0–1.0) to a human-readable risk-tier label.

    Args:
        probability: Predicted in-hospital mortality probability (0.0–1.0).

    Returns:
        One of four tier strings with threshold annotation.
    """
    if probability < 0.10:
        return "Low (<10\u202f%)"
    if probability < 0.25:
        return "Intermediate (10\u2013<25\u202f%)"
    if probability < 0.50:
        return "High (25\u2013<50\u202f%)"
    return "Very High (\u226550\u202f%)"


# Alias kept for compatibility with pulsar_inference.py naming convention
format_risk_label = risk_label


def risk_color(probability: float) -> str:
    """Return the hex foreground color for the risk tier of *probability*.

    Colors match the ``Color`` palette in ``app.styles``.

    Args:
        probability: Raw probability (0.0–1.0).

    Returns:
        CSS hex color string (e.g. "#00C896").
    """
    if probability < 0.10:
        return "#00C896"   # RISK_LOW
    if probability < 0.25:
        return "#F5A623"   # RISK_MEDIUM
    if probability < 0.50:
        return "#E07B39"   # RISK_HIGH
    return "#E55353"       # RISK_VERY_HIGH


def risk_background_color(probability: float) -> str:
    """Return the hex background badge color for the risk tier of *probability*.

    Colors match the ``Color`` palette in ``app.styles``.

    Args:
        probability: Raw probability (0.0–1.0).

    Returns:
        CSS hex color string (e.g. "#003D2B").
    """
    if probability < 0.10:
        return "#003D2B"   # RISK_LOW_BG
    if probability < 0.25:
        return "#3D2900"   # RISK_MEDIUM_BG
    if probability < 0.50:
        return "#3D1F00"   # RISK_HIGH_BG
    return "#3D0F0F"       # RISK_VERY_HIGH_BG


def risk_badge_property(probability: float) -> str:
    """Return the Qt dynamic property value for the risk_badge stylesheet rule.

    Usage in a QLabel:
        label.setProperty("risk_badge", risk_badge_property(prob))
        label.style().unpolish(label)
        label.style().polish(label)

    Args:
        probability: Raw probability (0.0–1.0).

    Returns:
        One of: "low", "medium", "high", "very_high".
    """
    if probability < 0.10:
        return "low"
    if probability < 0.25:
        return "medium"
    if probability < 0.50:
        return "high"
    return "very_high"
