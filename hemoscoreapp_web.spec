# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for HEMOSCOREAPP Web exe
# Bundles: FastAPI + uvicorn backend  +  Next.js static frontend
# Output:  dist\HEMOSCOREAPP_WEB\HEMOSCOREAPP.exe

block_cipher = None

a = Analysis(
    ["launcher_web.py"],
    pathex=["."],
    binaries=[
        # XGBoost native library — must be explicitly included
        (r".venv\Lib\site-packages\xgboost\lib\xgboost.dll", "xgboost/lib"),
    ],
    datas=[
        # Model artefacts used by the backend
        ("backend/appdata", "backend/appdata"),
        # Next.js static export (HTML / CSS / JS / fonts)
        ("frontend/out", "frontend_out"),
        # XGBoost Python package data (VERSION file, etc.)
        (r".venv\Lib\site-packages\xgboost", "xgboost"),
    ],
    hiddenimports=[
        # ── XGBoost / ML ──────────────────────────────────────────────────────
        "xgboost",
        "xgboost.core",
        "xgboost.sklearn",
        "joblib",
        "numpy",
        "pandas",
        "scipy",
        "sklearn",
        "sklearn.utils._cython_blas",
        # ── Web server ────────────────────────────────────────────────────────
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.config",
        "uvicorn.main",
        # ── FastAPI / Starlette ───────────────────────────────────────────────
        "fastapi",
        "fastapi.staticfiles",
        "fastapi.responses",
        "starlette",
        "starlette.staticfiles",
        "starlette.responses",
        "starlette.routing",
        "starlette.middleware",
        "starlette.middleware.cors",
        "anyio",
        "anyio._backends._asyncio",
        "h11",
        "pydantic",
        # ── Backend inference modules (discovered via bridge pattern) ─────────
        "app.config",
        "app.core",
        "app.core.inference_service",
        "app.core.model_loader",
        "app.core.preprocessing",
        "app.core.risk_logic",
        "app.core.explanation_proxy",
        "backend.app.config",
        "backend.app.core",
        # ── Standard library / misc ───────────────────────────────────────────
        "openpyxl",
        "openpyxl.styles",
        "openpyxl.utils",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["PySide6", "PyQt5", "PyQt6", "tkinter", "matplotlib", "IPython", "jupyter", "notebook"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="HEMOSCOREAPP",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,      # no console window — browser is the UI
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="HEMOSCOREAPP_WEB",
)
