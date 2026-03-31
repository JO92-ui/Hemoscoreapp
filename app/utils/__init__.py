"""
app/utils/__init__.py
Utility package for HEMOSCOREAPP.

Re-exports the most commonly used helpers so callers can write:
    from app.utils import load_json, now_timestamp, risk_color
"""

from app.utils.file_io import (
    load_json,
    save_json,
    load_csv,
    save_csv,
    load_excel,
    save_excel,
)
from app.utils.formatters import (
    now_timestamp,
    now_display,
    format_percentage,
    format_float,
    risk_label,
    format_risk_label,
    risk_color,
    risk_background_color,
)
from app.utils.friendly_labels import get_label, get_unit, get_tooltip

__all__ = [
    # file_io
    "load_json",
    "save_json",
    "load_csv",
    "save_csv",
    "load_excel",
    "save_excel",
    # formatters
    "now_timestamp",
    "now_display",
    "format_percentage",
    "format_float",
    "risk_label",
    "format_risk_label",
    "risk_color",
    "risk_background_color",
    # friendly_labels
    "get_label",
    "get_unit",
    "get_tooltip",
]
