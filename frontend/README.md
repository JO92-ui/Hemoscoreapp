# HEMOSCOREAPP — Frontend

> Cardiogenic Shock Risk Dashboard · Next.js 14 · TypeScript · Tailwind CSS

A dark-mode clinical decision-support interface that connects to the HEMOSCOREAPP FastAPI backend to calculate, display, and compare XGBoost-based cardiogenic shock risk scores.

---

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 3.4 with custom design tokens |
| Icons | lucide-react |
| Utilities | clsx |
| HTTP client | Native `fetch` (typed wrapper in `lib/api.ts`) |

No charting libraries, no state management library, no UI component kit — intentionally minimal.

---

## File Structure

```text
frontend/
├── app/
│   ├── globals.css          # Base styles, design tokens, shared utility classes
│   ├── layout.tsx           # Root layout, font loading, metadata
│   └── page.tsx             # Main application page, all top-level state
├── components/
│   ├── header.tsx           # App header with branding
│   ├── footer.tsx           # Medical disclaimer footer
│   ├── input-panel.tsx      # Dynamic feature input form (driven by /metadata)
│   ├── baseline-card.tsx    # Saved baseline snapshot display
│   ├── result-panel.tsx     # Current risk result + comparison block
│   ├── risk-gauge.tsx       # SVG semicircle gauge (no external lib)
│   └── influence-panel.tsx  # Feature contribution panel with disclaimer
├── lib/
│   ├── api.ts               # Typed fetch client for FastAPI backend
│   └── types.ts             # TypeScript interfaces mirroring Pydantic schemas
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.mjs
└── package.json
```

---

## Installation

```bash
cd frontend
npm install
```

---

## Environment Variable

Create a `.env.local` file inside `frontend/`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

If the variable is absent the client defaults to `http://localhost:8000`.  
Set this to your deployed API URL before running `npm run build` for production.

---

## Development

Start the FastAPI backend first (from the project root):

```bash
# From Hemoscoreapp/
uvicorn backend.app.main:app --reload
```

Then start the Next.js dev server:

```bash
# From Hemoscoreapp/frontend/
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Production Build

```bash
# From Hemoscoreapp/frontend/
npm run build
npm run start
```

---

## Backend Connection

All network calls go through `lib/api.ts`, which wraps `fetch` and throws a typed `ApiError` on non-2xx responses. The base URL is read from `NEXT_PUBLIC_API_BASE_URL`.

### Endpoints used

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/metadata` | Load feature definitions, risk thresholds, imputation defaults |
| `GET` | `/test-case` | Fill the form with a pre-built reference patient |
| `POST` | `/predict` | Compute risk score for the current input set |
| `POST` | `/compare` | Compare baseline inputs vs current inputs |

The frontend does **not** persist data to the backend. Baseline snapshots live in React state and are lost on page reload.

---

## Usage Flow

1. **Load metadata** — On mount, `page.tsx` calls `GET /metadata`. The response drives the input form: feature names, types, ranges, and population-median imputation defaults.

2. **Fill inputs** — `InputPanel` renders one control per feature. Empty fields are sent as `null`; the backend applies median imputation and returns which fields were imputed in `imputed_fields`.

3. **Calculate current risk** — Clicking **Calculate Risk** sends `POST /predict`. The response renders in `ResultPanel` with a risk gauge, imputed-field warnings, out-of-range warnings, and the feature influence panel.

4. **Save baseline** — Clicking **Save as Baseline** snapshots the current inputs and risk result into component state, shown in `BaselineCard`.

5. **Modify variables** — Adjust one or more inputs to simulate a clinical intervention or an alternative scenario.

6. **Compare baseline vs current** — Clicking **Compare** sends `POST /compare` with both input sets. `ResultPanel` shows both gauges side by side, absolute delta (percentage points), relative delta (%), and a category-shift label (`improved` / `worsened` / `unchanged`).

---

## Feature Explanation — Honest Disclaimer

The influence values shown in `InfluencePanel` are produced by an **ICE-delta proxy** (Individual Conditional Expectation perturbation). They reflect how sensitive the model's output is to each feature relative to a population-median reference.

These values are **not causal**. They do not represent biological mechanisms, clinician recommendations, or treatment effects. The model was trained on observational registry data; correlational associations cannot be interpreted as causal relationships.

Every explanation is labelled in the UI as:

> *"Model explanation proxy — ICE-based heuristic. This is a non-causal heuristic interpretation. Feature contributions reflect model sensitivity, not biological causality."*

This disclaimer is not optional and must remain visible.

---

## Troubleshooting

**`Cannot reach the HEMOSCOREAPP backend`**  
The FastAPI server is not running or not accessible at the configured URL. Start it with `uvicorn api.main:app --reload` from the project root.

**`npm run dev` fails with "Missing script: dev"**  
Make sure you are running the command from `Hemoscoreapp/frontend/`, not the project root.

**Input form is empty after page load**  
The `GET /metadata` call failed. Check the browser console for a network error and verify the backend is reachable at the URL in `.env.local`.

**Build error: type mismatch**  
`lib/types.ts` mirrors the backend Pydantic schemas. If the backend schemas changed, update `types.ts` to match and rebuild.

#### Port 3000 already in use

```bash
npx kill-port 3000
npm run dev
```

---

## Notes

- All styles use Tailwind utility classes plus custom tokens defined in `tailwind.config.ts` (`surface-*`, `navy-*`, `risk-*`).
- The app is fully client-side rendered (`"use client"` on all interactive components). There is no server-side data fetching.
- No authentication is implemented. If the backend is deployed behind auth, extend `lib/api.ts` to include the appropriate authorization headers.
