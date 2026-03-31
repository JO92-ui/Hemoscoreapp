// FILE: frontend/lib/api.ts
// ─────────────────────────────────────────────────────────────────────────────
// Thin typed client for the HEMOSCOREAPP FastAPI backend.
// All functions throw an ApiError (with .status + .detail) on non-2xx.
// Base URL comes from NEXT_PUBLIC_API_BASE_URL env var (default localhost:8000).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  CompareRequest,
  CompareResponse,
  HealthResponse,
  MetadataResponse,
  PredictRequest,
  PredictResponse,
} from "./types";

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
    /\/$/,
    ""
  );

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly raw?: unknown
  ) {
    super(`API ${status}: ${detail}`);
    this.name = "ApiError";
  }
}

// ── Internal fetch wrapper ────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
  } catch (networkError) {
    throw new ApiError(
      0,
      "Cannot reach the HEMOSCOREAPP backend. Is the server running?",
      networkError
    );
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      // ignore JSON parse error
    }
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<T>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Public API functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /health — liveness probe.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

/**
 * GET /metadata — model metadata, feature list, imputation defaults, risk bands.
 * Cache-friendly: call once on app mount.
 */
export async function fetchMetadata(): Promise<MetadataResponse> {
  return apiFetch<MetadataResponse>("/metadata");
}

/**
 * GET /test-case — run the canonical test patient and return a PredictResponse.
 * Useful for the "Load test case" button.
 */
export async function fetchTestCase(): Promise<PredictResponse> {
  return apiFetch<PredictResponse>("/test-case");
}

/**
 * POST /predict — run inference for a custom patient input dictionary.
 *
 * @param inputs  Feature name → value map. Omit or null to impute.
 * @param includeExplanation  Whether to request the ICE-delta proxy. Default true.
 */
export async function predict(
  inputs: Record<string, number | null>,
  includeExplanation = true
): Promise<PredictResponse> {
  const body: PredictRequest = {
    inputs,
    include_explanation: includeExplanation,
  };
  return apiFetch<PredictResponse>("/predict", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * POST /compare — compare baseline vs current inputs.
 *
 * @param baselineInputs  Snapshot inputs saved by the user earlier.
 * @param currentInputs   Current form inputs.
 * @param includeExplanation  Whether to compute explanation for current. Default true.
 */
export async function compare(
  baselineInputs: Record<string, number | null>,
  currentInputs: Record<string, number | null>,
  includeExplanation = true
): Promise<CompareResponse> {
  const body: CompareRequest = {
    baseline_inputs: baselineInputs,
    current_inputs: currentInputs,
    include_explanation: includeExplanation,
  };
  return apiFetch<CompareResponse>("/compare", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
