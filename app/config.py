"""
app/config.py
Central configuration: absolute paths and application-level constants.

All paths are resolved at import time relative to the project root,
so the app works regardless of the working directory it is launched from.
"""

from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────────
# Project root  (two levels up from this file: app/config.py → app/ → root)
# ──────────────────────────────────────────────────────────────────────────────
BASE_DIR: Path = Path(__file__).resolve().parent.parent

# ──────────────────────────────────────────────────────────────────────────────
# Directory layout
# ──────────────────────────────────────────────────────────────────────────────
APPDATA_DIR: Path = BASE_DIR / "appdata"
EXPORTS_DIR: Path = BASE_DIR / "exports"

# Ensure the exports directory exists at startup
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────────
# Model & spec files  (all located inside appdata/)
# ──────────────────────────────────────────────────────────────────────────────
MODEL_JSON: Path    = APPDATA_DIR / "pulsar_xgb_final_clinical_super.json"
MODEL_JOBLIB: Path  = APPDATA_DIR / "pulsar_xgb_final_clinical_super.joblib"
PREPROCESSING_SPEC: Path = APPDATA_DIR / "pulsar_preprocessing_spec.json"
FEATURES_FILE: Path      = APPDATA_DIR / "pulsar_features.json"
IMPUTATION_FILE: Path    = APPDATA_DIR / "pulsar_imputation_values.json"
RISK_GROUPS_FILE: Path   = APPDATA_DIR / "pulsar_risk_groups.json"
TEST_CASE_FILE: Path     = APPDATA_DIR / "pulsar_test_case.json"

# ──────────────────────────────────────────────────────────────────────────────
# Application identity
# ──────────────────────────────────────────────────────────────────────────────
APP_NAME: str     = "HEMOSCOREAPP"
APP_VERSION: str  = "1.0.0"
APP_SUBTITLE: str = "Cardiogenic Shock \u2022 In-Hospital Mortality Risk"
ORGANIZATION: str = "ITAMEX Hemod\u00edn\u00e1mica"

# ──────────────────────────────────────────────────────────────────────────────
# Export filename templates  –  call .format(timestamp=now_timestamp())
# ──────────────────────────────────────────────────────────────────────────────
EXPORT_CSV_TEMPLATE: str   = "hemscore_report_{timestamp}.csv"
EXPORT_EXCEL_TEMPLATE: str = "hemscore_report_{timestamp}.xlsx"
EXPORT_JSON_TEMPLATE: str  = "hemscore_report_{timestamp}.json"
