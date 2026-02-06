# RAG Corpus Documentation (Phase 3)

The Knowledge Base is a local collection of markdown files stored in `rag/corpus_raw/`.

## 1. Corpus Structure

Files are simple Markdown (`.md`) with a YAML frontmatter header.

### Example Format

```markdown
---
title: "Fever Management"
source_type: "medical_guideline"
last_updated: "2024-01-01"
source_url: "https://example.com"
---

# Content...
```

## 2. Included Documents

- `fever.md`: Home care and emergency signs for fever.
- `cough.md`: Management of coughs.
- `headache.md`: Types of headaches and red flags.
- `abdominal_pain.md`: When to worry about stomach pain.
- `sore_throat.md`: Relief and warning signs.
- `dehydration.md`: Symptoms and treatment.

## 3. Ingestion Pipeline

**Script**: `scripts/ingest_rag.py`

1. **Parses** YAML headers.
2. **Chunks** text (600 chars, 100 overlap).
3. **Embeds** using `sentence-transformers/all-MiniLM-L6-v2`.
4. **Indexes** into ChromaDB (`rag/index/chroma/`).

## 4. Retrieval

The API retrieves the top-4 most relevant chunks to ground the LLM response. Citations are returned to the frontend.
