"""
app/ui/input_panel.py
Scrollable clinical input form for the 32 PULSAR model features.

Layout
------
  A  ·  Hemodynamics — Current          (2 columns)
  B  ·  Hemodynamics — Delta            (2 columns)
  C  ·  Time Off Target (TOT-hours)     (2 columns)
  D  ·  Clinical Fixed Variables        (2 columns)
  E  ·  Shock Severity — SCAI           (1 column, wide selectors)
  F  ·  Mechanical & Organ Support      (2 columns)
  G  ·  Additional Variables            (auto, overflow from spec JSON)

Public API
----------
  get_current_inputs()  -> dict[str, float | None]
  load_inputs(data: dict)
  reset_inputs()
  highlight_imputed_fields(field_names: list[str])
  clear_imputed_highlights()

Signal
------
  inputs_changed  — emitted whenever any field value changes.
"""

from __future__ import annotations

import json
from typing import Any

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QComboBox,
    QDoubleSpinBox,
    QGridLayout,
    QScrollArea,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from app import config
from app.styles import Color
from app.ui.widgets import CardFrame, LabeledFieldRow, SectionTitle
from app.utils.friendly_labels import get_label, get_tooltip, get_unit


# ══════════════════════════════════════════════════════════════════════════════
# Section definitions: (title, subtitle, feature_list, n_columns)
# ══════════════════════════════════════════════════════════════════════════════

_SECTIONS: list[tuple[str, str, list[str], int]] = [
    (
        "A  ·  Hemodynamics — Current",
        "PA catheter measurements at most recent assessment",
        [
            "hr_pacath", "cpi_rap_pacath", "lactate",
            "pawp_pacath", "rap_pacath", "opp_pacath",
        ],
        2,
    ),
    (
        "B  ·  Hemodynamics — Delta",
        "Change from previous to most recent PA catheter assessment",
        [
            "hr_pacath_delta", "cpi_rap_pacath_delta", "lactate_delta",
            "pawp_pacath_delta", "rap_pacath_delta", "opp_pacath_delta",
        ],
        2,
    ),
    (
        "C  ·  Time Off Target (TOT-hours)",
        "Cumulative hours each hemodynamic parameter was outside its target range",
        [
            "hr_pacath_tot_hours", "cpi_rap_pacath_tot_hours", "lactate_tot_hours",
            "pawp_pacath_tot_hours", "rap_pacath_tot_hours", "opp_pacath_tot_hours",
        ],
        2,
    ),
    (
        "D  ·  Clinical Fixed Variables",
        "Baseline demographic and biochemical data",
        [
            "base_age_years", "base_sex_female",
            "base_diabetes", "base_hypertension",
            "base_cs_etiology", "base_creatinine",
        ],
        2,
    ),
    (
        "E  ·  Shock Severity — SCAI Classification",
        "Cardiogenic shock staging at admission and worst 48-hour stage",
        [
            "base_scai_admission_num",
            "base_scai_max_48h_num",
            "scai_worsening",
        ],
        1,
    ),
    (
        "F  ·  Mechanical & Organ Support",
        "Hemodynamic assist devices and organ support active during assessment",
        [
            "base_iabp", "base_impella",
            "base_ecmo", "base_ventilation",
            "base_renal_replacement_therapy",
        ],
        2,
    ),
]


# ══════════════════════════════════════════════════════════════════════════════
# Spinner range / precision: (min, max, step, decimals)
# ══════════════════════════════════════════════════════════════════════════════

_SPIN_CONFIG: dict[str, tuple[float, float, float, int]] = {
    # ── A. Current ───────────────────────────────────────────────────────────
    "hr_pacath":            (20.0,   250.0,  1.0,   0),
    "cpi_rap_pacath":       (0.0,    8.0,    0.01,  3),
    "lactate":              (0.1,    30.0,   0.1,   1),
    "pawp_pacath":          (0.0,    60.0,   1.0,   0),
    "rap_pacath":           (0.0,    40.0,   1.0,   0),
    "opp_pacath":           (0.0,   150.0,   1.0,   0),
    # ── B. Delta ─────────────────────────────────────────────────────────────
    "hr_pacath_delta":          (-150.0, 150.0,  1.0,   0),
    "cpi_rap_pacath_delta":     (-5.0,   5.0,    0.01,  3),
    "lactate_delta":            (-20.0,  20.0,   0.1,   1),
    "pawp_pacath_delta":        (-40.0,  40.0,   1.0,   0),
    "rap_pacath_delta":         (-30.0,  30.0,   1.0,   0),
    "opp_pacath_delta":         (-80.0,  80.0,   1.0,   0),
    # ── C. TOT-hours ─────────────────────────────────────────────────────────
    "hr_pacath_tot_hours":          (0.0, 999.0, 0.5, 1),
    "cpi_rap_pacath_tot_hours":     (0.0, 999.0, 0.5, 1),
    "lactate_tot_hours":            (0.0, 999.0, 0.5, 1),
    "pawp_pacath_tot_hours":        (0.0, 999.0, 0.5, 1),
    "rap_pacath_tot_hours":         (0.0, 999.0, 0.5, 1),
    "opp_pacath_tot_hours":         (0.0, 999.0, 0.5, 1),
    # ── D. Clinical ──────────────────────────────────────────────────────────
    "base_age_years":   (18.0, 105.0, 1.0, 0),
    "base_creatinine":  (0.1,  30.0,  0.1, 1),
}

# ══════════════════════════════════════════════════════════════════════════════
# Combo options: feature → [(display_text, numeric_value), ...]
# ══════════════════════════════════════════════════════════════════════════════

_SCAI_ITEMS: list[tuple[str, float]] = [
    ("1  —  Stage A  (At Risk)",          1.0),
    ("2  —  Stage B  (Beginning shock)",  2.0),
    ("3  —  Stage C  (Classic shock)",    3.0),
    ("4  —  Stage D  (Deteriorating)",    4.0),
    ("5  —  Stage E  (Extremis)",         5.0),
]

_ORDINAL_OPTIONS: dict[str, list[tuple[str, float]]] = {
    "base_scai_admission_num": _SCAI_ITEMS,
    "base_scai_max_48h_num":   _SCAI_ITEMS,
    "scai_worsening": [
        ("0  —  No worsening",    0.0),
        ("1  —  +1 stage",        1.0),
        ("2  —  +2 stages",       2.0),
        ("3  —  +3 stages",       3.0),
        ("4  —  +4 stages",       4.0),
    ],
    "base_ventilation": [
        ("0  —  None (no ventilatory support)",  0.0),
        ("1  —  NIV  (non-invasive)",            1.0),
        ("2  —  IMV  (invasive / intubated)",    2.0),
    ],
    "base_cs_etiology": [
        ("1  —  AMI-CS  (Acute Myocardial Infarction)",  1.0),
        ("2  —  HF-CS   (De-novo Heart Failure)",        2.0),
    ],
}

_BINARY_OPTIONS: list[tuple[str, float]] = [
    ("0  —  No",   0.0),
    ("1  —  Yes",  1.0),
]

_SEX_OPTIONS: list[tuple[str, float]] = [
    ("0  —  Male",    0.0),
    ("1  —  Female",  1.0),
]


# ══════════════════════════════════════════════════════════════════════════════
# Widget factory helpers
# ══════════════════════════════════════════════════════════════════════════════

def _make_spinner(feature: str) -> QDoubleSpinBox:
    """Create a QDoubleSpinBox for *feature*.

    The minimum is set one step below the clinical minimum as a sentinel
    value; when the spinner is at its minimum it displays "—" (not entered).
    """
    lo, hi, step, dec = _SPIN_CONFIG.get(feature, (0.0, 9999.0, 1.0, 2))
    sentinel = lo - step

    spin = QDoubleSpinBox()
    spin.setRange(sentinel, hi)
    spin.setSingleStep(step)
    spin.setDecimals(dec)
    spin.setSpecialValueText("—")   # shown when value == minimum (sentinel)
    spin.setValue(sentinel)         # starts blank
    spin.setMinimumWidth(118)
    spin.setMaximumWidth(150)
    return spin


def _make_combo(items: list[tuple[str, float]], default: float | None) -> QComboBox:
    combo = QComboBox()
    combo.setMinimumWidth(210)
    for text, value in items:
        combo.addItem(text, userData=value)
    if default is not None:
        _combo_set_value(combo, default)
    return combo


def _spinner_value(spin: QDoubleSpinBox) -> float | None:
    """Return None if the spinner shows "—" (sentinel), else the float value."""
    if spin.value() <= spin.minimum():
        return None
    return spin.value()


def _combo_set_value(combo: QComboBox, value: float) -> None:
    """Select the combo item whose userData equals *value* (float-safe)."""
    for i in range(combo.count()):
        if combo.itemData(i) == value:
            combo.setCurrentIndex(i)
            return


# ══════════════════════════════════════════════════════════════════════════════
# InputPanel
# ══════════════════════════════════════════════════════════════════════════════

class InputPanel(QWidget):
    """Scrollable form with all PULSAR model inputs grouped in clinical sections.

    Dynamically reads the preprocessing spec to determine field types and
    imputation defaults.  Unknown features present in the spec but not in any
    hard-coded section are collected in a final "Additional Variables" card.

    Signals
    -------
    inputs_changed  – Emitted whenever any field value is modified.

    Public methods
    --------------
    get_current_inputs() -> dict[str, float | None]
        Return a mapping of feature → current value (None = blank / to impute).

    load_inputs(data: dict)
        Populate fields from the supplied dict; unknown keys are silently ignored.

    reset_inputs()
        Reset all fields to "—" (blank); combo boxes reset to their first item.

    highlight_imputed_fields(field_names: list[str])
        Mark the given fields with a warning style to show they were imputed.

    clear_imputed_highlights()
        Remove all imputation highlights.
    """

    inputs_changed = Signal()

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._widgets: dict[str, QWidget]         = {}   # feature → input widget
        self._rows:    dict[str, LabeledFieldRow]  = {}   # feature → row wrapper
        self._spec     = self._load_spec()
        self._build_ui()

    # ── Spec I/O ──────────────────────────────────────────────────────────────

    @staticmethod
    def _load_spec() -> dict[str, Any]:
        try:
            with open(config.PREPROCESSING_SPEC, encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:
            return {}

    def _field_type(self, feature: str) -> str:
        """Return ``"ordinal"``, ``"binary"``, or ``"continuous"``."""
        if feature in self._spec.get("ordinal_vars", []) or feature in _ORDINAL_OPTIONS:
            return "ordinal"
        if feature in self._spec.get("binary_vars", []):
            return "binary"
        return "continuous"

    def _default_for(self, feature: str) -> float | None:
        """Return the imputation default from the spec, or None."""
        return self._spec.get("imputation", {}).get(feature)

    # ── UI construction ───────────────────────────────────────────────────────

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
        layout.setContentsMargins(16, 16, 16, 24)
        layout.setSpacing(12)

        # Track placed features to detect overflow from spec
        placed: set[str] = set()
        for title, subtitle, features, n_cols in _SECTIONS:
            self._build_section(layout, title, subtitle, features, n_cols)
            placed.update(features)

        # Overflow: spec features not assigned to any section
        extra = [f for f in self._spec.get("features", []) if f not in placed]
        if extra:
            self._build_section(
                layout,
                "G  ·  Additional Variables",
                "Model features present in the spec file not listed above",
                extra,
                2,
            )

        layout.addStretch()
        outer.addWidget(scroll)

    def _build_section(
        self,
        parent_layout: QVBoxLayout,
        title: str,
        subtitle: str,
        features: list[str],
        n_cols: int,
    ) -> None:
        card = CardFrame()
        vbox = card.inner_layout

        # Section heading
        vbox.addWidget(SectionTitle(title, subtitle))

        # Thin divider
        divider = QWidget()
        divider.setFixedHeight(1)
        divider.setStyleSheet(f"background: {Color.BORDER_SUBTLE}; border: none;")
        vbox.addWidget(divider)

        # Grid of LabeledFieldRow items
        grid_host = QWidget()
        grid_host.setStyleSheet("background: transparent;")
        grid = QGridLayout(grid_host)
        grid.setContentsMargins(4, 8, 4, 4)
        grid.setHorizontalSpacing(24)
        grid.setVerticalSpacing(2)
        for col in range(n_cols):
            grid.setColumnStretch(col, 1)

        for idx, feature in enumerate(features):
            row_widget = self._build_field_row(feature)
            grid.addWidget(row_widget, idx // n_cols, idx % n_cols)

        vbox.addWidget(grid_host)
        parent_layout.addWidget(card)

    def _build_field_row(self, feature: str) -> LabeledFieldRow:
        ftype   = self._field_type(feature)
        default = self._default_for(feature)
        label   = get_label(feature)
        unit    = get_unit(feature)
        tip     = get_tooltip(feature)

        # ── Build the input widget ────────────────────────────────────────────
        if ftype == "ordinal":
            options = _ORDINAL_OPTIONS.get(feature)
            if options:
                widget: QWidget = _make_combo(options, default)
            else:
                widget = _make_spinner(feature)  # unknown ordinal → spinbox
        elif ftype == "binary":
            opts = _SEX_OPTIONS if feature == "base_sex_female" else _BINARY_OPTIONS
            widget = _make_combo(opts, default)
        else:
            widget = _make_spinner(feature)

        # ── Connect change signals ────────────────────────────────────────────
        if isinstance(widget, QDoubleSpinBox):
            widget.valueChanged.connect(self.inputs_changed)
        elif isinstance(widget, QComboBox):
            widget.currentIndexChanged.connect(self.inputs_changed)

        row = LabeledFieldRow(label, widget, unit=unit, tooltip=tip)
        self._widgets[feature] = widget
        self._rows[feature]    = row
        return row

    # ══════════════════════════════════════════════════════════════════════════
    # Public API
    # ══════════════════════════════════════════════════════════════════════════

    def get_current_inputs(self) -> dict[str, float | None]:
        """Return {feature: value_or_None} for every visible field.

        A value of ``None`` means the field was left blank and the model should
        apply its built-in imputation for that feature.
        """
        result: dict[str, float | None] = {}
        for feature, widget in self._widgets.items():
            if isinstance(widget, QDoubleSpinBox):
                result[feature] = _spinner_value(widget)
            elif isinstance(widget, QComboBox):
                data = widget.currentData()
                result[feature] = float(data) if data is not None else None
            else:
                result[feature] = None
        return result

    def load_inputs(self, data: dict[str, Any]) -> None:
        """Populate fields from *data*; unknown keys are silently ignored."""
        for feature, raw_value in data.items():
            widget = self._widgets.get(feature)
            if widget is None:
                continue
            try:
                fval = float(raw_value)
            except (TypeError, ValueError):
                continue

            if isinstance(widget, QDoubleSpinBox):
                widget.blockSignals(True)
                widget.setValue(fval)
                widget.blockSignals(False)
            elif isinstance(widget, QComboBox):
                widget.blockSignals(True)
                _combo_set_value(widget, fval)
                widget.blockSignals(False)

        self.inputs_changed.emit()

    def reset_inputs(self) -> None:
        """Reset every field: spinboxes → "—" blank, combos → index 0."""
        for feature, widget in self._widgets.items():
            if isinstance(widget, QDoubleSpinBox):
                widget.blockSignals(True)
                widget.setValue(widget.minimum())   # sentinel → shows "—"
                widget.blockSignals(False)
            elif isinstance(widget, QComboBox):
                widget.blockSignals(True)
                widget.setCurrentIndex(0)
                widget.blockSignals(False)

        self.clear_imputed_highlights()
        self.inputs_changed.emit()

    def highlight_imputed_fields(self, field_names: list[str]) -> None:
        """Visually mark fields that were imputed by the inference service.

        Applies a warning-amber highlight to each named field row so the
        clinician can see which values were substituted.
        """
        self.clear_imputed_highlights()
        for name in field_names:
            row = self._rows.get(name)
            if row is not None:
                row.set_imputed_style(True)

    def clear_imputed_highlights(self) -> None:
        """Remove all imputation highlights from every row."""
        for row in self._rows.values():
            row.set_imputed_style(False)
