"""
app/ui
PySide6 user-interface layer for HEMOSCOREAPP.

Public exports
--------------
AppHeader       – Top header bar with branding and action buttons.
AppFooter       – Bottom footer bar with model metadata.
InputPanel      – Scrollable clinical input form (32 PULSAR features).
CardFrame       – Rounded dark card container.
SectionTitle    – Accent-bar section heading widget.
HelperLabel     – Secondary muted-text label.
RiskBadge       – Color-coded risk tier badge.
StatusChip      – Compact status indicator chip.
LabeledFieldRow – Label + input widget pair with imputation highlight support.
RiskGaugePlaceholder – Circular arc gauge placeholder widget.
"""

from app.ui.widgets import (
    CardFrame,
    HelperLabel,
    LabeledFieldRow,
    RiskBadge,
    RiskGaugePlaceholder,
    SectionTitle,
    StatusChip,
)
from app.ui.header import AppHeader
from app.ui.footer import AppFooter
from app.ui.input_panel import InputPanel
from app.ui.result_panel import ResultPanel
from app.ui.main_window import MainWindow

__all__ = [
    "AppHeader",
    "AppFooter",
    "InputPanel",
    "ResultPanel",
    "MainWindow",
    "CardFrame",
    "SectionTitle",
    "HelperLabel",
    "RiskBadge",
    "StatusChip",
    "LabeledFieldRow",
    "RiskGaugePlaceholder",
]
