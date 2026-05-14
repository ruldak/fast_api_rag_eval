# RAG Evaluation Harness

Layanan evaluasi standalone untuk sistem RAG menggunakan Groq LLM.

## Quick Start

1. Copy environment: `cp .env.example .env` dan isi `GROQ_API_KEY`
2. Jalankan: `docker-compose -f docker/docker-compose.yml up --build`
3. Migrasi: `docker-compose -f docker/docker-compose.yml exec api alembic upgrade head`
4. Seed: `docker-compose -f docker/docker-compose.yml exec api python -m app.seed`

## API Key Default
- Tenant: `dev`
- API Key: `dev-api-key-12345`

## Endpoints Utama

- `POST /api/v1/evaluate` – Batch evaluation
- `POST /api/v1/evaluate/single` – Single evaluation
- `GET /api/v1/evaluations/{run_id}` – Hasil evaluasi
- `POST /api/v1/evaluations/compare` – Perbandingan run
- `POST /api/v1/metrics` – Buat metrik kustom
- `POST /api/v1/tenants` – Register tenant baru

## Testing

```bash
pytest tests/ -v
```
---

## Instruksi Menjalankan

1. **Buat database** `rag_eval` dan `rag_eval_test` di PostgreSQL lokal (jika tidak pakai Docker).
2. **Install dependencies**: `pip install -r requirements.txt`
3. **Migrasi**: `alembic upgrade head`
4. **Seed**: `python -m app.seed`
5. **Jalankan API**: `uvicorn app.main:app --reload`
6. **Jalankan Worker**: `celery -A app.tasks.evaluator worker --loglevel=info`