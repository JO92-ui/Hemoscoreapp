"""
HEMOSCOREAPP – Application entry point
Cardiogenic Shock In-Hospital Mortality Risk Prediction (PULSAR XGBoost)

Usage:
    python run_app.py
"""

import sys
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication

import app as _app_pkg
from app.styles import apply_global_stylesheet
from app.ui.main_window import MainWindow


def main() -> None:
    # Must be set before QApplication is constructed
    QApplication.setHighDpiScaleFactorRoundingPolicy(
        Qt.HighDpiScaleFactorRoundingPolicy.PassThrough
    )

    application = QApplication(sys.argv)
    application.setApplicationName(_app_pkg.APP_NAME)
    application.setApplicationVersion(_app_pkg.APP_VERSION)
    application.setOrganizationName(_app_pkg.ORGANIZATION)

    apply_global_stylesheet(application)

    window = MainWindow()
    window.show()

    sys.exit(application.exec())


if __name__ == "__main__":
    main()
