# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for HEMOSCOREAPP desktop app (PySide6 + XGBoost, CPU-only)

block_cipher = None

a = Analysis(
    ["run_app.py"],
    pathex=["."],
    binaries=[],
    datas=[
        ("appdata", "appdata"),
    ],
    hiddenimports=[
        "xgboost",
        "xgboost.core",
        "xgboost.sklearn",
        "joblib",
        "numpy",
        "pandas",
        "sklearn",
        "sklearn.utils._cython_blas",
        "openpyxl",
        "openpyxl.styles",
        "openpyxl.utils",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["matplotlib", "IPython", "jupyter", "notebook", "scipy"],
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
    console=False,
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
    name="HEMOSCOREAPP",
)
