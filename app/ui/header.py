"""
app/ui/header.py
Application header bar — branding block and primary action buttons.

Signals
-------
reset_requested          – User clicked "Reset".
test_case_requested      – User clicked "Load Test Case".
export_requested         – User clicked "Export Results".
save_baseline_requested  – User clicked "Save as Baseline".

Usage
-----
    header = AppHeader()
    header.reset_requested.connect(my_reset_handler)
    header.set_export_enabled(False)   # disable until a result is available
"""

from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from app.styles import Color
import app as _app


class AppHeader(QWidget):
    """Fixed-height top bar with the HEMOSCOREAPP brand and four action buttons."""

    # ── Signals ───────────────────────────────────────────────────────────────
    reset_requested         = Signal()
    test_case_requested     = Signal()
    export_requested        = Signal()
    save_baseline_requested = Signal()

    # ── Construction ─────────────────────────────────────────────────────────

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._build_ui()

    def _build_ui(self) -> None:
        self.setAutoFillBackground(True)
        self.setStyleSheet(
            f"AppHeader {{"
            f"  background-color: {Color.BG_ELEVATED};"
            f"  border-bottom: 1px solid {Color.BORDER};"
            f"}}"
        )
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)

        root = QHBoxLayout(self)
        root.setContentsMargins(28, 14, 28, 14)
        root.setSpacing(32)

        # ── Brand block ───────────────────────────────────────────────────────
        brand = QVBoxLayout()
        brand.setContentsMargins(0, 0, 0, 0)
        brand.setSpacing(2)

        app_name = QLabel(_app.APP_NAME)
        app_name.setStyleSheet(
            f"font-size: 21px; font-weight: 800; color: {Color.TEXT_PRIMARY}; "
            f"letter-spacing: 2px; background: transparent;"
        )
        brand.addWidget(app_name)

        subtitle = QLabel("Dynamic Cardiogenic Shock Risk Calculator")
        subtitle.setStyleSheet(
            f"font-size: 12px; font-weight: 400; color: {Color.TEXT_SECONDARY}; "
            f"background: transparent;"
        )
        brand.addWidget(subtitle)

        model_cap = QLabel("PULSAR XGBoost Model  ·  In-Hospital Mortality")
        model_cap.setStyleSheet(
            f"font-size: 10px; font-weight: 500; color: {Color.ACCENT}; "
            f"letter-spacing: 0.4px; background: transparent;"
        )
        brand.addWidget(model_cap)

        root.addLayout(brand)
        root.addStretch()

        # ── Action buttons ────────────────────────────────────────────────────
        btn_row = QHBoxLayout()
        btn_row.setContentsMargins(0, 0, 0, 0)
        btn_row.setSpacing(8)

        self._btn_reset    = self._make_btn("↺   Reset",           secondary=True)
        self._btn_test     = self._make_btn("⬇   Load Test Case",  secondary=True)
        self._btn_export   = self._make_btn("⬆   Export Results",  secondary=False)
        self._btn_baseline = self._make_btn("☆   Save as Baseline", secondary=True)

        btn_row.addWidget(self._btn_reset)
        btn_row.addWidget(self._btn_test)
        btn_row.addWidget(self._btn_export)
        btn_row.addWidget(self._btn_baseline)
        root.addLayout(btn_row)

        # ── Wire signals ──────────────────────────────────────────────────────
        self._btn_reset.clicked.connect(self.reset_requested)
        self._btn_test.clicked.connect(self.test_case_requested)
        self._btn_export.clicked.connect(self.export_requested)
        self._btn_baseline.clicked.connect(self.save_baseline_requested)

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _make_btn(label: str, *, secondary: bool) -> QPushButton:
        btn = QPushButton(label)
        btn.setProperty("secondary", "true" if secondary else "false")
        btn.setMinimumWidth(136)
        btn.setCursor(Qt.CursorShape.PointingHandCursor)
        return btn

    # ── Public setters ────────────────────────────────────────────────────────

    def set_export_enabled(self, enabled: bool) -> None:
        """Enable or disable the Export Results button."""
        self._btn_export.setEnabled(enabled)

    def set_baseline_enabled(self, enabled: bool) -> None:
        """Enable or disable the Save as Baseline button."""
        self._btn_baseline.setEnabled(enabled)

    def set_reset_enabled(self, enabled: bool) -> None:
        """Enable or disable the Reset button."""
        self._btn_reset.setEnabled(enabled)
