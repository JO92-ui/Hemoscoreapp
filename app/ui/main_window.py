"""
app/ui/main_window.py
HEMOSCOREAPP main application window.

Layout
------
  ┌─────────────────────── AppHeader ────────────────────────┐
  │  InputPanel (left, 55 %)  │  ResultPanel  (right, 45 %)  │
  └─────────────────────── AppFooter ────────────────────────┘

Inference flow
--------------
  1.  Any input field changes → _schedule_quick_update() (200 ms debounce)
  2.  Debounce fires → _run_quick_update()  (include_explanation=False)
  3.  Full explanation is built in _run_full_explanation() and triggered:
        •  after a quick update that changes the risk category, OR
        •  immediately on "Calculate Risk" (no debounce, full mode), OR
        •  after loading a test case / resetting.

Baseline snapshot
-----------------
  •  "Save as Baseline" stores a copy of the current inputs.
  •  Subsequent predictions call service.compare() and display
     the full comparison (baseline vs current) until Reset is pressed.
"""

from __future__ import annotations

import logging
from typing import Any

from PySide6.QtCore import QTimer, Qt
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QSizePolicy,
    QSplitter,
    QVBoxLayout,
    QWidget,
)

from app.core.inference_service import InferenceService, PredictionResult
from app.core.risk_logic import ComparisonResult
from app.styles import Color
from app.ui.footer import AppFooter
from app.ui.header import AppHeader
from app.ui.input_panel import InputPanel
from app.ui.result_panel import ResultPanel
from app.utils.formatters import now_display

logger = logging.getLogger(__name__)

_DEBOUNCE_MS: int = 220   # ms after last keystroke before running inference


class MainWindow(QMainWindow):
    """Primary application window."""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("HEMOSCOREAPP  –  Cardiogenic Shock Risk Calculator")
        self.setMinimumSize(1280, 760)
        self.resize(1480, 860)

        self._service  = InferenceService()
        self._baseline: dict[str, Any] | None = None
        self._last_result: PredictionResult | None = None
        self._last_category: str = ""

        # Debounce timer (single-shot, restarted on every input change)
        self._debounce = QTimer(self)
        self._debounce.setSingleShot(True)
        self._debounce.setInterval(_DEBOUNCE_MS)
        self._debounce.timeout.connect(self._run_quick_update)

        self._build_ui()
        self._connect_signals()

    # ── UI construction ───────────────────────────────────────────────────────

    def _build_ui(self) -> None:
        central = QWidget()
        central.setStyleSheet(f"background: {Color.BG_APP};")
        self.setCentralWidget(central)

        root = QVBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # Header
        self._header = AppHeader()
        root.addWidget(self._header)

        # ── Main content area ─────────────────────────────────────────────────
        body_wrapper = QWidget()
        body_wrapper.setStyleSheet(f"background: {Color.BG_APP};")
        body_layout = QVBoxLayout(body_wrapper)
        body_layout.setContentsMargins(0, 0, 0, 0)
        body_layout.setSpacing(0)

        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setHandleWidth(2)
        splitter.setStyleSheet(
            f"QSplitter::handle {{ background: {Color.BORDER}; }}"
        )

        self._input_panel  = InputPanel()
        self._result_panel = ResultPanel()

        splitter.addWidget(self._input_panel)
        splitter.addWidget(self._result_panel)
        splitter.setStretchFactor(0, 55)
        splitter.setStretchFactor(1, 45)
        splitter.setSizes([820, 660])

        body_layout.addWidget(splitter)
        root.addWidget(body_wrapper, 1)

        # Footer
        self._footer = AppFooter()
        root.addWidget(self._footer)

    def _connect_signals(self) -> None:
        # Input changes → debounced quick update
        self._input_panel.inputs_changed.connect(self._on_inputs_changed)

        # Header buttons
        self._header.reset_requested.connect(self._handle_reset)
        self._header.test_case_requested.connect(self._handle_load_test_case)
        self._header.export_requested.connect(self._handle_export)
        self._header.save_baseline_requested.connect(self._handle_save_baseline)

        # Disable export until we have a result
        self._header.set_export_enabled(False)

    # ── Inference helpers ─────────────────────────────────────────────────────

    def _get_inputs(self) -> dict[str, Any]:
        """Return current input dict with None values stripped out."""
        raw = self._input_panel.get_current_inputs()
        return {k: v for k, v in raw.items() if v is not None}

    def _on_inputs_changed(self) -> None:
        """Restart debounce timer on every input change."""
        self._debounce.start()

    def _run_quick_update(self) -> None:
        """Fast inference pass (no explanation).  Triggered by debounce timer."""
        inputs = self._get_inputs()
        try:
            result = self._service.predict_from_inputs(
                inputs, include_explanation=False
            )
        except Exception as exc:
            logger.warning("Quick update failed: %s", exc)
            return

        self._last_result = result
        new_category = result.risk_result.category.value

        # Display the quick result immediately
        if self._baseline is not None:
            self._run_comparison(result)
        else:
            self._result_panel.display_result(result)

        # Show which fields were imputed
        self._input_panel.highlight_imputed_fields(result.imputed_fields)

        # Show out_of_range warning in footer
        if result.out_of_range_fields:
            self._footer.update_timestamp(
                f"{result.timestamp}  ·  ⚠ {len(result.out_of_range_fields)} out-of-range"
            )
        else:
            self._footer.update_timestamp(result.timestamp)

        self._header.set_export_enabled(True)
        self._header.set_baseline_enabled(True)

        # If category changed, queue full explanation without blocking the UI
        if new_category != self._last_category:
            self._last_category = new_category
            QTimer.singleShot(0, self._run_full_explanation)

    def _run_full_explanation(self) -> None:
        """Full inference pass (with ICE-delta explanation)."""
        inputs = self._get_inputs()
        try:
            result = self._service.predict_from_inputs(
                inputs, include_explanation=True
            )
        except Exception as exc:
            logger.warning("Full explanation failed: %s", exc)
            return

        self._last_result = result

        if self._baseline is not None:
            self._run_comparison(result)
        else:
            self._result_panel.display_result(result)

        self._input_panel.highlight_imputed_fields(result.imputed_fields)

        if result.out_of_range_fields:
            self._footer.update_timestamp(
                f"{result.timestamp}  ·  ⚠ {len(result.out_of_range_fields)} out-of-range"
            )
        else:
            self._footer.update_timestamp(result.timestamp)

    def _run_comparison(self, current_result: PredictionResult) -> None:
        """Run baseline-vs-current comparison and display it."""
        if self._baseline is None:
            return
        try:
            comparison = self._service.compare(
                self._baseline, self._get_inputs()
            )
            self._result_panel.display_comparison(current_result, comparison)
        except Exception as exc:
            logger.warning("Comparison failed: %s", exc)
            self._result_panel.display_result(current_result)

    # ── Button handlers ───────────────────────────────────────────────────────

    def _handle_reset(self) -> None:
        """Clear all inputs, baseline, and result panel."""
        self._debounce.stop()
        self._baseline = None
        self._last_result = None
        self._last_category = ""

        self._input_panel.reset_inputs()       # emits inputs_changed → debounce
        self._debounce.stop()                  # cancel the debounce triggered by reset
        self._result_panel.clear()
        self._footer.update_timestamp(now_display())
        self._header.set_export_enabled(False)
        self._header.set_baseline_enabled(False)

    def _handle_load_test_case(self) -> None:
        """Load the reference test case from appdata/ and run full inference."""
        self._debounce.stop()

        try:
            result = self._service.run_test_case()
        except Exception as exc:
            logger.error("Failed to load test case: %s", exc)
            self._show_inline_error(f"Could not load test case: {exc}")
            return

        # Populate the input form without triggering many intermediate recalculations
        self._input_panel.inputs_changed.disconnect(self._on_inputs_changed)
        self._input_panel.load_inputs(result.feature_dict)
        self._input_panel.inputs_changed.connect(self._on_inputs_changed)

        self._last_result = result
        self._last_category = result.risk_result.category.value
        self._result_panel.display_result(result)
        self._input_panel.highlight_imputed_fields(result.imputed_fields)
        self._footer.update_timestamp(result.timestamp)
        self._header.set_export_enabled(True)
        self._header.set_baseline_enabled(True)

    def _handle_save_baseline(self) -> None:
        """Snapshot the current inputs as the baseline reference."""
        self._baseline = self._get_inputs()
        logger.info("Baseline saved (%d features).", len(self._baseline))
        self._footer.update_timestamp(f"{now_display()}  ·  Baseline saved")

        # Immediately show comparison if we already have a result
        if self._last_result is not None:
            self._run_comparison(self._last_result)

    def _handle_export(self) -> None:
        """Export placeholder – to be implemented in Part 5."""
        logger.info("Export requested (not yet implemented).")
        self._footer.update_timestamp(f"{now_display()}  ·  Export – coming in PARTE 5")

    # ── Error display ─────────────────────────────────────────────────────────

    def _show_inline_error(self, message: str) -> None:
        """Display a temporary non-blocking error banner in the footer."""
        self._footer.update_timestamp(f"⚠  {message}")
