
import chromadb
from sentence_transformers import SentenceTransformer
import os
import pathlib

# Configuration
# Compute Repo Root robustly: this file is in apps/api/services/rag_service.py
# Root is 3 levels up: apps/api/services -> apps/api -> apps -> root
FILE_DIR = pathlib.Path(__file__).parent.resolve()
REPO_ROOT = FILE_DIR.parent.parent.parent
INDEX_PATH = str(REPO_ROOT / "rag" / "index" / "chroma")
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

class RAGIndexMissingError(Exception):
    pass

class RAGRetrievalError(Exception):
    pass

class RAGService:
    def __init__(self):
        self.client = None
        self.collection = None
        self.embedder = None
        self.initialized = False
        self.index_path = INDEX_PATH

    def initialize(self):
        if self.initialized:
            return
        
        print(f"Initializing RAG Service... Index Path: {self.index_path}")
        try:
            if not os.path.exists(self.index_path) or not os.listdir(self.index_path):
                print(f"RAG Index not found at {self.index_path}")
                # We don't raise here, we just remain uninitialized
                # retrieve() will check this and raise specific error
                return

            self.client = chromadb.PersistentClient(path=self.index_path)
            self.collection = self.client.get_collection(name="medical_docs")
            
            print("Loading Embedding Model...")
            self.embedder = SentenceTransformer(EMBEDDING_MODEL)
            self.initialized = True
            print("RAG Service Initialized Successfully.")
        except Exception as e:
            print(f"Failed to initialize RAG Service: {e}")
            # If initialization fails (e.g. lock file), we remain uninitialized

    def check_health(self):
        """Returns True if initialized and functional."""
        return self.initialized

    def retrieve(self, query: str, k: int = 4):
        # 1. Check Index Existence
        if not self.initialized:
            # Try to init one last time
            self.initialize()
            if not self.initialized:
                # If still not initialized, it's missing or broken
                if not os.path.exists(self.index_path):
                     raise RAGIndexMissingError("RAG index not found. Run: python scripts/ingest_rag.py")
                else:
                     raise RAGRetrievalError("RAG service failed to initialize (possibly locked or corrupted).")
        
        try:
            # Embed query
            query_embed = self.embedder.encode(query).tolist()
            
            # Query Chroma
            results = self.collection.query(
                query_embeddings=[query_embed],
                n_results=k
            )
            
            # Format results
            formatted_results = []
            
            if not results["ids"]:
                return []

            count = len(results["ids"][0])
            for i in range(count):
                item = {
                    "id": results["ids"][0][i],
                    "text": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                }
                
                citation = {
                    "title": item["metadata"].get("title", "Unknown Source"),
                    "source_type": item["metadata"].get("source_type", "Reference"),
                    "last_updated": item["metadata"].get("last_updated", "N/A"),
                    "source_url": item["metadata"].get("source_url", ""),
                    "snippet": item["text"][:200] + "...",
                    "full_text": item["text"]
                }
                formatted_results.append(citation)
                
            return formatted_results

        except Exception as e:
            print(f"Retrieval error: {e}")
            raise RAGRetrievalError(str(e))

rag_service = RAGService()
