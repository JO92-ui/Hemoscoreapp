"""
app/ui/result_panel.py
Clinical result display panel for HEMOSCOREAPP.

Shows five card sections:
  A  –  Current Risk          (gauge + big percentage + tier badge + clinical text)
  B  –  Baseline vs Current   (two columns with delta summary)
  C  –  Reclassification      (category shift indicator)
  D  –  Variable Influence    (top ICE-delta contributions)
  E  –  Result footer         (model metadata + timestamp)

Public API
----------
  display_result(result: PredictionResult)
      Render a fresh prediction (no baseline comparison).

  display_comparison(result: PredictionResult, comparison: ComparisonResult)
      Render a prediction alongside its comparison to the stored baseline.

  clear()
      Reset everything back to the "waiting" state.
"""

from __future__ import annotations

import math

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QScrollArea,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from app.core.inference_service import PredictionResult
from app.core.risk_logic import ChangeLabel, ComparisonResult
from app.styles import Color
from app.ui.widgets import (
    CardFrame,
    HelperLabel,
    RiskBadge,
    RiskGaugePlaceholder,
    SectionTitle,
    StatusChip,
)
from app.utils.friendly_labels import get_label

import app as _app


# ══════════════════════════════════════════════════════════════════════════════
# Tiny layout helpers
# ══════════════════════════════════════════════════════════════════════════════

def _sep(horizontal: bool = True) -> QFrame:
    """Thin separator line."""
    line = QFrame()
    line.setFrameShape(
        QFrame.Shape.HLine if horizontal else QFrame.Shape.VLine
    )
    line.setStyleSheet(f"color: {Color.BORDER_SUBTLE}; background: {Color.BORDER_SUBTLE};")
    line.setFixedHeight(1) if horizontal else line.setFixedWidth(1)
    return line


def _kv_row(key: str, value: str, *, accent: bool = False) -> QWidget:
    """A compact key–value row for metadata blocks."""
    row = QWidget()
    row.setStyleSheet("background: transparent;")
    hbox = QHBoxLayout(row)
    hbox.setContentsMargins(0, 1, 0, 1)
    hbox.setSpacing(6)

    k = QLabel(key)
    k.setStyleSheet(
        f"color: {Color.TEXT_SECONDARY}; font-size: 11px; background: transparent;"
    )
    k.setFixedWidth(128)

    v = QLabel(str(value))
    v_color = Color.ACCENT if accent else Color.TEXT_PRIMARY
    v.setStyleSheet(
        f"color: {v_color}; font-size: 11px; font-weight: 600; background: transparent;"
    )
    v.setWordWrap(True)

    hbox.addWidget(k)
    hbox.addWidget(v, 1)
    return row


def _big_lbl(text: str, size: int = 46, color: str = Color.TEXT_PRIMARY) -> QLabel:
    lbl = QLabel(text)
    lbl.setStyleSheet(
        f"font-size: {size}px; font-weight: 800; color: {color}; "
        f"background: transparent; letter-spacing: 1px;"
    )
    lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
    return lbl


def _sub_lbl(text: str, size: int = 11, color: str = Color.TEXT_SECONDARY) -> QLabel:
    lbl = QLabel(text)
    lbl.setStyleSheet(
        f"font-size: {size}px; color: {color}; background: transparent;"
    )
    lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
    lbl.setWordWrap(True)
    return lbl


# ══════════════════════════════════════════════════════════════════════════════
# Clinical interpretation text
# ══════════════════════════════════════════════════════════════════════════════

_CLINICAL_TEXT: dict[str, str] = {
    "low":       "Predicted mortality risk is low. Patient profile is consistent "
                 "with a favorable in-hospital prognosis based on current parameters.",
    "medium":    "Predicted mortality risk is intermediate. Continued monitoring and "
                 "reassessment of hemodynamic targets is advisable.",
    "high":      "Predicted mortality risk is high. Clinical escalation of support "
                 "or reassessment of therapeutic strategy should be considered.",
    "very_high": "Predicted mortality risk is very high. Patient profile suggests "
                 "severe cardiogenic shock with poor prognosis. Urgent escalation "
                 "or palliative re-evaluation may be warranted.",
}


# ══════════════════════════════════════════════════════════════════════════════
# A – Current Risk card
# ══════════════════════════════════════════════════════════════════════════════

class _CurrentRiskCard(CardFrame):

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent, accent_top=True)
        vbox = self.inner_layout
        vbox.setAlignment(Qt.AlignmentFlag.AlignHCenter)

        # Gauge
        self._gauge = RiskGaugePlaceholder()
        h = QHBoxLayout()
        h.setAlignment(Qt.AlignmentFlag.AlignHCenter)
        h.addWidget(self._gauge)
        vbox.addLayout(h)

        # Percentage label (large)
        self._pct_lbl = _big_lbl("—", size=44, color=Color.TEXT_PRIMARY)
        vbox.addWidget(self._pct_lbl)

        # Tier badge
        self._badge = RiskBadge()
        badge_row = QHBoxLayout()
        badge_row.setAlignment(Qt.AlignmentFlag.AlignHCenter)
        badge_row.addWidget(self._badge)
        vbox.addLayout(badge_row)

        vbox.addSpacing(6)
        vbox.addWidget(_sep())
        vbox.addSpacing(4)

        # Clinical text
        self._clinical_lbl = HelperLabel(
            "Enter patient data and click Calculate Risk."
        )
        self._clinical_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._clinical_lbl.setWordWrap(True)
        vbox.addWidget(self._clinical_lbl)

    def update(self, pct: float, tier: str) -> None:  # noqa: A003
        tier_color = {
            "low":       Color.RISK_LOW,
            "medium":    Color.RISK_MEDIUM,
            "high":      Color.RISK_HIGH,
            "very_high": Color.RISK_VERY_HIGH,
        }.get(tier, Color.TEXT_PRIMARY)

        self._gauge.set_value(pct, tier)
        self._pct_lbl.setText(f"{pct:.1f}%")
        self._pct_lbl.setStyleSheet(
            f"font-size: 44px; font-weight: 800; color: {tier_color}; "
            f"background: transparent; letter-spacing: 1px;"
        )
        self._badge.set_tier(tier)
        self._clinical_lbl.setText(
            _CLINICAL_TEXT.get(tier, "")
        )

    def clear(self) -> None:
        self._gauge.reset()
        self._pct_lbl.setText("—")
        self._pct_lbl.setStyleSheet(
            f"font-size: 44px; font-weight: 800; color: {Color.TEXT_PRIMARY}; "
            f"background: transparent; letter-spacing: 1px;"
        )
        self._badge.set_tier("low")
        self._clinical_lbl.setText("Enter patient data and click Calculate Risk.")


# ══════════════════════════════════════════════════════════════════════════════
# B – Baseline vs Current card
# ══════════════════════════════════════════════════════════════════════════════

class _BaselineCard(CardFrame):

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        vbox = self.inner_layout
        vbox.addWidget(SectionTitle("B  ·  Baseline vs Current"))
        vbox.addWidget(_sep())

        grid = QGridLayout()
        grid.setHorizontalSpacing(24)
        grid.setVerticalSpacing(4)
        grid.setContentsMargins(4, 8, 4, 4)

        def _col_header(text: str) -> QLabel:
            lbl = QLabel(text)
            lbl.setStyleSheet(
                f"color: {Color.TEXT_SECONDARY}; font-size: 10px; "
                f"font-weight: 700; letter-spacing: 0.6px; background: transparent;"
            )
            lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            return lbl

        grid.addWidget(_col_header("BASELINE"), 0, 1)
        grid.addWidget(_col_header("CURRENT"),  0, 2)
        grid.addWidget(_col_header("Δ ABS"),    0, 3)
        grid.addWidget(_col_header("Δ REL"),    0, 4)

        row_label = QLabel("Risk %")
        row_label.setStyleSheet(
            f"color: {Color.TEXT_SECONDARY}; font-size: 11px; background: transparent;"
        )
        grid.addWidget(row_label, 1, 0)

        self._base_pct = self._cell()
        self._curr_pct = self._cell()
        self._d_abs    = self._cell()
        self._d_rel    = self._cell()

        grid.addWidget(self._base_pct, 1, 1)
        grid.addWidget(self._curr_pct, 1, 2)
        grid.addWidget(self._d_abs,    1, 3)
        grid.addWidget(self._d_rel,    1, 4)

        grid_host = QWidget()
        grid_host.setStyleSheet("background: transparent;")
        grid_host.setLayout(grid)
        vbox.addWidget(grid_host)

        # Trend arrow + label
        self._trend_row = QHBoxLayout()
        self._trend_row.setAlignment(Qt.AlignmentFlag.AlignHCenter)
        self._trend_lbl = QLabel("—")
        self._trend_lbl.setStyleSheet(
            f"font-size: 26px; background: transparent; color: {Color.TEXT_DISABLED};"
        )
        self._trend_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._trend_row.addWidget(self._trend_lbl)
        vbox.addLayout(self._trend_row)

    @staticmethod
    def _cell() -> QLabel:
        lbl = QLabel("—")
        lbl.setStyleSheet(
            f"color: {Color.TEXT_PRIMARY}; font-size: 14px; font-weight: 600; "
            f"background: transparent;"
        )
        lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        return lbl

    def update(self, comp: ComparisonResult) -> None:  # noqa: A003
        bp = comp.baseline.risk_percent
        cp = comp.current.risk_percent
        da = comp.delta_absolute * 100.0
        dr = comp.delta_relative

        self._base_pct.setText(f"{bp:.1f}%")
        self._curr_pct.setText(f"{cp:.1f}%")

        sign = "+" if da >= 0 else ""
        self._d_abs.setText(f"{sign}{da:.1f} pp")
        if dr is not None and not math.isnan(dr):
            self._d_rel.setText(f"{sign}{dr * 100.0:.0f}%")
        else:
            self._d_rel.setText("n/a")

        # Colour-code delta absolute
        da_color = Color.RISK_LOW if da < -0.5 else (
            Color.RISK_VERY_HIGH if da > 0.5 else Color.TEXT_SECONDARY
        )
        self._d_abs.setStyleSheet(
            f"color: {da_color}; font-size: 14px; font-weight: 700; background: transparent;"
        )

        # Trend arrow
        if comp.change_label == ChangeLabel.IMPROVED:
            arrow, color = "↓", Color.RISK_LOW
        elif comp.change_label == ChangeLabel.WORSENED:
            arrow, color = "↑", Color.RISK_VERY_HIGH
        else:
            arrow, color = "→", Color.TEXT_SECONDARY

        self._trend_lbl.setText(arrow)
        self._trend_lbl.setStyleSheet(
            f"font-size: 30px; font-weight: 700; color: {color}; background: transparent;"
        )

    def clear(self) -> None:
        for lbl in (self._base_pct, self._curr_pct, self._d_abs, self._d_rel):
            lbl.setText("—")
            lbl.setStyleSheet(
                f"color: {Color.TEXT_PRIMARY}; font-size: 14px; font-weight: 600; "
                f"background: transparent;"
            )
        self._trend_lbl.setText("—")
        self._trend_lbl.setStyleSheet(
            f"font-size: 30px; color: {Color.TEXT_DISABLED}; background: transparent;"
        )


# ══════════════════════════════════════════════════════════════════════════════
# C – Reclassification card
# ══════════════════════════════════════════════════════════════════════════════

class _ReclassCard(CardFrame):

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        vbox = self.inner_layout
        vbox.addWidget(SectionTitle("C  ·  Reclassification"))
        vbox.addWidget(_sep())

        self._status_chip = StatusChip("No baseline stored", variant="info")
        row = QHBoxLayout()
        row.setAlignment(Qt.AlignmentFlag.AlignHCenter)
        row.addWidget(self._status_chip)
        vbox.addLayout(row)

        self._shift_lbl = _sub_lbl("", size=13, color=Color.TEXT_PRIMARY)
        vbox.addWidget(self._shift_lbl)

    def update(self, comp: ComparisonResult) -> None:  # noqa: A003
        variant_map = {
            ChangeLabel.IMPROVED:  "success",
            ChangeLabel.WORSENED:  "error",
            ChangeLabel.UNCHANGED: "info",
        }
        text_map = {
            ChangeLabel.IMPROVED:  "IMPROVED",
            ChangeLabel.WORSENED:  "WORSENED",
            ChangeLabel.UNCHANGED: "UNCHANGED",
        }
        variant = variant_map.get(comp.change_label, "info")
        text    = text_map.get(comp.change_label, "—")

        self._status_chip.setText(text)
        self._status_chip.set_variant(variant)

        if comp.category_shift:
            self._shift_lbl.setText(
                f"Category shift:   {comp.category_shift}"
            )
            self._shift_lbl.setStyleSheet(
                f"font-size: 12px; font-weight: 600; "
                f"color: {Color.TEXT_PRIMARY}; background: transparent;"
            )
        else:
            self._shift_lbl.setText("No category shift")
            self._shift_lbl.setStyleSheet(
                f"font-size: 12px; color: {Color.TEXT_SECONDARY}; background: transparent;"
            )

    def clear(self) -> None:
        self._status_chip.setText("No baseline stored")
        self._status_chip.set_variant("info")
        self._shift_lbl.setText("")


# ══════════════════════════════════════════════════════════════════════════════
# D – Variable Influence card
# ══════════════════════════════════════════════════════════════════════════════

class _InfluenceCard(CardFrame):

    _COL_WIDTHS = (168, 72, 72, 140, 44)   # Feature, Val, Ref, Direction, |Δ|

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        vbox = self.inner_layout

        vbox.addWidget(
            SectionTitle(
                "D  ·  Variable Influence",
                "Non-causal heuristic proxy  ·  ICE-delta perturbation method",
            )
        )
        vbox.addWidget(_sep())

        # Disclaimer chip
        disc = StatusChip("MODEL EXPLANATION PROXY — Non-causal heuristic", "warning")
        disc.setWordWrap(True)
        disc.setFixedHeight(22)
        vbox.addWidget(disc)

        vbox.addSpacing(4)

        # Column headers
        self._table_widget = QWidget()
        self._table_widget.setStyleSheet("background: transparent;")
        self._table_vbox = QVBoxLayout(self._table_widget)
        self._table_vbox.setContentsMargins(0, 0, 0, 0)
        self._table_vbox.setSpacing(0)

        vbox.addWidget(self._table_widget)
        self._render_empty()

    def _header_row(self) -> QWidget:
        row = QWidget()
        row.setStyleSheet(
            f"background: {Color.BG_ELEVATED}; border-radius: 4px; "
            f"border: 1px solid {Color.BORDER_SUBTLE};"
        )
        hbox = QHBoxLayout(row)
        hbox.setContentsMargins(6, 4, 6, 4)
        hbox.setSpacing(0)
        headers = ["Feature", "Value", "Ref", "Direction", "|Δp|"]
        for header, width in zip(headers, self._COL_WIDTHS):
            lbl = QLabel(header)
            lbl.setFixedWidth(width)
            lbl.setStyleSheet(
                f"color: {Color.TEXT_SECONDARY}; font-size: 10px; "
                f"font-weight: 700; letter-spacing: 0.5px; background: transparent; "
                f"border: none;"
            )
            hbox.addWidget(lbl)
        row.setFixedHeight(28)
        return row

    def _render_empty(self) -> None:
        self._clear_table()
        empty = HelperLabel("Run a prediction to see variable influence.")
        empty.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._table_vbox.addWidget(empty)

    def _clear_table(self) -> None:
        while self._table_vbox.count():
            item = self._table_vbox.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

    def update(self, result: PredictionResult) -> None:  # noqa: A003
        self._clear_table()
        exp = result.explanation

        # If explanation was skipped (fast mode) show placeholder
        if not exp.all_contributions:
            self._render_empty()
            return

        self._table_vbox.addWidget(self._header_row())

        # Combine top_increasing + top_decreasing deduplicated, by importance rank
        seen: set[str] = set()
        ordered = []
        for cont in sorted(
            exp.all_contributions,
            key=lambda c: abs(c.delta_probability),
            reverse=True,
        ):
            if cont.feature not in seen:
                ordered.append(cont)
                seen.add(cont.feature)
            if len(ordered) >= 10:
                break

        alternating = [Color.BG_SURFACE, Color.BG_ELEVATED]

        for i, cont in enumerate(ordered):
            row_bg = alternating[i % 2]
            row = QWidget()
            row.setStyleSheet(
                f"background: {row_bg}; border-radius: 3px; border: none;"
            )
            hbox = QHBoxLayout(row)
            hbox.setContentsMargins(6, 5, 6, 5)
            hbox.setSpacing(0)

            fname_lbl = QLabel(get_label(cont.feature))
            fname_lbl.setFixedWidth(self._COL_WIDTHS[0])
            fname_lbl.setStyleSheet(
                f"color: {Color.TEXT_PRIMARY}; font-size: 11px; "
                f"background: transparent; border: none;"
            )

            val_lbl = QLabel(f"{cont.patient_value:.2g}")
            val_lbl.setFixedWidth(self._COL_WIDTHS[1])
            val_lbl.setStyleSheet(
                f"color: {Color.TEXT_PRIMARY}; font-size: 11px; "
                f"background: transparent; border: none;"
            )

            ref_lbl = QLabel(f"{cont.reference_value:.2g}")
            ref_lbl.setFixedWidth(self._COL_WIDTHS[2])
            ref_lbl.setStyleSheet(
                f"color: {Color.TEXT_SECONDARY}; font-size: 11px; "
                f"background: transparent; border: none;"
            )

            dir_color = {
                "up":        Color.RISK_VERY_HIGH,
                "down":      Color.RISK_LOW,
                "uncertain": Color.TEXT_SECONDARY,
            }.get(cont.direction, Color.TEXT_SECONDARY)
            dir_lbl = QLabel(cont.direction_label)
            dir_lbl.setFixedWidth(self._COL_WIDTHS[3])
            dir_lbl.setStyleSheet(
                f"color: {dir_color}; font-size: 10px; font-weight: 600; "
                f"background: transparent; border: none;"
            )

            dp = cont.delta_probability * 100.0
            dp_sign = "+" if dp > 0 else ""
            dp_color = Color.RISK_VERY_HIGH if dp > 0.5 else (
                Color.RISK_LOW if dp < -0.5 else Color.TEXT_SECONDARY
            )
            dp_lbl = QLabel(f"{dp_sign}{dp:.1f}%")
            dp_lbl.setFixedWidth(self._COL_WIDTHS[4])
            dp_lbl.setStyleSheet(
                f"color: {dp_color}; font-size: 11px; font-weight: 600; "
                f"background: transparent; border: none;"
            )

            for lbl in (fname_lbl, val_lbl, ref_lbl, dir_lbl, dp_lbl):
                hbox.addWidget(lbl)

            self._table_vbox.addWidget(row)

    def clear(self) -> None:
        self._render_empty()


# ══════════════════════════════════════════════════════════════════════════════
# E – Result footer block
# ══════════════════════════════════════════════════════════════════════════════

class _ResultFooterCard(CardFrame):

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        vbox = self.inner_layout

        disclaimer = StatusChip(
            "⚠  For research use only  ·  Clinical decision support prototype",
            variant="warning",
        )
        disclaimer.setWordWrap(True)
        vbox.addWidget(disclaimer)

        vbox.addSpacing(6)

        self._kv_model = _kv_row("Model",    f"{_app.APP_NAME}", accent=True)
        self._kv_ver   = _kv_row("Version",  f"v{_app.APP_VERSION}")
        self._kv_feat  = _kv_row("Features", "32  (PULSAR XGBoost)")
        self._kv_ts    = _kv_row("Last run", "—")

        for w in (self._kv_model, self._kv_ver, self._kv_feat, self._kv_ts):
            vbox.addWidget(w)

    def update_timestamp(self, ts: str) -> None:
        for i in range(self._kv_ts.layout().count()):
            item = self._kv_ts.layout().itemAt(i)
            if item and item.widget() and isinstance(item.widget(), QLabel):
                if item.widget().text() not in ("Last run", "—", ts):
                    continue
                # second label = value label
                break
        # Rebuild kv_ts value label
        layout = self._kv_ts.layout()
        if layout and layout.count() >= 2:
            val_item = layout.itemAt(1)
            if val_item and val_item.widget():
                val_item.widget().setText(ts)

    def clear(self) -> None:
        self.update_timestamp("—")


# ══════════════════════════════════════════════════════════════════════════════
# ResultPanel  –  the public composite widget
# ══════════════════════════════════════════════════════════════════════════════

class ResultPanel(QWidget):
    """Scrollable right-side panel showing all result cards (A–E)."""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._build_ui()

    def _build_ui(self) -> None:
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(0)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setStyleSheet(
            f"QScrollArea {{ background: {Color.BG_APP}; border: none; }}"
        )

        content = QWidget()
        content.setStyleSheet(f"background: {Color.BG_APP};")
        content.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        scroll.setWidget(content)

        layout = QVBoxLayout(content)
        layout.setContentsMargins(16, 16, 8, 24)
        layout.setSpacing(12)

        self._card_risk    = _CurrentRiskCard()
        self._card_base    = _BaselineCard()
        self._card_reclass = _ReclassCard()
        self._card_infl    = _InfluenceCard()
        self._card_footer  = _ResultFooterCard()

        for card in (
            self._card_risk,
            self._card_base,
            self._card_reclass,
            self._card_infl,
            self._card_footer,
        ):
            layout.addWidget(card)

        layout.addStretch()
        outer.addWidget(scroll)

    # ── Public API ─────────────────────────────────────────────────────────────

    def display_result(self, result: PredictionResult) -> None:
        """Show a prediction without baseline comparison.

        Cards B and C revert to their cleared/waiting state.
        """
        rr = result.risk_result
        self._card_risk.update(rr.risk_percent, rr.category.value)
        self._card_base.clear()
        self._card_reclass.clear()
        self._card_infl.update(result)
        self._card_footer.update_timestamp(result.timestamp)

    def display_comparison(
        self,
        result: PredictionResult,
        comparison: ComparisonResult,
    ) -> None:
        """Show a prediction alongside baseline comparison data."""
        rr = result.risk_result
        self._card_risk.update(rr.risk_percent, rr.category.value)
        self._card_base.update(comparison)
        self._card_reclass.update(comparison)
        self._card_infl.update(result)
        self._card_footer.update_timestamp(result.timestamp)

    def clear(self) -> None:
        """Reset all cards to their initial empty state."""
        self._card_risk.clear()
        self._card_base.clear()
        self._card_reclass.clear()
        self._card_infl.clear()
        self._card_footer.clear()
