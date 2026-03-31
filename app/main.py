"""
app/main.py
HEMOSCOREAPP entry point.

Runs the PySide6 event loop with the dark clinical theme applied.
"""

from __future__ import annotations

import sys
import logging

from PySide6.QtWidgets import QApplication

import app as _app_pkg
from app.styles import apply_global_stylesheet
from app.ui.main_window import MainWindow


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)


def main() -> None:
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
