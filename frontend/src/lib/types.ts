export type RunStatus = "pending" | "completed" | "failed" | "processing"
export type MetricType = "predefined" | "custom"

export interface Tenant {
  id: string
  name: string
  api_key: string | null
}

export interface MetricConfig {
  prompt_template?: string
  model?: string
  output_schema?: Record<string, string>
  temperature?: number
}

export interface Metric {
  id: string
  name: string
  type: MetricType
  config: MetricConfig
  created_at: string
}

export interface EvaluationRun {
  run_id: string
  status: RunStatus
  metadata: {
    environment?: string
    model_tested?: string
    dataset_version?: string
    requested_metrics?: string[]
    [key: string]: unknown
  }
  item_count: number
  created_at: string
  updated_at: string
}

export interface ScoreDetail {
  value: number
  details: {
    reason?: string
    [key: string]: unknown
  }
}

export interface EvaluationItem {
  item_id: string
  query: string
  response: string
  contexts?: string[]
  ground_truth?: string
  scores: Record<string, ScoreDetail>
}

export interface EvaluationDetail extends EvaluationRun {
  summary: Record<string, number>
  items: EvaluationItem[]
}

export interface HumanReviewSample {
  item_id: string
  query: string
  response: string
  contexts: string[]
  ground_truth?: string
  metric_name: string
  llm_score: number
  llm_reason: string
  run_id?: string
}

export interface CalibrationSample {
  human: number
  llm: number
  delta: number
  reason: string
}

export interface CalibrationStat {
  metric_name: string
  total_reviewed: number
  mean_human_score: number
  mean_llm_score: number
  mean_absolute_error: number
  correlation_pearson: number | null
  bias_detected: boolean
  samples: CalibrationSample[]
}

export interface HealthStatus {
  status: "healthy" | "unhealthy"
  environment: string
  database: "connected" | "disconnected"
  version: string
}

export type Page =
  | "overview"
  | "evaluations"
  | "evaluation-detail"
  | "metrics"
  | "human-reviews"
  | "calibration"
  | "settings"
