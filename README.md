# HEMOSCOREAPP

> **PULSAR XGBoost** — Cardiogenic Shock In-Hospital Mortality Risk Calculator

A local, offline-capable clinical decision-support tool for estimating in-hospital mortality risk in cardiogenic shock patients, powered by the PULSAR XGBoost model developed by the **ITA-MEX Collaborative Group**.

---

## ⚠️ Intended Use & Disclaimer

HEMOSCOREAPP is provided **for research and educational purposes only**. It is **not** a certified medical device and has **not** received regulatory clearance (FDA, CE, COFEPRIS, or equivalent). It must not be used as the sole or primary basis for clinical decisions. All predictions must be interpreted by qualified medical personnel in conjunction with full clinical assessment.

See the **Disclosures** tab within the application for the complete ITA-MEX disclaimer.

---

## Architecture

```text
Hemoscoreapp/
├── backend/            FastAPI (Python) — serves the PULSAR XGBoost model
│   ├── app/            API routes, schemas, core inference logic
│   └── appdata/        Model artefacts (.joblib, .json, feature specs)
├── frontend/           Next.js 14 (TypeScript + Tailwind CSS)
│   ├── app/            Pages (home, settings)
│   └── components/     UI components (input panel, result panel, gauges …)
├── app/                Standalone PySide6 desktop app (alternative to web UI)
├── appdata/            Shared model artefacts for the desktop app
├── requirements.txt    Python deps for the desktop app
└── run_app.py          Desktop app entry point
```

**The web stack (backend + frontend) is the primary interface.**  
The `app/` desktop GUI is a standalone alternative shipped in the same repo.

---

## Prerequisites

| Requirement | Version |
| --- | --- |
| Python | ≥ 3.11 |
| Node.js | ≥ 18 |
| npm | ≥ 9 |

> **CPU only.** No GPU is required. XGBoost runs entirely on CPU.  
> No internet connection is required at runtime.

---

## Forcing CPU-only Execution

The standard `pip install xgboost` package has no GPU support, so inference runs on CPU by default.  
If you have a CUDA-capable GPU and a GPU-enabled XGBoost build installed, use one of the following methods to ensure the model stays on CPU.

**Option A — hide GPUs via environment variable (recommended)**

Set `CUDA_VISIBLE_DEVICES` to an empty string before starting the backend.  
This makes all GPUs invisible to any CUDA-aware library (XGBoost, NumPy, etc.).

```bash
# Windows (PowerShell)
$env:CUDA_VISIBLE_DEVICES = ""
.venv\Scripts\uvicorn backend.app.main:app --port 8000

# Windows (CMD)
set CUDA_VISIBLE_DEVICES=
.venv\Scripts\uvicorn backend.app.main:app --port 8000

# macOS / Linux
CUDA_VISIBLE_DEVICES="" .venv/bin/uvicorn backend.app.main:app --port 8000
```

**Option B — install the CPU-only wheel explicitly**

```bash
pip uninstall xgboost -y
pip install xgboost   # always resolves to the CPU wheel from PyPI
```

> You can verify which device XGBoost will use at runtime:
> ```python
> import xgboost as xgb; print(xgb.__version__)
> ```
> As long as you did **not** install `xgboost-gpu` or a CUDA build, inference is CPU-only regardless of hardware.

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/<your-org>/hemoscoreapp.git
cd hemoscoreapp
```

### 2. Set up the Python virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r backend/requirements.txt
```

### 4. Start the backend

```bash
# From the repo root
.venv/Scripts/uvicorn backend.app.main:app --port 8000

# macOS / Linux
.venv/bin/uvicorn backend.app.main:app --port 8000
```

Verify it is running:

```http
GET http://localhost:8000/health
```

Expected response: `{"status":"ok","model_loaded":true}`

### 5. Install frontend dependencies

```bash
cd frontend
npm install
```

### 6. Start the frontend

```bash
# Development
npm run dev          # http://localhost:3000

# Production build
npm run build
npm start
```

The app opens at `http://localhost:3000` (or the next available port).

---

## Environment Variables

The frontend reads one optional variable:

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | FastAPI backend URL |

Create `frontend/.env.local` to override:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## Model: PULSAR XGBoost

| Property | Value |
| --- | --- |
| Algorithm | XGBoost (gradient boosted trees) |
| Task | Binary classification — in-hospital mortality |
| Input features | 32 clinical variables |
| Training population | ITA-MEX multi-center cohort (cardiogenic shock) |
| Runtime | CPU only, inference < 50 ms |
| Artefact | `appdata/pulsar_xgb_final_clinical_super.joblib` |

Risk is reported in four tiers:

| Tier | Probability |
| --- | --- |
| Low | < 10 % |
| Intermediate | 10 – < 25 % |
| High | 25 – < 50 % |
| Very high | ≥ 50 % |

---

## Desktop App (PySide6)

A standalone desktop GUI is included as an alternative to the web interface:

```bash
# Install additional deps
pip install -r requirements.txt

# Run
python run_app.py
```

---

## Distributing to a Client (Windows Standalone Exe)

The app can be packaged into a single folder (`dist/HEMOSCOREAPP_WEB/`) that
the client runs with **no Python, no Node.js, and no internet connection**
required.  Everything — backend, model, and frontend — is bundled inside.

### Step 1 — Build the Next.js static export (run once, or after any frontend change)

```powershell
cd frontend
$env:NEXT_EXPORT = "1"
npm run build        # outputs to frontend/out/
cd ..
```

### Step 2 — Build the Windows executable with PyInstaller

```powershell
# From the repo root, with the virtual environment active
pip install pyinstaller          # only needed the first time
pyinstaller hemoscoreapp_web.spec --clean
```

The output is `dist\HEMOSCOREAPP_WEB\` (a folder, **not** a single file).

> `dist/` is listed in `.gitignore` and will never be committed to the repository.

### Step 3 — Deliver to the client

1. Compress `dist\HEMOSCOREAPP_WEB\` into a ZIP archive.
2. Send the ZIP to the client (USB drive, file transfer, etc.).

### Client installation (what you tell the client)

1. Unzip the archive anywhere (e.g. `C:\HEMOSCOREAPP_WEB\`).
2. Double-click **`HEMOSCOREAPP.exe`** inside that folder.
3. The app opens automatically in the default browser at `http://localhost:8000`.
4. Close the terminal window (or the exe in the system tray) to shut down the server.

> No Python, Node.js, or any other software needs to be installed on the client machine.

---

## Development

### Run backend smoke tests

```bash
.venv/Scripts/python _smoke_backend.py     # Windows
.venv/bin/python   _smoke_backend.py       # macOS / Linux
```

Expected output: `ALL CHECKS PASSED`

### Type-check the frontend

```bash
cd frontend
npx tsc --noEmit
```

### Production build check

```bash
cd frontend
npm run build
```

---

## Authors

### ITA-MEX Collaborative Group

---

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

## Citation

If you use HEMOSCOREAPP or the PULSAR model in your research, please cite the original publication (details in the **Disclosures** tab of the application).
