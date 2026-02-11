
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

    def retrieve(self, query: str, symptom_tags: list = None, k: int = 8):
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
            # Phase 4: Query Expansion
            # Append symptom tags to query for better semantic matching
            expanded_query = query
            if symptom_tags:
                tags_str = " ".join(symptom_tags)
                expanded_query = f"{query} {tags_str}"
                # Deterministic expansion for common symptoms
                if "fever" in symptom_tags or "temperature" in query.lower():
                    expanded_query += " temperature duration red flags"
                if "cough" in symptom_tags:
                    expanded_query += " shortness of breath chest pain duration"
            
            print(f"[RAG] Expanded Query: {expanded_query}")

            # Embed query
            query_embed = self.embedder.encode(expanded_query).tolist()
            
            # Query Chroma (Include distances for relevance check)
            results = self.collection.query(
                query_embeddings=[query_embed],
                n_results=k,
                include=["documents", "metadatas", "distances"]
            )
            
            if not results["ids"] or not results["ids"][0]:
                return []

            # Phase 4: Scoring & Filtering
            scored_results = []
            
            count = len(results["ids"][0])
            for i in range(count):
                meta = results["metadatas"][0][i]
                doc_id = results["ids"][0][i]
                text = results["documents"][0][i]
                dist = results["distances"][0][i] # L2 distance
                
                # RELEVANCE FILTER (Threshold 1.28)
                # "Fever" query -> distance ~0.74 (Relevant)
                # "Headache" -> distance ~1.16
                # "Rash" query -> distance ~1.29 (Irrelevant/Hallucination)
                if dist > 1.28:
                    continue
                
                # Synthetic Score for Sorting (Combine distance + boosts)
                # Base score = 2.0 - dist (Higher is better)
                score = 2.0 - dist
                
                # Boost for Trusted Org
                org = meta.get("org", "Unknown")
                if org in ["NHS", "WHO", "CDC", "NICE"]:
                    score += 0.5
                
                # Boost for tag overlap
                doc_tags = meta.get("tags", "").split(",")
                if symptom_tags:
                    for tag in symptom_tags:
                        if tag in doc_tags:
                            score += 0.3
                            
                scored_results.append({
                    "id": doc_id,
                    "text": text,
                    "metadata": meta,
                    "score": score,
                    "dist": dist
                })
            
            # Sort by new score descending
            scored_results.sort(key=lambda x: x["score"], reverse=True)
            
            # Take top N (e.g. 5)
            final_results = scored_results[:5]

            # Format results
            formatted_results = []
            for item in final_results:
                citation = {
                    "id": item["id"],
                    "title": item["metadata"].get("title", "Unknown Source"),
                    "org": item["metadata"].get("org", "Unknown"),
                    "source_type": item["metadata"].get("doc_type", "reference"),
                    "date_accessed": item["metadata"].get("date_accessed", "N/A"),
                    "source_url": item["metadata"].get("url", ""),
                    "snippet": item["text"][:240] + "...", # Limit snippet length
                    "full_text": item["text"]
                }
                formatted_results.append(citation)
                
            return formatted_results

        except Exception as e:
            print(f"Retrieval error: {e}")
            raise RAGRetrievalError(str(e))

rag_service = RAGService()
