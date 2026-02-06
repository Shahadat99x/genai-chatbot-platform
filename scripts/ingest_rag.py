
import os
import glob
import shutil
import pathlib
import time
import chromadb
from sentence_transformers import SentenceTransformer

# Config - Robust Absolute Paths
# scripts/ingest_rag.py -> scripts -> root
FILE_DIR = pathlib.Path(__file__).parent.resolve()
REPO_ROOT = FILE_DIR.parent
CORPUS_DIR = REPO_ROOT / "rag" / "corpus_raw"
INDEX_DIR = REPO_ROOT / "rag" / "index" / "chroma"

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
CHUNK_SIZE = 600
CHUNK_OVERLAP = 100

def parse_metadata(content):
    """Simple YAML frontmatter parser."""
    meta = {}
    if content.startswith("---"):
        try:
            parts = content.split("---", 2)
            if len(parts) >= 3:
                yaml_block = parts[1]
                body = parts[2].strip()
                for line in yaml_block.strip().split("\n"):
                    if ":" in line:
                        key, val = line.split(":", 1)
                        meta[key.strip()] = val.strip().strip('"')
                return meta, body
        except Exception as e:
            print(f"Metadata parse error: {e}")
    return {}, content

def chunk_text(text, size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunk = text[start:end]
        chunks.append(chunk)
        start += (size - overlap)
    return chunks

def remove_readonly(func, path, excinfo):
    """Helper to remove read-only files on Windows."""
    os.chmod(path, 0o777)
    func(path)

def safe_recreate_index(index_path):
    """Safely removes and recreates the index directory."""
    path = pathlib.Path(index_path)
    if not path.exists():
        return

    print(f"Removing old index at {path}...")
    try:
        shutil.rmtree(path, onerror=remove_readonly)
    except PermissionError:
        print("\n" + "!" * 50)
        print("ERROR: File Permission Denied.")
        print("Could not delete the existing RAG index.")
        print("Detailed Error: The folder 'rag/index/chroma' is being used by another process.")
        print("ACTION REQUIRED: Stop the running API server (Ctrl+C in your other terminal) and try again.")
        print("!" * 50 + "\n")
        exit(1)
    except Exception as e:
        print(f"Error removing old index: {e}")
        exit(1)

    # Small sleep to let OS release locks
    time.sleep(1)

def main():
    print("--- Starting RAG Ingestion ---")
    print(f"Repo Root: {REPO_ROOT}")
    print(f"Corpus Dir: {CORPUS_DIR}")
    print(f"Index Dir: {INDEX_DIR}")
    
    # 1. Initialize Clients
    print(f"Loading embedding model: {EMBEDDING_MODEL}")
    embedder = SentenceTransformer(EMBEDDING_MODEL)
    
    # Clean recreate index
    safe_recreate_index(INDEX_DIR)
    
    print(f"Creating Chroma client at {INDEX_DIR}")
    client = chromadb.PersistentClient(path=str(INDEX_DIR))
    collection = client.create_collection(name="medical_docs")

    # 2. Process Files
    # Use glob on the Path object
    docs = list(CORPUS_DIR.glob("*.md"))
    print(f"Found {len(docs)} documents in {CORPUS_DIR}")

    total_chunks = 0
    ids_batch = []
    embeddings_batch = []
    metadatas_batch = []
    documents_batch = []

    for file_path in docs:
        filename = file_path.name
        print(f"Processing {filename}...")
        
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        meta, body = parse_metadata(content)
        # Fallback metadata
        meta["doc_id"] = filename
        if "title" not in meta: meta["title"] = filename
        if "source_type" not in meta: meta["source_type"] = "local_file"
        
        chunks = chunk_text(body)
        
        for i, chunk in enumerate(chunks):
            chunk_id = f"{filename}#chunk_{i}"
            
            # Prepare batch
            ids_batch.append(chunk_id)
            documents_batch.append(chunk)
            metadatas_batch.append(meta)
            
            vector = embedder.encode(chunk).tolist()
            embeddings_batch.append(vector)
            
            total_chunks += 1

    # 3. Upsert to Chroma
    if ids_batch:
        print(f"Upserting {len(ids_batch)} chunks to Chroma...")
        collection.add(
            ids=ids_batch,
            embeddings=embeddings_batch,
            metadatas=metadatas_batch,
            documents=documents_batch
        )

    print(f"--- Ingestion Complete. Total Chunks: {total_chunks} ---")

if __name__ == "__main__":
    main()
