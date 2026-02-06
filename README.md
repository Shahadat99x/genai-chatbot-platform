# Healthcare Assistant AI

Local-first triage assistant (Next.js + FastAPI + RAG + Safety + Evaluation).

## Overview

A robust healthcare chatbot demonstrating:

1.  **Baseline**: Standard Ollama LLM integration.
2.  **RAG**: Retrieval-Augmented Generation using a local ChromaDB corpus.
3.  **Safety & Triage**:
    - Emergency Lock for critical symptoms (e.g., stroke).
    - Urgent Clarifiers for vague symptoms.
    - Refusal of medication dosing/diagnosis.
4.  **Evaluation**: Reproducible framework to compare these modes.

## Tech Stack

- **Frontend**: Next.js 15, TailwindCSS (App Router)
- **Backend**: FastAPI, Uvicorn
- **AI/ML**: Ollama (LLM), SentenceTransformers (Embeddings), ChromaDB (Vector Store)

## Quick Start

### 1. Requirements

- Node.js 18+
- Python 3.10+
- Ollama running locally (serve `llama3` or similar)

### 2. Run Application (Dev Mode)

Use the helper script to launch both API and Web:

```powershell
./dev.ps1
```

- Web: http://localhost:3000
- API: http://127.0.0.1:8000

---

## 3. RAG System (Phase 3)

The system uses a local medical corpus (Markdown files in `rag/corpus_raw`).

**Ingest Data:**

```bash
python scripts/ingest_rag.py
```

This chunks, embeds, and indexes the documents into `rag/index/chroma`.

---

## 4. Evaluation (Phase 4)

We provide a comprehensive evaluation suite to compare `Baseline` (Ollama only), `RAG` (Retrieval only), and `RAG + Safety` (Full System).

**Run the Full Evaluation:**

```powershell
./scripts/run_all_eval.ps1
```

This will:

1. Run 80+ prompts against all 3 modes.
2. Generate JSONL logs in `eval/results/<timestamp>/`.
3. Produce a `summary.md` and `summary.csv` with Safety and Grounding metrics.

**Manual Steps:**

```bash
# 1. Run inference
python scripts/run_eval.py

# 2. Summarize results
python scripts/summarize_eval.py --run eval/results/<timestamp>
```

**Metrics Calculated:**

- Emergency Recall Rate
- Refusal Compliance Rate
- Citation Coverage
- Latency Stats
