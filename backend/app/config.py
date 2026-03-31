"""
backend/app/config.py
Path and application constants for the FastAPI backend.

This module intentionally mirrors the symbol names of the desktop app's
``app/config.py`` so that the shared core modules (model_loader, preprocessing,
inference_service …) resolve their imports without modification.

The only difference: BASE_DIR and APPDATA_DIR point to ``backend/`` instead
of the project root, so the backend uses ``backend/appdata/`` for all model
artefacts.

Populate ``backend/appdata/`` by copying the desktop app's ``appdata/``
directory:
    xcopy appdata  backend\\appdata  /E /I       (Windows cmd)
    cp -r appdata  backend/appdata               (Unix/macOS)
"""

from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# Directories
# ──────────────────────────────────────────────────────────────────────────────

# backend/app/config.py  →  backend/app/  →  backend/
BASE_DIR:    Path = Path(__file__).resolve().parent.parent

APPDATA_DIR: Path = BASE_DIR / "appdata"
EXPORTS_DIR: Path = BASE_DIR / "exports"

EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────────
# Model & spec files
# ──────────────────────────────────────────────────────────────────────────────

MODEL_JSON:        Path = APPDATA_DIR / "pulsar_xgb_final_clinical_super.json"
MODEL_JOBLIB:      Path = APPDATA_DIR / "pulsar_xgb_final_clinical_super.joblib"
PREPROCESSING_SPEC:Path = APPDATA_DIR / "pulsar_preprocessing_spec.json"
FEATURES_FILE:     Path = APPDATA_DIR / "pulsar_features.json"
IMPUTATION_FILE:   Path = APPDATA_DIR / "pulsar_imputation_values.json"
RISK_GROUPS_FILE:  Path = APPDATA_DIR / "pulsar_risk_groups.json"
TEST_CASE_FILE:    Path = APPDATA_DIR / "pulsar_test_case.json"

# ──────────────────────────────────────────────────────────────────────────────
# Application identity  (same as desktop app for consistent model metadata)
# ──────────────────────────────────────────────────────────────────────────────

APP_NAME:     str = "HEMOSCOREAPP"
APP_VERSION:  str = "1.0.0"
APP_SUBTITLE: str = "Cardiogenic Shock \u2022 In-Hospital Mortality Risk"
ORGANIZATION: str = "ITAMEX Hemod\u00edn\u00e1mica"

EXPORT_CSV_TEMPLATE:   str = "hemscore_report_{timestamp}.csv"
EXPORT_EXCEL_TEMPLATE: str = "hemscore_report_{timestamp}.xlsx"
EXPORT_JSON_TEMPLATE:  str = "hemscore_report_{timestamp}.json"
