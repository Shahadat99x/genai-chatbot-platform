# Healthcare Assistant AI

Local-first triage assistant (Next.js + FastAPI + RAG + Safety + Evaluation).

## Phase 0: Foundation

The current version implements the shell for Phase 0.

### Directory Structure

- `apps/web`: Next.js frontend
- `apps/api`: FastAPI backend
- `docs`: Project documentation
- `rag`, `data`, `scripts`, `eval`: Placeholders for future phases

### HOW TO RUN (Easy Mode)

Run the helper script from the root:

```powershell
./dev.ps1
```

### HOW TO RUN (Manual Mode)

#### 1. API (Backend)

```bash
cd apps/api
# Install dependencies
pip install -r requirements.txt
# Run server
uvicorn main:app --reload
```

Expected output at: `http://localhost:8000/health`

#### 2. Web (Frontend)

```bash
cd apps/web
# Install dependencies
npm install
# Run dev server
npm run dev
```

Expected output at: `http://localhost:3000`

### Features (Phase 0)

- **Health Check**: `GET /health` on API.
- **Stubbed Chat**: `POST /chat` returns a static mock response.
- **Chat UI**: Basic chat interface connecting to the API.

### Notes

- This phase does NOT include Ollama, RAG, or Safety filters yet.
- All responses are stubbed.
