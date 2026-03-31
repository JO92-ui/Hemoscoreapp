"""
app/ui/widgets.py
Reusable premium PySide6 components for HEMOSCOREAPP.

Components
----------
CardFrame           – Rounded dark card with inner VBox layout and drop shadow.
SectionTitle        – Accent left-bar + bold title + optional subtitle.
HelperLabel         – Secondary muted label for hints or unit notes.
RiskBadge           – Color-coded risk tier badge (low / medium / high / very_high).
StatusChip          – Compact inline status indicator (info / warning / success / error).
LabeledFieldRow     – Horizontal label + input widget pair with imputation highlight.
RiskGaugePlaceholder– Anti-aliased circular arc progress ring (not yet wired to live data).
"""

from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QBrush, QColor, QPainter, QPen
from PySide6.QtWidgets import (
    QFrame,
    QGraphicsDropShadowEffect,
    QHBoxLayout,
    QLabel,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from app.styles import Color


# ══════════════════════════════════════════════════════════════════════════════
# CardFrame
# ══════════════════════════════════════════════════════════════════════════════

class CardFrame(QFrame):
    """Rounded dark card container with a soft drop shadow.

    Parameters
    ----------
    elevated   – Use BG_ELEVATED background instead of BG_SURFACE.
    accent_top – Draw a 2-px accent-colored top border.
    shadow     – Attach a QGraphicsDropShadowEffect (default True).
    """

    def __init__(
        self,
        parent: QWidget | None = None,
        *,
        elevated: bool = False,
        accent_top: bool = False,
        shadow: bool = True,
    ) -> None:
        super().__init__(parent)

        bg     = Color.BG_ELEVATED if elevated else Color.BG_SURFACE
        radius = 10
        top    = f"border-top: 2px solid {Color.ACCENT};" if accent_top else ""

        self.setStyleSheet(
            f"CardFrame {{"
            f"  background-color: {bg};"
            f"  border: 1px solid {Color.BORDER};"
            f"  border-radius: {radius}px;"
            f"  {top}"
            f"}}"
        )
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)

        if shadow:
            fx = QGraphicsDropShadowEffect(self)
            fx.setBlurRadius(18)
            fx.setOffset(0.0, 3.0)
            fx.setColor(QColor(0, 0, 0, 70))
            self.setGraphicsEffect(fx)

        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(16, 14, 16, 14)
        self._layout.setSpacing(8)

    @property
    def inner_layout(self) -> QVBoxLayout:
        """The card's inner QVBoxLayout – add child widgets here."""
        return self._layout


# ══════════════════════════════════════════════════════════════════════════════
# SectionTitle
# ══════════════════════════════════════════════════════════════════════════════

class SectionTitle(QWidget):
    """Accent left-bar + bold title text, with an optional subtitle line."""

    def __init__(
        self,
        title: str,
        subtitle: str = "",
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setStyleSheet("background: transparent;")

        hbox = QHBoxLayout(self)
        hbox.setContentsMargins(0, 0, 0, 0)
        hbox.setSpacing(10)

        # Accent left bar
        bar = QFrame()
        bar.setFixedSize(3, 40 if subtitle else 26)
        bar.setStyleSheet(
            f"background-color: {Color.ACCENT}; border-radius: 2px; border: none;"
        )
        hbox.addWidget(bar, 0, Qt.AlignmentFlag.AlignVCenter)

        # Text block
        vbox = QVBoxLayout()
        vbox.setContentsMargins(0, 0, 0, 0)
        vbox.setSpacing(2)

        title_lbl = QLabel(title)
        title_lbl.setStyleSheet(
            f"font-size: 13px; font-weight: 700; color: {Color.TEXT_PRIMARY}; "
            f"letter-spacing: 0.3px; background: transparent;"
        )
        vbox.addWidget(title_lbl)

        if subtitle:
            sub_lbl = QLabel(subtitle)
            sub_lbl.setStyleSheet(
                f"font-size: 11px; color: {Color.TEXT_SECONDARY}; background: transparent;"
            )
            vbox.addWidget(sub_lbl)

        hbox.addLayout(vbox)
        hbox.addStretch()


# ══════════════════════════════════════════════════════════════════════════════
# HelperLabel
# ══════════════════════════════════════════════════════════════════════════════

class HelperLabel(QLabel):
    """Small secondary label for field hints, unit suffixes, or notes."""

    def __init__(self, text: str, parent: QWidget | None = None) -> None:
        super().__init__(text, parent)
        self.setStyleSheet(
            f"color: {Color.TEXT_SECONDARY}; font-size: 11px; background: transparent;"
        )
        self.setWordWrap(True)


# ══════════════════════════════════════════════════════════════════════════════
# RiskBadge
# ══════════════════════════════════════════════════════════════════════════════

class RiskBadge(QLabel):
    """Color-coded badge that displays the current risk tier.

    Tier strings must match the Qt dynamic-property values defined in
    styles.py:  ``"low"`` · ``"medium"`` · ``"high"`` · ``"very_high"``.
    """

    _TIERS: dict[str, tuple[str, str, str]] = {
        #  tier        fg                    bg                   display text
        "low":       (Color.RISK_LOW,       Color.RISK_LOW_BG,       "LOW"),
        "medium":    (Color.RISK_MEDIUM,    Color.RISK_MEDIUM_BG,    "INTERMEDIATE"),
        "high":      (Color.RISK_HIGH,      Color.RISK_HIGH_BG,      "HIGH"),
        "very_high": (Color.RISK_VERY_HIGH, Color.RISK_VERY_HIGH_BG, "VERY HIGH"),
    }

    def __init__(self, tier: str = "low", parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setMinimumWidth(110)
        self.set_tier(tier)

    def set_tier(self, tier: str) -> None:
        """Update badge color and text to *tier*."""
        fg, bg, text = self._TIERS.get(
            tier, (Color.TEXT_SECONDARY, Color.BG_ELEVATED, tier.upper())
        )
        self.setText(text)
        self.setProperty("risk_badge", tier)
        self.setStyleSheet(
            f"QLabel {{"
            f"  background-color: {bg};"
            f"  color: {fg};"
            f"  border: 1px solid {fg};"
            f"  border-radius: 5px;"
            f"  padding: 4px 14px;"
            f"  font-size: 12px;"
            f"  font-weight: 700;"
            f"  letter-spacing: 0.6px;"
            f"}}"
        )
        self.style().unpolish(self)
        self.style().polish(self)


# ══════════════════════════════════════════════════════════════════════════════
# StatusChip
# ══════════════════════════════════════════════════════════════════════════════

class StatusChip(QLabel):
    """Compact inline status indicator.

    Variants: ``"info"`` · ``"warning"`` · ``"success"`` · ``"error"``
    """

    _VARIANTS: dict[str, tuple[str, str]] = {
        "info":    (Color.INFO,    "#0D2E45"),
        "warning": (Color.WARNING, "#3D2900"),
        "success": (Color.SUCCESS, "#0A2E1E"),
        "error":   (Color.ERROR,   "#3D0F0F"),
    }

    def __init__(
        self,
        text: str,
        variant: str = "info",
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(text, parent)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.set_variant(variant)

    def set_variant(self, variant: str) -> None:
        fg, bg = self._VARIANTS.get(variant, (Color.TEXT_SECONDARY, Color.BG_ELEVATED))
        self.setStyleSheet(
            f"QLabel {{"
            f"  background-color: {bg};"
            f"  color: {fg};"
            f"  border: 1px solid {fg};"
            f"  border-radius: 4px;"
            f"  padding: 2px 8px;"
            f"  font-size: 11px;"
            f"  font-weight: 600;"
            f"}}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# LabeledFieldRow
# ══════════════════════════════════════════════════════════════════════════════

class LabeledFieldRow(QWidget):
    """Horizontal pair of a field label and its input widget.

    Parameters
    ----------
    label_text    – Clinical name shown to the left.
    input_widget  – Any QWidget that accepts input (spinbox, combobox …).
    unit          – Optional unit suffix shown to the right of the input.
    tooltip       – Tooltip applied to both label and input.
    label_width   – Fixed pixel width for the label column (default 196).
    """

    def __init__(
        self,
        label_text: str,
        input_widget: QWidget,
        unit: str = "",
        tooltip: str = "",
        label_width: int = 196,
        parent: QWidget | None = None,
    ) -> None:
        super().__init__(parent)
        self.setStyleSheet("background: transparent;")

        hbox = QHBoxLayout(self)
        hbox.setContentsMargins(0, 2, 0, 2)
        hbox.setSpacing(8)

        # Label
        self._lbl = QLabel(label_text)
        self._lbl.setFixedWidth(label_width)
        self._lbl.setWordWrap(True)
        self._lbl.setStyleSheet(
            f"color: {Color.TEXT_PRIMARY}; font-size: 12px; background: transparent;"
        )
        if tooltip:
            self._lbl.setToolTip(tooltip)
            self._lbl.setCursor(Qt.CursorShape.WhatsThisCursor)
        hbox.addWidget(self._lbl, 0, Qt.AlignmentFlag.AlignVCenter)

        # Input
        self._input = input_widget
        if tooltip:
            self._input.setToolTip(tooltip)
        hbox.addWidget(self._input, 0, Qt.AlignmentFlag.AlignVCenter)

        # Unit suffix
        if unit:
            unit_lbl = HelperLabel(unit)
            unit_lbl.setFixedWidth(48)
            hbox.addWidget(unit_lbl, 0, Qt.AlignmentFlag.AlignVCenter)

        hbox.addStretch()

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def label_widget(self) -> QLabel:
        return self._lbl

    @property
    def input_widget(self) -> QWidget:
        return self._input

    # ── Imputation highlight ──────────────────────────────────────────────────

    def set_imputed_style(self, active: bool) -> None:
        """Highlight this row to signal that the model imputed the value."""
        if active:
            self._lbl.setStyleSheet(
                f"color: {Color.WARNING}; font-size: 12px; "
                f"background: #221C08; border-radius: 3px; padding: 0 2px;"
            )
        else:
            self._lbl.setStyleSheet(
                f"color: {Color.TEXT_PRIMARY}; font-size: 12px; background: transparent;"
            )


# ══════════════════════════════════════════════════════════════════════════════
# RiskGaugePlaceholder
# ══════════════════════════════════════════════════════════════════════════════

class RiskGaugePlaceholder(QWidget):
    """Circular arc progress ring displaying a risk percentage.

    Not yet wired to live model output – call ``set_value(percent, tier)``
    to update it programmatically.

    Renders entirely via ``paintEvent``; no SVG or image dependency.
    """

    _TIER_FG: dict[str, str] = {
        "low":       Color.RISK_LOW,
        "medium":    Color.RISK_MEDIUM,
        "high":      Color.RISK_HIGH,
        "very_high": Color.RISK_VERY_HIGH,
    }

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self._percent: float = 0.0
        self._tier: str = "low"
        self.setFixedSize(160, 160)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, False)
        self.setStyleSheet(f"background: transparent;")

        # Overlay labels (pure geometry positioning inside the fixed 160×160 box)
        self._value_lbl = QLabel("—", self)
        self._value_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._value_lbl.setGeometry(20, 52, 120, 32)
        self._value_lbl.setStyleSheet(
            f"font-size: 22px; font-weight: 700; color: {Color.TEXT_PRIMARY}; "
            f"background: transparent;"
        )

        self._tier_lbl = QLabel("", self)
        self._tier_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._tier_lbl.setGeometry(10, 87, 140, 16)
        self._tier_lbl.setStyleSheet(
            f"font-size: 9px; font-weight: 600; color: {Color.TEXT_SECONDARY}; "
            f"letter-spacing: 0.6px; background: transparent;"
        )

    # ── Public interface ──────────────────────────────────────────────────────

    def set_value(self, percent: float, tier: str = "low") -> None:
        """Update the gauge.  *percent* is in the range 0–100."""
        self._percent = max(0.0, min(100.0, percent))
        self._tier = tier
        self._value_lbl.setText(f"{self._percent:.1f}%")
        self._tier_lbl.setText(tier.replace("_", " ").upper())
        self.update()

    def reset(self) -> None:
        """Clear the gauge back to its initial empty state."""
        self._percent = 0.0
        self._tier = "low"
        self._value_lbl.setText("—")
        self._tier_lbl.setText("")
        self.update()

    # ── Paint ─────────────────────────────────────────────────────────────────

    def paintEvent(self, event) -> None:  # noqa: N802
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        cx, cy, r = 80, 80, 58        # centre and arc radius
        arc_w = 12                     # line width
        margin = arc_w // 2 + 1        # keep arcs inside widget bounds

        # Background fill (circle only)
        painter.setBrush(QBrush(QColor(Color.BG_ELEVATED)))
        painter.setPen(Qt.PenStyle.NoPen)
        painter.drawEllipse(cx - r - margin, cy - r - margin,
                             (r + margin) * 2, (r + margin) * 2)

        # Track arc  (270° from 7 o'clock CW to 5 o'clock)
        #  Qt angles: 0° = 3 o'clock, positive = counter-clockwise, unit = 1/16°
        start_angle = (180 + 45) * 16   # 225° → 7 o'clock position
        full_span   = -(270 * 16)       # 270° clockwise

        pen_track = QPen(QColor(Color.BORDER))
        pen_track.setWidth(arc_w)
        pen_track.setCapStyle(Qt.PenCapStyle.RoundCap)
        painter.setPen(pen_track)
        painter.drawArc(cx - r, cy - r, r * 2, r * 2, start_angle, full_span)

        # Value arc
        if self._percent > 0:
            filled_span = int(full_span * self._percent / 100.0)
            arc_color   = self._TIER_FG.get(self._tier, Color.ACCENT)
            pen_value   = QPen(QColor(arc_color))
            pen_value.setWidth(arc_w)
            pen_value.setCapStyle(Qt.PenCapStyle.RoundCap)
            painter.setPen(pen_value)
            painter.drawArc(cx - r, cy - r, r * 2, r * 2, start_angle, filled_span)

        painter.end()
