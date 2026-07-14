# RAG Evaluation Harness - API Specification

This document details the backend API endpoints, request schemas, response schemas, and authentication mechanism for the RAG Evaluation Harness service.

## Table of Contents
1. [General Concepts & Authentication](#general-concepts--authentication)
2. [Error Response Structures](#error-response-structures)
3. [Tenants API](#1-tenants-api)
4. [Metrics API](#2-metrics-api)
5. [Evaluation API](#3-evaluation-api)
6. [Comparison API](#4-comparison-api)
7. [Human Reviews & Calibration API](#5-human-reviews--calibration-api)
8. [System Health API](#6-system-health-api)

---

## General Concepts & Authentication

### Base URL
- Local development: `http://localhost:8000` (or as configured in the environment)
- Route prefixes: 
  - API version 1 prefix: `/api/v1`
  - Health checks: `/` (no prefix)

### Authentication
Most endpoints under `/api/v1` require tenant authentication using an API key sent in the HTTP header:
- Header Key: `X-API-Key`
- Header Value: `<your-api-key>`

*Exceptions: `POST /api/v1/tenants` (used to sign up a new tenant) and `/health` / `/ready` do not require this header.*

---

## Error Response Structures

All errors returned by the API follow standardized JSON structures depending on the category of error. The frontend should handle these accordingly.

### 1. Standard Error Responses (400, 401, 403, 404, 409, 500)
Returned for explicit business logic violations (e.g. invalid API key, entity not found) and internal server errors.

- **Format:** JSON
- **Schema:**
```json
{
  "detail": "Detailed message describing the error"
}
```
- **Example (401 Unauthorized):**
```json
{
  "detail": "Invalid API key"
}
```

### 2. Validation Error Response (422 Unprocessable Entity)
Returned automatically by FastAPI/Pydantic when the input request payload structure, field types, or values fail verification.

- **Format:** JSON
- **Schema:**
```json
{
  "detail": [
    {
      "loc": ["location_type", "field_name"],
      "msg": "Error details or rule violated",
      "type": "error_type_identifier"
    }
  ]
}
```
- **Example (422 Missing Required Field):**
```json
{
  "detail": [
    {
      "loc": ["body", "metrics"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## 1. Tenants API

### 1.1 Create Tenant (Sign Up)
Registers a new tenant and generates an API key. **Save the API key returned in the response**; it is only returned once.

- **URL:** `/api/v1/tenants`
- **Method:** `POST`
- **Auth Required:** No
- **Request Body (JSON):**
```json
{
  "name": "Acme Corporation"
}
```
- **Response (JSON) - Status 201 Created:**
```json
{
  "id": "e4f8d55c-1122-3344-5566-778899aabbcc",
  "name": "Acme Corporation",
  "api_key": "rag_..."
}
```

### 1.2 Get Current Tenant Details
Returns the details of the tenant belonging to the provided `X-API-Key`.

- **URL:** `/api/v1/tenants/me`
- **Method:** `GET`
- **Auth Required:** Yes (`X-API-Key` header)
- **Response (JSON) - Status 200 OK:**
```json
{
  "id": "e4f8d55c-1122-3344-5566-778899aabbcc",
  "name": "Acme Corporation",
  "api_key": null
}
```

---

## 2. Metrics API

### 2.1 List Metrics
Lists all metrics available to the current tenant. This includes predefined metrics (e.g. `faithfulness`, `answer_relevancy`, `correctness`) and any custom metrics created by the tenant.

- **URL:** `/api/v1/metrics`
- **Method:** `GET`
- **Auth Required:** Yes (`X-API-Key` header)
- **Response (JSON) - Status 200 OK:**
```json
[
  {
    "id": "11111111-2222-3333-4444-555555555555",
    "name": "faithfulness",
    "type": "predefined",
    "config": {},
    "created_at": "2026-06-24T17:09:51Z"
  },
  {
    "id": "99999999-8888-7777-6666-555555555555",
    "name": "conciseness",
    "type": "custom",
    "config": {
      "prompt_template": "Rate the conciseness of the response on a scale of 0 to 1 based on the query...",
      "model": "llama-3.1-8b-instant",
      "output_schema": {
        "score": "float",
        "reason": "string"
      },
      "temperature": 0.0
    },
    "created_at": "2026-06-25T01:10:00Z"
  }
]
```

### 2.2 Create Custom Metric
Defines a custom evaluation metric driven by LLM prompts.

- **URL:** `/api/v1/metrics`
- **Method:** `POST`
- **Auth Required:** Yes (`X-API-Key` header)
- **Request Body (JSON):**
```json
{
  "name": "conciseness",
  "type": "custom",
  "config": {
    "prompt_template": "Evaluate whether the response is direct and lacks fluff. Score 0 to 1.",
    "model": "llama-3.1-8b-instant", // optional, defaults to "llama-3.1-8b-instant"
    "output_schema": {
      "score": "float",
      "reason": "string"
    },
    "temperature": 0.0 // optional, defaults to 0.0
  }
}
```
- **Response (JSON) - Status 201 Created:**
```json
{
  "id": "99999999-8888-7777-6666-555555555555",
  "name": "conciseness",
  "type": "custom",
  "config": {
    "prompt_template": "Evaluate whether the response is direct and lacks fluff. Score 0 to 1.",
    "model": "llama-3.1-8b-instant",
    "output_schema": {
      "score": "float",
      "reason": "string"
    },
    "temperature": 0.0
  },
  "created_at": "2026-06-25T01:10:00Z"
}
```

### 2.3 Update Custom Metric
Updates an existing custom metric config or name. **Predefined metrics cannot be modified.**

- **URL:** `/api/v1/metrics/{metric_id}`
- **Method:** `PUT`
- **Auth Required:** Yes (`X-API-Key` header)
- **Request Body (JSON):**
*All fields in the body are optional.*
```json
{
  "name": "conciseness_v2",
  "config": {
    "prompt_template": "New improved prompt template...",
    "model": "llama-3.1-8b-instant",
    "output_schema": {
      "score": "float",
      "reason": "string"
    },
    "temperature": 0.1
  }
}
```
- **Response (JSON) - Status 200 OK:**
```json
{
  "id": "99999999-8888-7777-6666-555555555555",
  "name": "conciseness_v2",
  "type": "custom",
  "config": {
    "prompt_template": "New improved prompt template...",
    "model": "llama-3.1-8b-instant",
    "output_schema": {
      "score": "float",
      "reason": "string"
    },
    "temperature": 0.1
  },
  "created_at": "2026-06-25T01:10:00Z"
}
```

### 2.4 Delete Custom Metric
Deletes a custom metric. **Predefined metrics cannot be deleted.** A custom metric cannot be deleted if it has already been used in completed evaluations (returns 409 Conflict).

- **URL:** `/api/v1/metrics/{metric_id}`
- **Method:** `DELETE`
- **Auth Required:** Yes (`X-API-Key` header)
- **Response - Status 204 No Content:** (Empty response body)

---

## 3. Evaluation API

### 3.1 Batch Evaluate
Triggers an asynchronous evaluation run for a batch of query-response-context items.

- **URL:** `/api/v1/evaluate`
- **Method:** `POST`
- **Auth Required:** Yes (`X-API-Key` header)
- **Request Body (JSON):**
```json
{
  "metadata": {
    "environment": "staging",
    "model_tested": "gpt-4o",
    "dataset_version": "v1.2"
  },
  "metrics": ["faithfulness", "answer_relevancy"],
  "items": [
    {
      "query": "What is the capital of France?",
      "response": "The capital of France is Paris.",
      "contexts": ["France is a country in Europe. Its capital is Paris."],
      "ground_truth": "Paris" // optional
    },
    {
      "query": "What is photosythesis?",
      "response": "It is how plants make food using sunlight.",
      "contexts": ["Photosynthesis is the process used by plants to convert light energy into chemical energy."],
      "ground_truth": "The process by which plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar." // optional
    }
  ]
}
```
- **Response (JSON) - Status 202 Accepted:**
```json
{
  "run_id": "aa11bb22-33cc-44dd-55ee-66ff77aa88bb",
  "status": "pending"
}
```

### 3.2 Single Item Evaluate
Triggers an asynchronous evaluation run for a single item. Useful for real-time testing.

- **URL:** `/api/v1/evaluate/single`
- **Method:** `POST`
- **Auth Required:** Yes (`X-API-Key` header)
- **Request Body (JSON):**
```json
{
  "metadata": {
    "source": "playground"
  },
  "metrics": ["faithfulness"],
  "item": {
    "query": "What is capital of France?",
    "response": "The capital is Paris.",
    "contexts": ["France's capital is Paris."],
    "ground_truth": "Paris"
  }
}
```
- **Response (JSON) - Status 202 Accepted:**
```json
{
  "run_id": "bb22cc33-44dd-55ee-66ff-77aa88bb99cc",
  "status": "pending"
}
```

### 3.3 List Evaluation Runs (with Pagination)
Retrieves a paginated list of evaluation runs for the tenant.

- **URL:** `/api/v1/evaluations`
- **Method:** `GET`
- **Auth Required:** Yes (`X-API-Key` header)
- **Query Parameters:**
  - `limit` (optional): Integer (1 to 100, default `20`)
  - `offset` (optional): Integer (>= 0, default `0`)
  - `status` (optional): String filter (e.g. `"pending"`, `"completed"`, `"failed"`)
- **Response (JSON) - Status 200 OK:**
```json
{
  "total": 1,
  "limit": 20,
  "offset": 0,
  "items": [
    {
      "run_id": "aa11bb22-33cc-44dd-55ee-66ff77aa88bb",
      "status": "completed",
      "metadata": {
        "environment": "staging",
        "model_tested": "gpt-4o",
        "dataset_version": "v1.2",
        "requested_metrics": ["faithfulness", "answer_relevancy"]
      },
      "item_count": 2,
      "created_at": "2026-06-25T00:00:00Z",
      "updated_at": "2026-06-25T00:01:00Z"
    }
  ]
}
```

### 3.4 Get Evaluation Run Details & Scores
Fetches the detailed results of a specific evaluation run including item-level scores and details.

- **URL:** `/api/v1/evaluations/{run_id}`
- **Method:** `GET`
- **Auth Required:** Yes (`X-API-Key` header)
- **Response (JSON) - Status 200 OK:**
```json
{
  "run_id": "aa11bb22-33cc-44dd-55ee-66ff77aa88bb",
  "status": "completed",
  "summary": {
    "faithfulness": 0.95,
    "answer_relevancy": 0.9
  },
  "items": [
    {
      "item_id": "cc33dd44-55ee-66ff-77aa-88bb99cc00dd",
      "query": "What is the capital of France?",
      "response": "The capital of France is Paris.",
      "scores": {
        "faithfulness": {
          "value": 1.0,
          "details": {
            "reason": "The response is fully supported by the provided context."
          }
        },
        "answer_relevancy": {
          "value": 0.9,
          "details": {
            "reason": "Directly and correctly answers the user's prompt."
          }
        }
      }
    }
  ]
}
```

---

## 4. Comparison API

### 4.1 Compare Multiple Evaluation Runs
Allows comparing average metrics across multiple runs (e.g. comparing model performance changes over time or different environments).

- **URL:** `/api/v1/evaluations/compare`
- **Method:** `POST`
- **Auth Required:** Yes (`X-API-Key` header)
- **Request Body (JSON):**
```json
{
  "run_ids": [
    "aa11bb22-33cc-44dd-55ee-66ff77aa88bb",
    "bb22cc33-44dd-55ee-66ff-77aa88bb99cc"
  ]
}
```
- **Response (JSON) - Status 200 OK:**
```json
{
  "comparison": {
    "aa11bb22-33cc-44dd-55ee-66ff77aa88bb": {
      "status": "completed",
      "metadata": {
        "environment": "staging",
        "model_tested": "gpt-4o"
      },
      "scores": {
        "faithfulness": 0.95,
        "answer_relevancy": 0.9
      }
    },
    "bb22cc33-44dd-55ee-66ff-77aa88bb99cc": {
      "status": "completed",
      "metadata": {
        "environment": "production",
        "model_tested": "gpt-3.5-turbo"
      },
      "scores": {
        "faithfulness": 0.85,
        "answer_relevancy": 0.88
      }
    }
  }
}
```

---

## 5. Human Reviews & Calibration API

### 5.1 Submit Human Review
Saves a human evaluator's score for an evaluation item and metric. This score can then be used to calibrate LLM evaluation accuracy.

- **URL:** `/api/v1/human-reviews`
- **Method:** `POST`
- **Auth Required:** Yes (`X-API-Key` header)
- **Request Body (JSON):**
```json
{
  "item_id": "cc33dd44-55ee-66ff-77aa-88bb99cc00dd",
  "metric_id": "11111111-2222-3333-4444-555555555555",
  "human_score": 0.8, // 0.0 to 1.0
  "human_reason": "Response is mostly good but missed small details", // optional
  "reviewer_id": "user_john_doe"
}
```
- **Response (JSON) - Status 201 Created:**
```json
{
  "id": "dd44ee55-66ff-77aa-88bb-99cc00ddeeff",
  "item_id": "cc33dd44-55ee-66ff-77aa-88bb99cc00dd",
  "metric_name": "faithfulness",
  "human_score": 0.8,
  "llm_score": 1.0,
  "agreement_delta": -0.2, // human_score - llm_score
  "reviewed_at": "2026-06-25T01:30:00Z"
}
```

### 5.2 Get Sample for Human Review (Spot Check)
Pulls random evaluation items that are completed, have LLM scores, but **do not yet have human reviews**. Used by human annotators to review recent runs.

- **URL:** `/api/v1/human-reviews/sample`
- **Method:** `GET`
- **Auth Required:** Yes (`X-API-Key` header)
- **Query Parameters:**
  - `run_id` (optional): UUID (filter by specific run)
  - `metric_name` (optional): String (filter by specific metric name)
  - `limit` (optional): Integer (default `30`)
- **Response (JSON) - Status 200 OK:**
```json
[
  {
    "item_id": "cc33dd44-55ee-66ff-77aa-88bb99cc00dd",
    "query": "What is the capital of France?",
    "response": "The capital of France is Paris.",
    "contexts": ["France is a country in Europe. Its capital is Paris."],
    "ground_truth": "Paris",
    "metric_name": "faithfulness",
    "llm_score": 1.0,
    "llm_reason": "Response is fully aligned with the context."
  }
]
```

### 5.3 Get Calibration Report
Generates calibration stats comparing human scoring vs LLM scoring per metric. Helps detect LLM evaluation bias or correlation strength.

- **URL:** `/api/v1/calibration-report`
- **Method:** `GET`
- **Auth Required:** Yes (`X-API-Key` header)
- **Query Parameters:**
  - `metric_name` (optional): String (filter stats to one metric)
  - `min_samples` (optional): Integer (minimum reviews required to compile report, default `20`)
- **Response (JSON) - Status 200 OK:**
```json
[
  {
    "metric_name": "faithfulness",
    "total_reviewed": 25,
    "mean_human_score": 0.88,
    "mean_llm_score": 0.92,
    "mean_absolute_error": 0.05,
    "correlation_pearson": 0.85, // Correlation coefficient. Null if cannot compute.
    "bias_detected": false, // True if mean_absolute_error > 0.1
    "samples": [
      {
        "human": 0.5,
        "llm": 1.0,
        "delta": 0.5,
        "reason": "LLM failed to see that Paris wasn't mentioned in the context."
      }
    ]
  }
]
```

---

## 6. System Health API

### 6.1 Basic Health Check
Checks service health and verify database connectivity.

- **URL:** `/health`
- **Method:** `GET`
- **Auth Required:** No
- **Response (JSON) - Status 200 OK (or 503 Service Unavailable if unhealthy):**
```json
{
  "status": "healthy",
  "environment": "development",
  "database": "connected",
  "version": "1.0.0"
}
```

### 6.2 Readiness Check
Kubernetes readiness probe.

- **URL:** `/ready`
- **Method:** `GET`
- **Auth Required:** No
- **Response (JSON) - Status 200 OK (or 503 Service Unavailable if not ready):**
```json
{
  "ready": true
}
```
