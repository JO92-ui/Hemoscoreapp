"""Export the corrected retrospective PULSAR research prototype.

Pass the corrected imputation-9 pickle and its clinical–hemodynamic variable
map explicitly. Use XGBoost 3.2.0 with pandas, NumPy, joblib and openpyxl.
The training files stay outside the app and no episode-level values are exported.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb


MODEL_VERSION = "pulsar-modelo03-retrospective"
XGB_VERSION = "3.2.0"
MODEL_NAME = "pulsar_xgb_final_clinical_super"
RISK_GROUPS = {
    "Low (<10%)": [0.00, 0.10],
    "Intermediate (10–<25%)": [0.10, 0.25],
    "High (25–<50%)": [0.25, 0.50],
    "Very high (≥50%)": [0.50, 1.00],
}
FEATURE_BLOCKS = (
    "hemo_current_vars", "hemo_delta_vars", "hemo_tothours_vars",
    "clinical_fixed_vars", "scai_admission_var", "scai_maximum_var",
    "scai_worsening_var", "support_vars",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.write_bytes(json.dumps(value, indent=2).encode("utf-8"))


def fit_original_full_cohort(feature_data: Path, variable_map: Path):
    """Fit one full-cohort model using the historical app export specification."""
    if xgb.__version__ != XGB_VERSION:
        raise RuntimeError(f"Expected XGBoost {XGB_VERSION}, loaded {xgb.__version__}")

    row = pd.read_excel(variable_map).iloc[0]
    features = [name.strip() for key in FEATURE_BLOCKS for name in row[key].split("|")]
    if len(features) != 32 or len(set(features)) != 32 or not all(features):
        raise ValueError("Expected 32 unique ordered clinical–hemodynamic features")

    data = pd.read_pickle(feature_data)
    admission, maximum, worsening = (row[key] for key in (
        "scai_admission_var", "scai_maximum_var", "scai_worsening_var",
    ))
    if worsening not in data:
        data[worsening] = (pd.to_numeric(data[maximum], errors="coerce")
                           - pd.to_numeric(data[admission], errors="coerce")).clip(lower=0)

    target = "In-hospital death"
    y = pd.to_numeric(data[target], errors="coerce")
    keep = y.notna()
    x = data.loc[keep, features].apply(pd.to_numeric, errors="coerce").reset_index(drop=True)
    y = y.loc[keep].reset_index(drop=True)
    if not y.isin([0, 1]).all() or (len(y), int(y.sum())) != (3846, 1392):
        raise ValueError("Training rows do not match the archived Model 03 cohort")
    y = y.astype(int)

    ordinal = [name for name in (admission, maximum, worsening, "base_ventilation", "ventilation_status")
               if name in features]
    binary = [name for name in features if name not in ordinal and x[name].notna().any()
              and x[name].dropna().isin([0, 1]).all()]
    continuous = [name for name in features if name not in ordinal and name not in binary]

    imputation = {}
    for name in features:
        series = x[name]
        modes = series.mode() if name in binary or name in ordinal else None
        fill = modes.iloc[0] if modes is not None and not modes.empty else series.median()
        imputation[name] = 0.0 if pd.isna(fill) else float(fill)
    x = x.fillna(imputation)
    if not np.isfinite(x.to_numpy()).all():
        raise ValueError("Non-finite model input after applying historical imputation")

    parameters = dict(n_estimators=600, max_depth=3, learning_rate=0.03, subsample=0.85,
                      colsample_bytree=0.85, min_child_weight=3, reg_alpha=0.1,
                      reg_lambda=1.0, objective="binary:logistic", eval_metric="logloss",
                      scale_pos_weight=float(y.eq(0).sum() / y.eq(1).sum()), random_state=42)
    model = xgb.XGBClassifier(**parameters, n_jobs=-1)
    model.fit(x, y)

    spec = dict(model_name="PULSAR XGBoost final clinical super", model_version=MODEL_VERSION,
                dataset_path="feature_engineered_datasets_final/stack_feat_imp_9.pkl", target=target,
                n_features=len(features), features=features, ordinal_vars=ordinal, binary_vars=binary,
                continuous_vars=continuous, imputation=imputation, risk_thresholds=RISK_GROUPS,
                xgb_params=parameters,
                provenance=dict(study_revision="Modelo 03", xgboost_version=XGB_VERSION,
                                training_strategy="single full-cohort research model",
                                imputation_index=9, landmark_rows=len(y), outcome_rows=int(y.sum()),
                                feature_data_sha256=sha256(feature_data), variable_map_sha256=sha256(variable_map)))
    return model, spec


def write_bundle(directory: Path, model: xgb.XGBClassifier, spec: dict, *, include_template: bool) -> None:
    features, imputation = spec["features"], spec["imputation"]
    model_path = directory / f"{MODEL_NAME}.json"
    joblib_path = directory / f"{MODEL_NAME}.joblib"
    imputation_path = directory / "pulsar_imputation_values.json"
    model.save_model(model_path)
    joblib.dump(model, joblib_path)
    write_json(directory / "pulsar_features.json", features)
    write_json(imputation_path, imputation)
    write_json(directory / "pulsar_risk_groups.json", RISK_GROUPS)
    spec["model_sha256"] = sha256(model_path)
    spec["imputation_sha256"] = sha256(imputation_path)
    write_json(directory / "pulsar_preprocessing_spec.json", spec)

    if include_template:
        # The blank template and dictionary contain no observations from the training data.
        dictionary = pd.DataFrame({
            "feature": features,
            "type": ["ordinal" if name in spec["ordinal_vars"] else
                     "binary" if name in spec["binary_vars"] else "continuous" for name in features],
            "impute_value": [imputation[name] for name in features],
        })
        with pd.ExcelWriter(directory / "pulsar_example_input.xlsx", engine="openpyxl") as writer:
            pd.DataFrame(columns=features).to_excel(writer, sheet_name="input_template", index=False)
            dictionary.to_excel(writer, sheet_name="feature_dictionary", index=False)

    native = xgb.XGBClassifier()
    native.load_model(model_path)
    wrapped = joblib.load(joblib_path)
    synthetic = np.array([[imputation[name] for name in features]])
    np.testing.assert_array_equal(native.predict_proba(synthetic), wrapped.predict_proba(synthetic))
    if native.get_booster().feature_names != features:
        raise ValueError("Saved booster feature order differs from the resolved variable map")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--feature-data", type=Path, required=True, help="Verified corrected stack_feat_imp_9.pkl")
    parser.add_argument("--variable-map", type=Path, required=True, help="Verified corrected resolved_variable_map_iecv.xlsx")
    parser.add_argument("--template-spec", type=Path, help="Optional existing app spec to verify the input contract.")
    parser.add_argument("--expected-feature-sha256", help="Pin a specific local feature artifact byte-for-byte.")
    parser.add_argument("--expected-map-sha256", help="Pin a specific local variable map byte-for-byte.")
    parser.add_argument("--output-dir", type=Path, action="append",
                        help="Bundle destination. Repeat to override the default appdata and backend/appdata.")
    parser.add_argument("--skip-example-workbook", action="store_true", help="Export only the model and metadata files.")
    args = parser.parse_args()
    if args.feature_data.name != "stack_feat_imp_9.pkl" or args.variable_map.name != "resolved_variable_map_iecv.xlsx":
        parser.error("Expected the corrected imputation-9 dataset and resolved clinical–hemodynamic variable map")
    for path, expected in ((args.feature_data, args.expected_feature_sha256),
                           (args.variable_map, args.expected_map_sha256)):
        if expected is not None and sha256(path) != expected.lower():
            parser.error(f"Input checksum differs for {path.name}")

    root = Path(__file__).resolve().parents[1]
    destinations = args.output_dir or [root / "appdata", root / "backend" / "appdata"]
    model, spec = fit_original_full_cohort(args.feature_data, args.variable_map)
    if args.template_spec is not None:
        original = json.loads(args.template_spec.read_text(encoding="utf-8"))
        for key in ("features", "ordinal_vars", "binary_vars", "continuous_vars", "risk_thresholds"):
            if original[key] != spec[key]:
                raise ValueError(f"Model export does not match the existing app contract for {key}")
    with TemporaryDirectory(prefix="pulsar-export-") as temp:
        bundle = Path(temp)
        write_bundle(bundle, model, spec, include_template=not args.skip_example_workbook)
        for destination in destinations:
            destination.mkdir(parents=True, exist_ok=True)
            for artifact in sorted(bundle.iterdir()):
                shutil.copyfile(artifact, destination / artifact.name)
            print(f"Exported {MODEL_VERSION} to {destination}")
    print(f"Verified {spec['n_features']} ordered features, XGBoost {XGB_VERSION}, native/joblib inference parity")


if __name__ == "__main__":
    main()
