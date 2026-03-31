
import json
import numpy as np
import xgboost as xgb

MODEL_FILE = "pulsar_xgb_final_clinical_super.json"
SPEC_FILE = "pulsar_preprocessing_spec.json"

def load_model():
    model = xgb.XGBClassifier()
    model.load_model(MODEL_FILE)
    return model

def load_spec():
    with open(SPEC_FILE, "r") as f:
        return json.load(f)

def assign_risk_group(risk):
    if risk < 0.10:
        return "Low (<10%)"
    elif risk < 0.25:
        return "Intermediate (10–<25%)"
    elif risk < 0.50:
        return "High (25–<50%)"
    return "Very high (≥50%)"

def predict_risk(input_dict):
    model = load_model()
    spec = load_spec()

    x = []
    for feat in spec["features"]:
        val = input_dict.get(feat, None)
        if val is None:
            val = spec["imputation"][feat]
        x.append(float(val))

    X = np.array(x, dtype=float).reshape(1, -1)
    risk = float(model.predict_proba(X)[0, 1])

    return {
        "risk_probability": risk,
        "risk_percent": round(risk * 100, 1),
        "risk_group": assign_risk_group(risk)
    }
