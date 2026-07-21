import type {
  Tenant,
  Metric,
  EvaluationRun,
  EvaluationDetail,
  HumanReviewSample,
  CalibrationStat,
  HealthStatus,
} from "./types"

// Base URL for API requests.
// - In production: leave empty (default) so requests are same-origin. The frontend
//   is reverse-proxied (Caddy/nginx) and the `/api/*` paths are forwarded to the api service.
// - For local dev: set VITE_API_BASE_URL in frontend/.env.local to point at an external backend
//   (e.g. a Codespaces/GH dev URL or a local FastAPI on http://localhost:8000).
//   The typed declaration lives in frontend/src/vite-env.d.ts.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""

function getApiKey(): string | null {
  try {
    return localStorage.getItem("api_key")
  } catch {
    return null
  }
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" }
  const key = getApiKey()
  if (key) h["X-API-Key"] = key
  return h
}

/**
 * Custom error class for API errors, carrying structured detail.
 * For 422 validation errors, `detail` is an array of field-level errors.
 * For other errors (400, 401, 403, 404, 409, 500), `detail` is a string.
 */
export class ApiError extends Error {
  status: number
  detail: string | unknown[]

  constructor(message: string, status: number, detail: string | unknown[] = message) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
  }

  /**
   * Returns a user-friendly error message string.
   * - For string detail: returns the string as-is.
   * - For array detail (422): joins each error's `loc` and `msg`.
   */
  humanMessage(): string {
    if (typeof this.detail === "string") return this.detail
    if (Array.isArray(this.detail)) {
      return this.detail
        .map((err: any) => {
          const loc = Array.isArray(err?.loc) ? err.loc.join(" → ") : "unknown"
          const msg = err?.msg ?? "Invalid value"
          return `${loc}: ${msg}`
        })
        .join("\n")
    }
    return this.message
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers(), ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = body.detail ?? `HTTP ${res.status}`
    const message = typeof detail === "string"
      ? detail
      : `HTTP ${res.status}`
    throw new ApiError(message, res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Health ──────────────────────────────────────────────
export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE_URL}/health`)
  if (!res.ok) throw new Error("Health check failed")
  return res.json()
}

// ── Tenants ─────────────────────────────────────────────
export async function verifyApiKey(key: string): Promise<Tenant> {
  const res = await fetch(`${BASE_URL}/api/v1/tenants/me`, {
    headers: { "Content-Type": "application/json", "X-API-Key": key },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = body.detail ?? `HTTP ${res.status}`
    const message = typeof detail === "string" ? detail : `HTTP ${res.status}`
    throw new ApiError(message, res.status, detail)
  }
  return res.json()
}

export async function fetchTenant(): Promise<Tenant> {
  return request("/api/v1/tenants/me")
}

export async function createTenant(
  name: string
): Promise<Tenant> {
  return request("/api/v1/tenants", {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

// ── Metrics ─────────────────────────────────────────────
export async function fetchMetrics(): Promise<Metric[]> {
  return request("/api/v1/metrics")
}

export async function createMetric(payload: {
  name: string
  type: "custom"
  config: {
    prompt_template: string
    model?: string
    output_schema?: Record<string, string>
    temperature?: number
  }
}): Promise<Metric> {
  return request("/api/v1/metrics", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function updateMetric(
  metricId: string,
  payload: {
    name?: string
    config?: {
      prompt_template?: string
      model?: string
      output_schema?: Record<string, string>
      temperature?: number
    }
  }
): Promise<Metric> {
  return request(`/api/v1/metrics/${metricId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function deleteMetric(metricId: string): Promise<void> {
  return request(`/api/v1/metrics/${metricId}`, { method: "DELETE" })
}

// ── Evaluations ─────────────────────────────────────────
export async function fetchEvaluationRuns(params?: {
  limit?: number
  offset?: number
  status?: string
}): Promise<{ total: number; limit: number; offset: number; items: EvaluationRun[] }> {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set("limit", String(params.limit))
  if (params?.offset) qs.set("offset", String(params.offset))
  if (params?.status) qs.set("status", params.status)
  const q = qs.toString()
  return request(`/api/v1/evaluations${q ? `?${q}` : ""}`)
}

export async function fetchEvaluationDetail(
  runId: string
): Promise<EvaluationDetail> {
  return request(`/api/v1/evaluations/${runId}`)
}

export async function evaluateBatch(payload: {
  metadata?: Record<string, unknown>
  metrics: string[]
  items: {
    query: string
    response: string
    contexts: string[]
    ground_truth?: string
  }[]
}): Promise<{ run_id: string; status: string }> {
  return request("/api/v1/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function evaluateSingle(payload: {
  metadata?: Record<string, unknown>
  metrics: string[]
  item: {
    query: string
    response: string
    contexts: string[]
    ground_truth?: string
  }
}): Promise<{ run_id: string; status: string }> {
  return request("/api/v1/evaluate/single", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

// ── Human Reviews ───────────────────────────────────────
export async function fetchHumanReviewSamples(params?: {
  run_id?: string
  metric_name?: string
  limit?: number
}): Promise<HumanReviewSample[]> {
  const qs = new URLSearchParams()
  if (params?.run_id) qs.set("run_id", params.run_id)
  if (params?.metric_name) qs.set("metric_name", params.metric_name)
  if (params?.limit) qs.set("limit", String(params.limit))
  const q = qs.toString()
  return request(`/api/v1/human-reviews/sample${q ? `?${q}` : ""}`)
}

export async function submitHumanReview(payload: {
  item_id: string
  metric_id: string
  human_score: number
  human_reason?: string
  reviewer_id: string
}): Promise<{
  id: string
  item_id: string
  metric_name: string
  human_score: number
  llm_score: number
  agreement_delta: number
  reviewed_at: string
}> {
  return request("/api/v1/human-reviews", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

// ── Calibration ─────────────────────────────────────────
export async function fetchCalibrationReport(params?: {
  metric_name?: string
  min_samples?: number
}): Promise<CalibrationStat[]> {
  const qs = new URLSearchParams()
  if (params?.metric_name) qs.set("metric_name", params.metric_name)
  if (params?.min_samples) qs.set("min_samples", String(params.min_samples))
  const q = qs.toString()
  return request(`/api/v1/calibration-report${q ? `?${q}` : ""}`)
}
