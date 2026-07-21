# RAG Evaluation Harness

> **A production-grade "LLM-as-a-Judge" calibration platform for RAG systems.**  
> *Full-stack monorepo with a React dashboard and FastAPI backend — engineered for high-throughput async evaluation and human-in-the-loop trust.*

---

## Project Structure

```
├── backend/              # FastAPI + Celery + PostgreSQL backend
│   ├── app/              # Application code (API, services, models)
│   ├── tests/            # Pytest test suite
│   └── alembic/          # Database migrations
├── docker/               # Docker Compose & Dockerfiles
└── frontend/             # React + TypeScript dashboard
    ├── src/
    │   ├── components/   # Reusable UI components (shadcn/ui)
    │   ├── pages/        # Page-level components
    │   ├── lib/          # API client, types, utilities
    │   └── hooks/        # Custom React hooks
    └── package.json
```

## What Is This?

Imagine you have an **AI assistant** (a RAG system) that answers employee questions from company documents. It handles thousands of queries per day. But here's the problem: **"How do you know if the answers are actually correct?"**

This harness is an **automated evaluation lab** for that AI assistant. It doesn't just score answers — it also **checks whether the automated scorer itself can be trusted**, by comparing AI scores against human judgments. If the automated scorer is "lying" (e.g., giving 95/100 for a wrong answer), the system **sounds an alarm**.

### The "Scale" Problem

Manually reviewing thousands of AI answers is impossible. So we use an LLM (Groq) as an automated judge. But who judges the judge? That's where **human calibration** comes in.

**The analogy:** You have a digital scale at home. Every week, you also weigh yourself at a clinic (the "human standard"). If your home scale always shows +5 kg, you know the scale is broken — not that you gained weight. This harness does exactly that for AI evaluation.

---

## How It Works (The Flow)

### 1. Submit Answers for Evaluation
Your RAG system sends a batch of answers to the API. The API immediately returns a `run_id` and queues the heavy work.

**Why fast?** The API doesn't wait for the LLM. It delegates to background workers via Celery + Redis. Response time: **< 50ms**.

### 2. Background Evaluation (Celery Workers)
Workers call the Groq LLM API to score each answer across multiple dimensions (faithfulness, relevancy, correctness, or custom metrics). Results are saved to PostgreSQL.

**Resilience:** Workers handle rate limits with exponential backoff and limit concurrency to 5 parallel LLM calls.

### 3. Human Spot-Check (Weekly)
A human reviewer samples 20–30 random items that haven't been reviewed yet. They submit their own scores via the API.

### 4. Calibration Report
The system compares human scores vs. LLM scores per metric and generates a statistical report. If the average disagreement (MAE) exceeds 10%, a **bias alert** is triggered.

---

## Core Concepts

| Concept | Plain Explanation | Technical Equivalent |
|---------|-------------------|----------------------|
| **Evaluation Run** | One "exam session" containing multiple questions and answers | A batch job with metadata and status tracking |
| **Evaluation Item** | One question + answer pair inside a run | A row with query, response, contexts, ground_truth |
| **Metric** | An aspect being scored (e.g., "is this factually correct?") | A scoring dimension with a prompt template and parser |
| **Predefined Metric** | Built-in scoring dimensions provided by the system | `faithfulness`, `answer_relevancy`, `correctness` |
| **Custom Metric** | A scoring dimension you define yourself | Tenant-defined Jinja2 prompt + JSON schema |
| **Score** | The LLM's numerical rating for one item + one metric | A float (0.0–1.0) with reasoning details |
| **Human Review** | A human's rating for one item + one metric | Ground truth label for calibration |
| **Calibration Report** | A health check: "Is our automated judge trustworthy?" | Statistical comparison: MAE, Pearson correlation, bias flag |

### Why Calibration Is Per-Metric, Not Per-Item

One answer can be scored on multiple dimensions. A human might agree with the LLM on *faithfulness* but strongly disagree on *correctness*. Aggregating per-metric allows surgical diagnosis: **which specific "judge" is broken?**

---

## Database Schema Overview

**Tables:**

- **`tenants`** — Multi-tenant isolation. Each tenant has a hashed API key.
- **`evaluation_runs`** — A batch evaluation job. Tracks status: `pending` → `processing` → `completed` / `failed`.
- **`evaluation_items`** — Individual Q&A pairs within a run. Stores query, response, contexts, ground_truth, and raw payload.
- **`metric_definitions`** — Scoring dimensions. `type` is either `predefined` (system-owned, immutable) or `custom` (tenant-defined, editable).
- **`scores`** — The LLM's output for a specific item + metric. Includes the numeric value and JSON details (reasoning, token usage).
- **`human_reviews`** — Human judgments for calibration. Stores the human score, the LLM score at time of review, and the agreement delta.

**Key Design Decision:** Every table has a `tenant_id` foreign key. All queries are filtered by the tenant extracted from the `X-API-Key` header. This ensures strict data isolation.

---

## API Reference

> **Base URL:** `http://localhost:8000/api/v1`  
> **Auth Header:** `X-API-Key: <your-api-key>` (required on all endpoints)

---

### Authentication & Tenants

#### `POST /tenants` — Create Tenant
Register a new tenant. Predefined metrics (`faithfulness`, `answer_relevancy`, `correctness`) are auto-seeded.

**Request:**
```json
{
  "name": "acme-corp"
}
```

**Response:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "acme-corp",
  "api_key": "rag_xTh9kLm2pQr5vWx8z..."
}
```
> **Important:** Save the `api_key` immediately. It is hashed in the database and cannot be retrieved again.

---

### Evaluations

#### `POST /evaluate` — Batch Evaluation
Submit a batch of items to evaluate. Returns instantly with `run_id`. The actual evaluation runs in the background via Celery.

**Request:**
```json
{
  "metadata": {
    "rag_system": "my-rag-v2",
    "experiment": "prod-run-14",
    "tags": ["production"]
  },
  "items": [
    {
      "query": "What is the difference between RAG and Fine-tuning?",
      "response": "RAG combines document retrieval with an LLM...",
      "contexts": [
        "RAG is an architecture that combines retrieval components with an LLM generator.",
        "Fine-tuning involves continued training on a domain-specific dataset to modify model behavior."
      ],
      "ground_truth": "RAG uses external document retrieval to enrich answer context without changing model weights, whereas fine-tuning changes internal model parameters through retraining."
    },
    {
      "query": "How do I optimize API latency?",
      "response": "Use a smaller model and enable streaming.",
      "contexts": ["Groq API supports various models with different quality/speed trade-offs."],
      "ground_truth": null
    }
  ],
  "metrics": ["faithfulness", "answer_relevancy", "correctness", "tone_professionalism"]
}
```

**Response (202 Accepted):**
```json
{
  "run_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "status": "pending"
}
```

> **Note:** If `ground_truth` is `null`, the `correctness` metric is automatically skipped for that item. Metrics must be predefined or already created via `/metrics`.

---

#### `POST /evaluate/single` — Single Evaluation
Convenience endpoint for evaluating one item. Internally creates a batch of one.

**Request:**
```json
{
  "metadata": { "experiment": "quick-test" },
  "item": {
    "query": "What is FastAPI?",
    "response": "FastAPI is a modern web framework for Python.",
    "contexts": ["FastAPI is a high-performance Python web framework based on Starlette and Pydantic."],
    "ground_truth": "FastAPI is a modern, fast Python web framework based on Starlette and Pydantic."
  },
  "metrics": ["faithfulness", "answer_relevancy"]
}
```

**Response (202 Accepted):** Same format as batch.

---

#### `GET /evaluations` — List All Runs
Paginated list of evaluation runs for the tenant. Includes item count per run.

**Query Parameters:**
- `limit` (int, default 20, max 100)
- `offset` (int, default 0)
- `status` (optional filter: `pending`, `processing`, `completed`, `failed`)

**Response:**
```json
{
  "total": 145,
  "limit": 20,
  "offset": 0,
  "items": [
    {
      "run_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "status": "completed",
      "metadata": { "rag_system": "my-rag-v2", "experiment": "prod-run-14" },
      "item_count": 50,
      "created_at": "2026-05-14T15:30:00",
      "updated_at": "2026-05-14T15:35:22"
    }
  ]
}
```

---

#### `GET /evaluations/{run_id}` — Get Results
Retrieve full evaluation results with per-item scores and summary averages.

**Response:**
```json
{
  "run_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "status": "completed",
  "summary": {
    "faithfulness": 0.92,
    "answer_relevancy": 0.88,
    "correctness": 0.85
  },
  "items": [
    {
      "item_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "query": "What is the difference between RAG and Fine-tuning?",
      "response": "RAG combines document retrieval with an LLM...",
      "scores": {
        "faithfulness": {
          "value": 0.95,
          "details": {
            "score": 0.95,
            "reason": "Response fully supported by contexts.",
            "token_usage": { "prompt_tokens": 120, "completion_tokens": 45 }
          }
        },
        "answer_relevancy": {
          "value": 0.88,
          "details": { "score": 0.88, "reason": "Relevant but slightly verbose." }
        }
      }
    }
  ]
}
```

---

#### `POST /evaluations/compare` — Compare Runs
Compare average metric scores across multiple runs side-by-side.

**Request:**
```json
{
  "run_ids": [
    "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "d4e5f6a7-b8c9-0123-defa-234567890123"
  ]
}
```

**Response:**
```json
{
  "comparison": {
    "b2c3d4e5-f6a7-8901-bcde-f12345678901": {
      "status": "completed",
      "metadata": { "experiment": "baseline" },
      "scores": {
        "faithfulness": 0.92,
        "answer_relevancy": 0.88
      }
    },
    "d4e5f6a7-b8c9-0123-defa-234567890123": {
      "status": "completed",
      "metadata": { "experiment": "new-prompt-v2" },
      "scores": {
        "faithfulness": 0.95,
        "answer_relevancy": 0.91
      }
    }
  }
}
```

---

### Custom Metrics (Full CRUD)

#### `POST /metrics` — Create Custom Metric
Define a new metric with a Jinja2 prompt template.

**Request:**
```json
{
  "name": "tone_professionalism",
  "type": "custom",
  "config": {
    "prompt_template": "You are an Indonesian language evaluator. Evaluate the professionalism and politeness of the following answer.\n\nQuery: {{query}}\nResponse: {{response}}\n\nProvide a score from 0.0 to 1.0. Output only JSON: {\"score\": <float>, \"reason\": \"...\"}",
    "model": "llama3-70b-8192",
    "output_schema": { "score": "float", "reason": "string" },
    "temperature": 0.0
  }
}
```

**Response (201):**
```json
{
  "id": "e5f6a7b8-c9d0-1234-efab-345678901234",
  "name": "tone_professionalism",
  "type": "custom",
  "config": { ... },
  "created_at": "2026-05-14T10:00:00"
}
```

> **Available Jinja2 variables:** `{{query}}`, `{{response}}`, `{{contexts}}` (array), `{{ground_truth}}`.

---

#### `GET /metrics` — List Metrics
Returns all predefined and custom metrics for the tenant.

**Response:**
```json
[
  {
    "id": "...",
    "name": "faithfulness",
    "type": "predefined",
    "config": {},
    "created_at": "2026-05-01T00:00:00"
  },
  {
    "id": "...",
    "name": "tone_professionalism",
    "type": "custom",
    "config": { ... },
    "created_at": "2026-05-14T10:00:00"
  }
]
```

---

#### `PUT /metrics/{metric_id}` — Update Custom Metric
Modify prompt template, model, or output schema. **Predefined metrics are immutable (403 Forbidden).**

**Request:** Same body as `POST /metrics` (fields optional).

**Response:** Updated metric object.

---

#### `DELETE /metrics/{metric_id}` — Delete Custom Metric
**Protected:** Cannot delete if the metric has been used in any evaluation score (`409 Conflict`). Predefined metrics cannot be deleted (`403 Forbidden`).

**Response:** `204 No Content`

---

### Human Calibration (Judge Health Check)

#### `GET /human-reviews/sample` — Get Spot-Check Samples
Retrieve random evaluation items that have **not yet been human-reviewed**, prioritized for manual spot-checking.

**Query Parameters:**
- `run_id` (optional) — filter to a specific run
- `metric_name` (optional) — e.g., `faithfulness`
- `limit` (default 30)

**Response:**
```json
[
  {
    "item_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "query": "What is the difference between RAG and Fine-tuning?",
    "response": "RAG combines document retrieval with an LLM...",
    "contexts": [
      "RAG is an architecture that combines retrieval components...",
      "Fine-tuning involves continued training on a domain-specific dataset..."
    ],
    "ground_truth": "RAG uses external document retrieval to enrich answer context...",
    "metric_name": "faithfulness",
    "llm_score": 0.95,
    "llm_reason": "Response fully supported by contexts."
  }
]
```

> **Design rationale:** Items already reviewed are excluded to ensure statistical coverage across the dataset, not repeated opinions on the same item.

---

#### `POST /human-reviews` — Submit Human Judgment
A human reviewer submits their score for a specific item + metric pair. The system automatically snapshots the current LLM score and calculates the agreement delta.

**Request:**
```json
{
  "item_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "metric_id": "d4e5f6a7-b8c9-0123-defa-234567890123",
  "human_score": 0.70,
  "human_reason": "Answer echoes the word 'context' but the fact is wrong.",
  "reviewer_id": "alice@company.com"
}
```

**Response:**
```json
{
  "id": "f6a7b8c9-d0e1-2345-fabc-456789012345",
  "item_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "metric_name": "faithfulness",
  "human_score": 0.70,
  "llm_score": 0.95,
  "agreement_delta": -0.25,
  "reviewed_at": "2026-05-14T16:00:00"
}
```

> **Key insight:** `agreement_delta = human_score - llm_score`. Negative means the LLM is **over-scoring**.

---

#### `GET /calibration-report` — Judge Alignment Report
Statistical report comparing human judgments against LLM scores **per metric**. This is the "health check" for your LLM judge.

**Query Parameters:**
- `metric_name` (optional) — filter to one metric
- `min_samples` (default 20) — minimum human reviews before report is generated

**Response:**
```json
[
  {
    "metric_name": "faithfulness",
    "total_reviewed": 28,
    "mean_human_score": 0.72,
    "mean_llm_score": 0.89,
    "mean_absolute_error": 0.17,
    "correlation_pearson": 0.45,
    "bias_detected": true,
    "samples": [
      {
        "human": 0.30,
        "llm": 0.95,
        "delta": 0.65,
        "reason": "Answer echoes the word 'context' but the fact is wrong."
      }
    ]
  }
]
```

**How to read this:**
- **MAE 0.17** = On average, the LLM judge is off by **17 percentage points**.
- **Pearson 0.45** = Weak correlation. The LLM and human barely agree on what "good" looks like.
- **bias_detected: true** = MAE exceeds the 0.10 safety threshold. **Action required:** revise the prompt template or switch the judge model.

---

## Tech Stack

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| API Framework | **FastAPI** + Pydantic V2 | Async request handling, strict validation |
| Task Queue | **Celery** + **Redis** | Background LLM evaluation, retry logic |
| Database | **PostgreSQL** + **SQLAlchemy 2.0 Async** | Persistent storage, multi-tenant isolation |
| Migrations | **Alembic** | Schema versioning |
| LLM Engine | **Groq API** (Llama 3.1, Mixtral) | Low-latency inference for LLM-as-a-Judge |
| Prompting | **Jinja2** | Dynamic templating for custom metrics |
| Infrastructure | **Docker** + **Docker Compose** | Environment parity, horizontal worker scaling |

### Frontend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | **React 19** + **TypeScript** | Modern UI with type safety |
| Build Tool | **Vite 7** | Fast HMR and optimized builds |
| Styling | **Tailwind CSS 4** | Utility-first CSS framework |
| UI Components | **shadcn/ui** + **Radix UI** | Accessible, composable component library |
| Charts | **Recharts** | Data visualization for metrics and calibration |
| Forms | **React Hook Form** + **Zod** | Type-safe form validation |
| Icons | **Lucide React** | Consistent iconography |

---

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Groq API Key ([get one here](https://console.groq.com))

### 1. Environment Setup
```bash
cp backend/.env.example backend/.env
# Edit backend/.env and set GROQ_API_KEY=gsk_...
```

### 2. Launch Infrastructure
```bash
docker compose -f docker/docker-compose.yml --env-file backend/.env up --build -d
```

### 3. Initialize Database
```bash
docker compose -f docker/docker-compose.yml exec api alembic upgrade head
docker compose -f docker/docker-compose.yml exec api python -m app.seed
```

### 4. Verify
- API Docs: `http://localhost:8000/docs`
- Health Check: `curl http://localhost:8000/health`

---

## Running Without Docker

If you prefer to run the backend natively (no Docker, no Compose), this section walks through every dependency and command you need to replicate the container setup on your host machine.

### Prerequisites

| Tool | Recommended Version | Notes |
|------|---------------------|-------|
| Python | **3.11+** | Matches the image used by `Dockerfile.api` / `Dockerfile.worker` |
| PostgreSQL | **15+** | Must be running on `localhost:5432` with credentials usable by `DATABASE_URL` |
| Redis | **7+** | Must be running on `localhost:6379` |
| Groq API Key | — | Get one from [console.groq.com](https://console.groq.com) |

> **Tip:** If you already have Docker installed, you can still run Postgres + Redis via `docker compose -f docker/docker-compose.yml up db redis -d` and only run the API/worker natively. This is the easiest hybrid setup.

### 1. Create Local Postgres & Redis Databases

**PostgreSQL** (the project defaults assume `postgres` user with password `123`):

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Debian/Ubuntu
sudo apt install postgresql-15
sudo systemctl start postgresql

# Then set up the user, password, and database
psql -U postgres <<'SQL'
ALTER USER postgres WITH PASSWORD '123';
CREATE DATABASE rag_eval;
SQL
```

> On a fresh Debian/Ubuntu install the `postgres` role authenticates via `peer`, so run the heredoc through `sudo -u postgres psql <<'SQL' ... SQL` if you're not already in a session where peer auth is allowed. On macOS the `psql -U postgres` form above normally works out of the box.

> If your local Postgres uses a different user/password, just substitute them into the URL in step 4.

**Redis**:

```bash
# macOS
brew install redis
brew services start redis

# Debian/Ubuntu
sudo apt install redis-server
sudo systemctl start redis-server

# Foreground (any OS)
redis-server
```

### 2. Create a Python Virtual Environment

```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate            # Windows PowerShell: .\venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Then edit `backend/.env` so the `DATABASE_URL` / `DATABASE_URL_SYNC` point at your **local** Postgres and `REDIS_URL` at your **local** Redis:

```dotenv
ENVIRONMENT=development
DATABASE_URL=postgresql+asyncpg://postgres:123@localhost:5432/rag_eval
DATABASE_URL_SYNC=postgresql+psycopg2://postgres:123@localhost:5432/rag_eval
REDIS_URL=redis://localhost:6379/1
GROQ_API_KEY=gsk_your_key_here
LOG_LEVEL=INFO
LOG_FORMAT=text
```

> **Redis DB usage:** The FastAPI app and Celery workers currently share a single Redis database (defaulting to DB `1` via `REDIS_URL`) for both broker messaging and task result storage. Plain `redis-server` covers this perfectly. `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` are defined in `app/config.py` for future use but are not consumed by the worker yet.

### 4. Apply Database Migrations

`backend/alembic.ini` ships with a hardcoded `sqlalchemy.url` pointing at the Docker service hostname `db`. When running natively, **edit that line** so Alembic talks to your local Postgres:

1. Open `backend/alembic.ini` and find:
   ```ini
   sqlalchemy.url = postgresql://postgres:postgres@db:5432/rag_eval
   ```
2. Replace it with your local connection string, for example:
   ```ini
   sqlalchemy.url = postgresql://postgres:123@localhost:5432/rag_eval
   ```

Then run:

```bash
cd backend
alembic upgrade head
```

> Note: `alembic -x "sqlalchemy.url=..."` looks like a cleaner alternative, but the bundled `backend/alembic/env.py` reads the URL directly from `alembic.ini` and does not consume `-x` arguments, so the override would be silently dropped.

> If you later switch back to the Docker-based workflow, revert this change so `sqlalchemy.url` once again points at `db:5432` (the Compose service name). Otherwise `docker compose exec api alembic upgrade head` will try to talk to a `db` host that isn't running.

### 5. Seed the Default Tenant

```bash
cd backend
python -m app.seed
```

You should see logs that the `dev` tenant and the three predefined metrics (`faithfulness`, `answer_relevancy`, `correctness`) were created.

### 6. Start the API Server

Open **Terminal 1**:

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 7. Start the Celery Worker

Open **Terminal 2** (keep Terminal 1 running):

```bash
cd backend
source venv/bin/activate
celery -A app.tasks.evaluator worker --loglevel=info --concurrency=2
```

> The worker reads `REDIS_URL` from `.env` (defaults to db `1`) and uses it for **both** the Celery broker and the result backend.

### 8. Verify

- API Docs: `http://localhost:8000/docs`
- Health Check: `curl http://localhost:8000/health`
- Trigger a smoke test:
  ```bash
  curl -X POST http://localhost:8000/api/v1/tenants \
       -H "Content-Type: application/json" \
       -d '{"name":"smoke-test"}'
  ```

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `alembic` errors with `could not translate host name "db"` | `backend/alembic.ini` still has the Docker service hostname baked in | Update the `sqlalchemy.url` line per step 4 |
| `asyncpg.exceptions.InvalidPasswordError` | Postgres password doesn't match `.env` | Update `DATABASE_URL` / `DATABASE_URL_SYNC`, then restart the API |
| `celery` keeps disconnecting/losing tasks | Redis not running on `localhost:6379` | Start Redis (`brew services start redis` or `redis-server`) |
| `RuntimeError: Database connection failed on startup` (in production mode) | `ENVIRONMENT=production` rejects default credentials | Set `ENVIRONMENT=development` in `.env` for local work |
| Worker is silent when `POST /evaluate` is called | API and worker are reading different `.env`/Redis | Ensure Terminals 1 & 2 are both running from `backend/` with the same `.env` |

### Running Tests Locally

The test suite (`tests/`) is designed to be run **without Docker** — it expects PostgreSQL on `localhost:5432`:

```bash
cd backend
source venv/bin/activate
pytest
```

The session fixture in `tests/conftest.py` automatically creates and drops `rag_eval_test` against your local Postgres. Adjust `TEST_DB_URL_ASYNC` / `ADMIN_DB_URL_SYNC` there if your local credentials differ.

---

## Frontend Development

### Prerequisites
- Node.js 18+ and npm (or yarn/pnpm)
- Backend API running (see above)

### Setup
```bash
cd frontend
npm install
```

### Development Server
```bash
npm run dev
```
The dev server starts at `http://localhost:5173` with hot module replacement (HMR).

### API Proxy
Vite is configured to proxy `/api` requests to the backend. Update the target in `vite.config.ts` if your backend runs on a different URL.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run typecheck` | Run TypeScript type checking only |
| `npm run preview` | Preview production build locally |

### Frontend Pages

| Page | Description |
|------|-------------|
| **Overview** | Dashboard with key metrics, score trends, and model comparisons |
| **Evaluations** | List and detail views of evaluation runs with per-item scores |
| **Metrics** | Manage predefined and custom evaluation metrics |
| **Human Reviews** | Submit and review human judgments for calibration |
| **Calibration** | Statistical report comparing human vs LLM scores |
| **Settings** | Configure API key and tenant information |

### Frontend Architecture

- **State Management:** React Context (`ApiProvider`) for global API key and tenant state
- **API Client:** Typed fetch wrapper in `src/lib/api.ts` with error handling
- **Type Safety:** Shared TypeScript types in `src/lib/types.ts`
- **Styling:** Tailwind CSS with `cn()` utility for conditional class merging
- **Components:** shadcn/ui components in `src/components/ui/`

### Default Dev Credentials
- **Tenant:** `dev`
- **API Key:** `dev-api-key-12345` (pass via `X-API-Key` header)

---

## Running Tests

This project uses `pytest` and `pytest-asyncio` for testing. Tests are run locally against a dedicated PostgreSQL test database which is automatically created and dropped before and after the test session runs.

### Prerequisites
1. Ensure your local PostgreSQL server is running on `localhost:5432` with:
   - **Username**: `postgres`
   - **Password**: `123`
   
   > [!NOTE]
   > If your local PostgreSQL credentials differ, you can adjust the `TEST_DB_URL_ASYNC` and `ADMIN_DB_URL_SYNC` connection variables in [tests/conftest.py](file:///D:/coding/fast-api/rag-eval-harness/tests/conftest.py).
   
2. Make sure your virtual environment (`venv`) is activated and all dependencies in `requirements.txt` are installed.

### Running the Tests

1. Activate your virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (CMD):**
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   - **Linux / macOS:**
     ```bash
     source venv/bin/activate
     ```

2. Run `pytest`:
   ```bash
   pytest
   ```

---

## Engineering Decisions & Trade-offs

### 1. Why 202 Accepted + Polling instead of Webhooks?
The spec explicitly excluded webhooks. Polling via `GET /evaluations/{run_id}` is simpler for clients and avoids callback infrastructure complexity. For production scale, SSE streaming or webhook additions are trivial extensions.

### 2. Why PostgreSQL over a Vector DB?
This is an *evaluation* harness, not a retrieval system. Relational data (runs, items, scores, human reviews) benefits from ACID compliance and complex aggregations (comparisons, calibration reports).

### 3. Why Separate API and Worker Containers?
Independent scaling. During peak evaluation loads, you can scale `worker` replicas horizontally without touching the API layer. The API remains lightweight and responsive.

### 4. Why Immutable Predefined Metrics?
Predefined metrics (`faithfulness`, `answer_relevancy`, `correctness`) are seeded per tenant and protected from mutation/deletion. This preserves historical consistency — changing a metric definition retroactively invalidates past evaluation scores.

### 5. Why Human Calibration Is Per-Metric?
One evaluation item can be scored by multiple metrics. A human might agree with the LLM on faithfulness but strongly disagree on correctness. Aggregating per metric allows surgical diagnosis of which specific "judge" is broken.

### 6. Why Skip Already-Reviewed Items in Sampling?
Statistical validity. One item with 5 human labels is not 5 independent samples — it is 1 sample with 5 opinions. We prioritize coverage (many unique items reviewed once) over repetition.

---

> **Built with precision. Calibrated with trust.**
