"""Smoke test for the HEMOSCOREAPP backend."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))

# ── 1. Core bridge ────────────────────────────────────────────────────────────
from backend.app.core import InferenceService, PredictionResult, ComparisonResult
print("Core bridge: OK")

# ── 2. Schemas ────────────────────────────────────────────────────────────────
from backend.app.schemas.common import dataclass_to_dict, MetadataResponse
from backend.app.schemas.predict import PredictRequest, PredictResponse
from backend.app.schemas.compare import CompareRequest, CompareResponse
print("Schemas: OK")

# ── 3. Routes importable ──────────────────────────────────────────────────────
from backend.app.api import routes_health, routes_metadata, routes_predict, routes_compare
print("Routes: OK")

# ── 4. FastAPI app builds ─────────────────────────────────────────────────────
from backend.app.main import app
print("FastAPI app created:", app.title)

# ── 5. Core inference wired through backend config ───────────────────────────
svc = InferenceService()
result = svc.run_test_case()
print(f"Test case: {result.risk_percent:.1f}%  {result.risk_result.label}")
print(f"  Imputed: {result.imputed_fields or '(none)'}")

# ── 6. Serialise PredictionResult → PredictResponse ─────────────────────────
resp = PredictResponse.model_validate(dataclass_to_dict(result))
print(f"PredictResponse.risk_result.category: {resp.risk_result.category}")
print(f"PredictResponse.explanation.all_contributions count: {len(resp.explanation.all_contributions)}")

# ── 7. Compare path ───────────────────────────────────────────────────────────
comp = svc.compare({"lactate": 2.0}, {"lactate": 9.0, "base_ecmo": 1, "base_scai_admission_num": 5})
print(f"Comparison: {comp.change_label.value}  shift='{comp.category_shift}'")
print(f"  delta_absolute: {comp.delta_absolute:.4f}")

# ── 8. Metadata path ──────────────────────────────────────────────────────────
bundle = svc._get_bundle()
fi_pairs = list(zip(bundle.features, bundle.feature_importances.tolist()))
top_feat = sorted(fi_pairs, key=lambda x: -x[1])[:3]
print(f"Top 3 features: {[f for f, _ in top_feat]}")

print()
print("ALL CHECKS PASSED")
