"""
app/ui/footer.py
Application footer bar — model metadata and research disclaimer.

Usage
-----
    footer = AppFooter()
    footer.update_timestamp("2026-03-15  09:41")
"""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QSizePolicy,
    QWidget,
)

from app.styles import Color
import app as _app


class AppFooter(QWidget):
    """Fixed-height bottom bar with model metadata and a live timestamp slot."""

    _HEIGHT = 36

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._build_ui()

    def _build_ui(self) -> None:
        self.setAutoFillBackground(True)
        self.setStyleSheet(
            f"AppFooter {{"
            f"  background-color: {Color.BG_ELEVATED};"
            f"  border-top: 1px solid {Color.BORDER};"
            f"}}"
        )
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.setFixedHeight(self._HEIGHT)

        hbox = QHBoxLayout(self)
        hbox.setContentsMargins(28, 0, 28, 0)
        hbox.setSpacing(0)

        # ── Static segments ───────────────────────────────────────────────────
        segments = [
            ("PULSAR XGBoost", True),
            None,
            (f"v{_app.APP_VERSION}", False),
            None,
            ("32 features", False),
            None,
            ("For research use only  ·  Clinical decision support prototype", False),
        ]

        for seg in segments:
            if seg is None:
                hbox.addWidget(self._sep())
            else:
                text, accent = seg
                hbox.addWidget(self._info(text, accent=accent))

        hbox.addStretch()

        # ── Live timestamp (right-aligned) ────────────────────────────────────
        self._ts_lbl = self._info("—")
        hbox.addWidget(self._ts_lbl)

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _info(text: str, *, accent: bool = False) -> QLabel:
        lbl = QLabel(text)
        color = Color.ACCENT if accent else Color.TEXT_SECONDARY
        lbl.setStyleSheet(
            f"font-size: 11px; color: {color}; background: transparent;"
        )
        lbl.setAlignment(Qt.AlignmentFlag.AlignVCenter)
        return lbl

    @staticmethod
    def _sep() -> QLabel:
        sep = QLabel("  ·  ")
        sep.setStyleSheet(
            f"font-size: 11px; color: {Color.BORDER}; background: transparent;"
        )
        sep.setAlignment(Qt.AlignmentFlag.AlignVCenter)
        return sep

    # ── Public interface ──────────────────────────────────────────────────────

    def update_timestamp(self, ts: str) -> None:
        """Refresh the timestamp displayed at the right end of the footer."""
        self._ts_lbl.setText(ts)
