"""
app/styles.py
Dark premium clinical theme for HEMOSCOREAPP.

Exports:
    Color        – Palette of hex color tokens.
    get_stylesheet()           – Returns the full Qt stylesheet string.
    apply_global_stylesheet()  – Applies it to a QApplication instance.
"""

from __future__ import annotations

from PySide6.QtWidgets import QApplication


# ══════════════════════════════════════════════════════════════════════════════
# COLOR PALETTE
# ══════════════════════════════════════════════════════════════════════════════

class Color:
    """Clinical dark-mode color tokens.

    All values are CSS hex strings suitable for Qt stylesheets
    and QPalette / QColor constructors.
    """

    # Backgrounds ──────────────────────────────────────────────────────────────
    BG_APP          = "#0E1218"   # Application-level background
    BG_SURFACE      = "#161C26"   # Card / panel surface
    BG_ELEVATED     = "#1D2535"   # Dialogs, headers, raised surfaces
    BG_INPUT        = "#111722"   # Text inputs, spinboxes
    BG_HOVER        = "#243044"   # General hover state

    # Borders ──────────────────────────────────────────────────────────────────
    BORDER          = "#2A3547"
    BORDER_FOCUS    = "#3B7DD8"   # Keyboard-focus ring
    BORDER_SUBTLE   = "#1E2A3A"

    # Accent – primary blue ────────────────────────────────────────────────────
    ACCENT          = "#3B7DD8"
    ACCENT_HOVER    = "#4A90E8"
    ACCENT_PRESSED  = "#2A6BBF"
    ACCENT_MUTED    = "#1C3A5E"   # Translucent selection fill

    # Typography ───────────────────────────────────────────────────────────────
    TEXT_PRIMARY    = "#E8EDF5"
    TEXT_SECONDARY  = "#8A9AB5"
    TEXT_DISABLED   = "#4A5568"
    TEXT_INVERSE    = "#0E1218"   # Text on bright accent backgrounds

    # Risk tier – foreground ───────────────────────────────────────────────────
    RISK_LOW        = "#00C896"   # < 10 %
    RISK_MEDIUM     = "#F5A623"   # 10 – < 25 %
    RISK_HIGH       = "#E07B39"   # 25 – < 50 %
    RISK_VERY_HIGH  = "#E55353"   # ≥ 50 %

    # Risk tier – badge backgrounds ────────────────────────────────────────────
    RISK_LOW_BG       = "#003D2B"
    RISK_MEDIUM_BG    = "#3D2900"
    RISK_HIGH_BG      = "#3D1F00"
    RISK_VERY_HIGH_BG = "#3D0F0F"

    # Semantic states ──────────────────────────────────────────────────────────
    SUCCESS = "#2ECC71"
    WARNING = "#F39C12"
    ERROR   = "#E74C3C"
    INFO    = "#3498DB"


# ══════════════════════════════════════════════════════════════════════════════
# GLOBAL QT STYLESHEET
# ══════════════════════════════════════════════════════════════════════════════

_STYLESHEET = f"""

/* ── Base widget ────────────────────────────────────────────────────────── */
QWidget {{
    background-color: {Color.BG_APP};
    color: {Color.TEXT_PRIMARY};
    font-family: "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
    selection-background-color: {Color.ACCENT};
    selection-color: {Color.TEXT_INVERSE};
}}

/* ── Main window / top-level ─────────────────────────────────────────────── */
QMainWindow, QDialog {{
    background-color: {Color.BG_APP};
}}

/* ── Labels ─────────────────────────────────────────────────────────────── */
QLabel {{
    background-color: transparent;
    color: {Color.TEXT_PRIMARY};
}}

QLabel[secondary="true"] {{
    color: {Color.TEXT_SECONDARY};
    font-size: 12px;
}}

QLabel[heading="true"] {{
    font-size: 20px;
    font-weight: 700;
    color: {Color.TEXT_PRIMARY};
    letter-spacing: 0.5px;
}}

QLabel[subheading="true"] {{
    font-size: 14px;
    font-weight: 600;
    color: {Color.TEXT_SECONDARY};
}}

QLabel[risk_badge="low"] {{
    background-color: {Color.RISK_LOW_BG};
    color: {Color.RISK_LOW};
    border: 1px solid {Color.RISK_LOW};
    border-radius: 4px;
    padding: 2px 8px;
    font-weight: 700;
    font-size: 13px;
}}

QLabel[risk_badge="medium"] {{
    background-color: {Color.RISK_MEDIUM_BG};
    color: {Color.RISK_MEDIUM};
    border: 1px solid {Color.RISK_MEDIUM};
    border-radius: 4px;
    padding: 2px 8px;
    font-weight: 700;
    font-size: 13px;
}}

QLabel[risk_badge="high"] {{
    background-color: {Color.RISK_HIGH_BG};
    color: {Color.RISK_HIGH};
    border: 1px solid {Color.RISK_HIGH};
    border-radius: 4px;
    padding: 2px 8px;
    font-weight: 700;
    font-size: 13px;
}}

QLabel[risk_badge="very_high"] {{
    background-color: {Color.RISK_VERY_HIGH_BG};
    color: {Color.RISK_VERY_HIGH};
    border: 1px solid {Color.RISK_VERY_HIGH};
    border-radius: 4px;
    padding: 2px 8px;
    font-weight: 700;
    font-size: 13px;
}}

/* ── Push buttons ───────────────────────────────────────────────────────── */
QPushButton {{
    background-color: {Color.ACCENT};
    color: {Color.TEXT_PRIMARY};
    border: none;
    border-radius: 6px;
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 600;
    min-height: 34px;
}}

QPushButton:hover {{
    background-color: {Color.ACCENT_HOVER};
}}

QPushButton:pressed {{
    background-color: {Color.ACCENT_PRESSED};
}}

QPushButton:disabled {{
    background-color: {Color.BG_ELEVATED};
    color: {Color.TEXT_DISABLED};
}}

QPushButton[secondary="true"] {{
    background-color: {Color.BG_ELEVATED};
    color: {Color.TEXT_PRIMARY};
    border: 1px solid {Color.BORDER};
}}

QPushButton[secondary="true"]:hover {{
    background-color: {Color.BG_HOVER};
    border-color: {Color.BORDER_FOCUS};
}}

QPushButton[danger="true"] {{
    background-color: {Color.ERROR};
    color: #FFFFFF;
    border: none;
}}

QPushButton[danger="true"]:hover {{
    background-color: #F05A4A;
}}

/* ── Line edits ─────────────────────────────────────────────────────────── */
QLineEdit {{
    background-color: {Color.BG_INPUT};
    color: {Color.TEXT_PRIMARY};
    border: 1px solid {Color.BORDER};
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
    min-height: 30px;
    selection-background-color: {Color.ACCENT};
}}

QLineEdit:focus {{
    border: 1px solid {Color.BORDER_FOCUS};
    background-color: {Color.BG_SURFACE};
}}

QLineEdit:disabled {{
    color: {Color.TEXT_DISABLED};
    background-color: {Color.BG_SURFACE};
    border-color: {Color.BORDER_SUBTLE};
}}

/* ── SpinBoxes ──────────────────────────────────────────────────────────── */
QSpinBox,
QDoubleSpinBox {{
    background-color: {Color.BG_INPUT};
    color: {Color.TEXT_PRIMARY};
    border: 1px solid {Color.BORDER};
    border-radius: 6px;
    padding: 5px 8px;
    min-height: 30px;
    font-size: 13px;
}}

QSpinBox:focus,
QDoubleSpinBox:focus {{
    border: 1px solid {Color.BORDER_FOCUS};
}}

QSpinBox::up-button,   QDoubleSpinBox::up-button,
QSpinBox::down-button, QDoubleSpinBox::down-button {{
    background-color: {Color.BG_ELEVATED};
    border: none;
    width: 18px;
}}

QSpinBox::up-button:hover,   QDoubleSpinBox::up-button:hover,
QSpinBox::down-button:hover, QDoubleSpinBox::down-button:hover {{
    background-color: {Color.BG_HOVER};
}}

/* ── ComboBox ───────────────────────────────────────────────────────────── */
QComboBox {{
    background-color: {Color.BG_INPUT};
    color: {Color.TEXT_PRIMARY};
    border: 1px solid {Color.BORDER};
    border-radius: 6px;
    padding: 5px 10px;
    min-height: 30px;
    font-size: 13px;
}}

QComboBox:focus {{
    border: 1px solid {Color.BORDER_FOCUS};
}}

QComboBox::drop-down {{
    border: none;
    width: 26px;
    background-color: {Color.BG_ELEVATED};
    border-left: 1px solid {Color.BORDER};
    border-radius: 0 6px 6px 0;
}}

QComboBox QAbstractItemView {{
    background-color: {Color.BG_ELEVATED};
    color: {Color.TEXT_PRIMARY};
    border: 1px solid {Color.BORDER};
    selection-background-color: {Color.ACCENT};
    selection-color: {Color.TEXT_INVERSE};
    outline: none;
    padding: 4px;
}}

/* ── Group box ──────────────────────────────────────────────────────────── */
QGroupBox {{
    background-color: {Color.BG_SURFACE};
    border: 1px solid {Color.BORDER};
    border-radius: 8px;
    margin-top: 20px;
    padding: 14px 12px 12px 12px;
    font-size: 11px;
    font-weight: 600;
    color: {Color.TEXT_SECONDARY};
    letter-spacing: 0.8px;
    text-transform: uppercase;
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 8px;
    left: 14px;
    top: 0px;
    color: {Color.TEXT_SECONDARY};
}}

/* ── Tab widget ─────────────────────────────────────────────────────────── */
QTabWidget::pane {{
    background-color: {Color.BG_SURFACE};
    border: 1px solid {Color.BORDER};
    border-radius: 8px;
    top: -1px;
}}

QTabBar {{
    background-color: transparent;
}}

QTabBar::tab {{
    background-color: {Color.BG_ELEVATED};
    color: {Color.TEXT_SECONDARY};
    border: 1px solid {Color.BORDER};
    border-bottom: none;
    padding: 8px 20px;
    margin-right: 2px;
    border-radius: 6px 6px 0 0;
    font-size: 12px;
    font-weight: 500;
}}

QTabBar::tab:selected {{
    background-color: {Color.BG_SURFACE};
    color: {Color.TEXT_PRIMARY};
    border-bottom: 2px solid {Color.ACCENT};
}}

QTabBar::tab:hover:!selected {{
    background-color: {Color.BG_HOVER};
    color: {Color.TEXT_PRIMARY};
}}

/* ── Scroll bars ───────────────────────────────────────────────────────── */
QScrollBar:vertical {{
    background-color: {Color.BG_APP};
    width: 8px;
    border-radius: 4px;
    margin: 0;
}}

QScrollBar::handle:vertical {{
    background-color: {Color.BORDER};
    border-radius: 4px;
    min-height: 30px;
}}

QScrollBar::handle:vertical:hover {{
    background-color: {Color.TEXT_SECONDARY};
}}

QScrollBar::add-line:vertical,
QScrollBar::sub-line:vertical {{
    height: 0px;
}}

QScrollBar:horizontal {{
    background-color: {Color.BG_APP};
    height: 8px;
    border-radius: 4px;
    margin: 0;
}}

QScrollBar::handle:horizontal {{
    background-color: {Color.BORDER};
    border-radius: 4px;
    min-width: 30px;
}}

QScrollBar::handle:horizontal:hover {{
    background-color: {Color.TEXT_SECONDARY};
}}

QScrollBar::add-line:horizontal,
QScrollBar::sub-line:horizontal {{
    width: 0px;
}}

/* ── Table widget ───────────────────────────────────────────────────────── */
QTableWidget {{
    background-color: {Color.BG_SURFACE};
    gridline-color: {Color.BORDER_SUBTLE};
    border: 1px solid {Color.BORDER};
    border-radius: 6px;
    color: {Color.TEXT_PRIMARY};
    font-size: 12px;
    alternate-background-color: {Color.BG_ELEVATED};
}}

QTableWidget::item:selected {{
    background-color: {Color.ACCENT_MUTED};
    color: {Color.TEXT_PRIMARY};
}}

QTableWidget::item:hover {{
    background-color: {Color.BG_HOVER};
}}

QHeaderView::section {{
    background-color: {Color.BG_ELEVATED};
    color: {Color.TEXT_SECONDARY};
    border: none;
    border-bottom: 1px solid {Color.BORDER};
    border-right: 1px solid {Color.BORDER_SUBTLE};
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}}

QTableWidget QTableCornerButton::section {{
    background-color: {Color.BG_ELEVATED};
    border: none;
}}

/* ── Progress bar ───────────────────────────────────────────────────────── */
QProgressBar {{
    background-color: {Color.BG_ELEVATED};
    border: 1px solid {Color.BORDER};
    border-radius: 6px;
    text-align: center;
    color: {Color.TEXT_PRIMARY};
    font-size: 11px;
    font-weight: 600;
    min-height: 16px;
}}

QProgressBar::chunk {{
    background-color: {Color.ACCENT};
    border-radius: 5px;
}}

/* ── Tool tip ───────────────────────────────────────────────────────────── */
QToolTip {{
    background-color: {Color.BG_ELEVATED};
    color: {Color.TEXT_PRIMARY};
    border: 1px solid {Color.BORDER};
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 12px;
}}

/* ── Status bar ─────────────────────────────────────────────────────────── */
QStatusBar {{
    background-color: {Color.BG_ELEVATED};
    color: {Color.TEXT_SECONDARY};
    font-size: 11px;
    border-top: 1px solid {Color.BORDER};
}}

QStatusBar::item {{
    border: none;
}}

/* ── Menu bar ───────────────────────────────────────────────────────────── */
QMenuBar {{
    background-color: {Color.BG_ELEVATED};
    color: {Color.TEXT_PRIMARY};
    border-bottom: 1px solid {Color.BORDER};
    padding: 2px 6px;
    font-size: 13px;
}}

QMenuBar::item {{
    padding: 4px 10px;
    border-radius: 4px;
}}

QMenuBar::item:selected {{
    background-color: {Color.BG_HOVER};
}}

QMenu {{
    background-color: {Color.BG_ELEVATED};
    color: {Color.TEXT_PRIMARY};
    border: 1px solid {Color.BORDER};
    border-radius: 6px;
    padding: 4px;
}}

QMenu::item {{
    padding: 7px 28px 7px 14px;
    border-radius: 4px;
}}

QMenu::item:selected {{
    background-color: {Color.ACCENT_MUTED};
    color: {Color.TEXT_PRIMARY};
}}

QMenu::separator {{
    height: 1px;
    background-color: {Color.BORDER};
    margin: 4px 0;
}}

/* ── Splitter ───────────────────────────────────────────────────────────── */
QSplitter::handle {{
    background-color: {Color.BORDER};
}}

QSplitter::handle:horizontal {{
    width: 2px;
}}

QSplitter::handle:vertical {{
    height: 2px;
}}

/* ── Check box ──────────────────────────────────────────────────────────── */
QCheckBox {{
    color: {Color.TEXT_PRIMARY};
    spacing: 8px;
    font-size: 13px;
}}

QCheckBox::indicator {{
    width: 16px;
    height: 16px;
    border: 1px solid {Color.BORDER};
    border-radius: 4px;
    background-color: {Color.BG_INPUT};
}}

QCheckBox::indicator:checked {{
    background-color: {Color.ACCENT};
    border-color: {Color.ACCENT};
}}

QCheckBox::indicator:hover {{
    border-color: {Color.BORDER_FOCUS};
}}

QCheckBox::indicator:disabled {{
    background-color: {Color.BG_SURFACE};
    border-color: {Color.BORDER_SUBTLE};
}}

/* ── Radio button ───────────────────────────────────────────────────────── */
QRadioButton {{
    color: {Color.TEXT_PRIMARY};
    spacing: 8px;
    font-size: 13px;
}}

QRadioButton::indicator {{
    width: 16px;
    height: 16px;
    border: 1px solid {Color.BORDER};
    border-radius: 8px;
    background-color: {Color.BG_INPUT};
}}

QRadioButton::indicator:checked {{
    background-color: {Color.ACCENT};
    border-color: {Color.ACCENT};
}}

QRadioButton::indicator:hover {{
    border-color: {Color.BORDER_FOCUS};
}}

/* ── Frames (horizontal / vertical lines) ──────────────────────────────── */
QFrame[frameShape="4"],
QFrame[frameShape="5"] {{
    color: {Color.BORDER};
}}

/* ── Scroll area ────────────────────────────────────────────────────────── */
QScrollArea {{
    border: none;
    background-color: transparent;
}}

QScrollArea > QWidget > QWidget {{
    background-color: transparent;
}}

"""


def get_stylesheet() -> str:
    """Return the full global Qt stylesheet string."""
    return _STYLESHEET


def apply_global_stylesheet(app: QApplication) -> None:
    """Apply the dark clinical stylesheet to the running QApplication."""
    app.setStyleSheet(_STYLESHEET)
