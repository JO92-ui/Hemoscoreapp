"""
backend/app/api/routes_metadata.py
GET /metadata  –  Model and feature metadata.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from backend.app.schemas.common import (
    FeatureImportanceSchema,
    MetadataResponse,
    RiskGroupSchema,
)

router = APIRouter(tags=["Metadata"])


@router.get(
    "/metadata",
    response_model=MetadataResponse,
    summary="Model and feature metadata",
    description=(
        "Returns model identity, feature list, variable type classifications, "
        "risk group thresholds, normalised feature importances, and imputation "
        "defaults.  Useful for building dynamic frontend form fields."
    ),
)
def get_metadata(request: Request) -> MetadataResponse:
    service = request.app.state.service

    try:
        bundle = service._get_bundle()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Model bundle unavailable: {exc}",
        ) from exc

    spec = bundle.spec

    # Risk groups → schema
    risk_groups = [
        RiskGroupSchema(
            label=g.label,
            lower=g.lower,
            upper=g.upper,
            color=g.color,
        )
        for g in bundle.risk_groups
    ]

    # Build feature-importance dict (ndarray aligned to bundle.features)
    fi_pairs = list(zip(bundle.features, bundle.feature_importances.tolist()))
    top_features = [
        FeatureImportanceSchema(feature=feat, importance=round(float(imp), 6))
        for feat, imp in sorted(fi_pairs, key=lambda x: x[1], reverse=True)
    ]

    return MetadataResponse(
        model_name=spec.get("model_name", "PULSAR XGBoost"),
        api_version="1.0.0",
        n_features=spec.get("n_features", len(bundle.features)),
        features=bundle.features,
        continuous_vars=spec.get("continuous_vars", []),
        binary_vars=spec.get("binary_vars", []),
        ordinal_vars=spec.get("ordinal_vars", []),
        risk_groups=risk_groups,
        top_features_by_importance=top_features,
        imputation_defaults=bundle.imputation,
        xgb_params=spec.get("xgb_params", {}),
    )
