# RUNBOOK — Healthcare Assistant AI

Operational runbook for running, verifying, and troubleshooting the system.

---

## Start (Docker Compose — recommended)

```bash
# Ensure Docker Desktop is running, then:
docker compose up --build

# With Ollama inside Docker:
docker compose --profile ollama up --build
docker compose exec ollama ollama pull qwen2.5:7b-instruct
```

| Service  | URL                          |
| -------- | ---------------------------- |
| Web      | http://localhost:3000        |
| API      | http://localhost:8000        |
| API Docs | http://localhost:8000/docs   |
| Status   | http://localhost:3000/status |

## Start (Manual — without Docker)

```powershell
# Terminal 1: API
cd apps/api
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2: Web
cd apps/web
npm run dev
```

> Requires: Python 3.10+, Node.js 18+, Ollama running locally.

---

## Rebuild Images

```bash
docker compose build --no-cache
docker compose up
```

---

## 4. Supabase (Phase 5A)

### Setup

1. Create a Supabase project.
2. Get `Project URL` and `service_role` secret (Project Settings > API).
3. Set env vars:
   ```bash
   SUPABASE_URL=your_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
4. Run SQL Schema:
   - Copy content of `infra/sql/phase5a.sql`
   - Run in Supabase SQL Editor

## 5. Verification Commands

```bash
# Liveness (process alive)
curl http://localhost:8000/health
# → {"status":"ok","service":"api",...}

# Readiness (all subsystems)
curl http://localhost:8000/ready
# → {"status":"ready","checks":{"ollama":{"ok":true,...},...}}

# Web pages
curl -I http://localhost:3000/chat     # → 200
curl -I http://localhost:3000/intake   # → 200
curl -I http://localhost:3000/status   # → 200
```

---

## Troubleshooting

| Symptom                                   | Likely Cause                             | Fix                                                                                                           |
| ----------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `//./pipe/dockerDesktopLinuxEngine` error | Docker Desktop not running               | Start Docker Desktop, wait for green whale icon                                                               |
| Port 3000 in use                          | Local dev server still running           | Stop it (`Ctrl+C`) or change port in `docker-compose.yml`                                                     |
| Port 8000 in use                          | Local API server still running           | Stop it or remap port                                                                                         |
| Port 11434 in use                         | Host Ollama already running              | OK if using host Ollama; stop it if using compose profile                                                     |
| `/ready` → `ollama: ok: false`            | Ollama not running or unreachable        | Start Ollama on host, or use `--profile ollama`                                                               |
| `/ready` → `rag_index: ok: false`         | RAG index not built                      | Run `python scripts/ingest_rag.py` on host                                                                    |
| `/ready` → `ocr: ok: false`               | Tesseract not installed                  | In Docker: auto-installed. On host: install from [UB-Mannheim](https://github.com/UB-Mannheim/tesseract/wiki) |
| Chat returns `MODEL_UNAVAILABLE`          | Ollama running but model not pulled      | Run `ollama pull qwen2.5:7b-instruct`                                                                         |
| Web hot-reload not working                | Windows file watcher issue               | `WATCHPACK_POLLING=true` is set in compose. Restart container                                                 |
| First build very slow (~10 min)           | Large pip packages (torch, transformers) | Normal. Layer cache speeds subsequent builds                                                                  |
| CORS errors in browser console            | API CORS_ORIGINS missing origin          | Add origin to `CORS_ORIGINS` env in `docker-compose.yml`                                                      |

---

## Endpoints Reference

| Method | Path               | Purpose                                                   |
| ------ | ------------------ | --------------------------------------------------------- |
| GET    | `/health`          | Liveness probe (always 200 if process alive)              |
| GET    | `/ready`           | Readiness probe (200 if all subsystems OK, 503 otherwise) |
| GET    | `/docs`            | Swagger UI                                                |
| POST   | `/chat`            | Main chat endpoint                                        |
| POST   | `/intake/document` | CV/document upload                                        |
| GET    | `/status`          | Web status dashboard                                      |
