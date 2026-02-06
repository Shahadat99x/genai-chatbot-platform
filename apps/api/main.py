from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import models
import json
import os
from services.ollama_client import ollama_client
from services.safety_service import safety_service
from services.rag_service import rag_service, RAGIndexMissingError, RAGRetrievalError

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Standardized Error Handling
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "HTTP_ERROR", "message": exc.detail}},
    )

@app.get("/health")
async def read_health():
    ollama_status = await ollama_client.check_health()
    rag_status = rag_service.check_health()
    return {
        "status": "ok", 
        "service": "api",
        "ollama_connected": ollama_status,
        "rag_index_loaded": rag_status
    }

@app.get("/debug/directory/preview")
async def debug_directory_preview(limit: int = 5):
    """Debug endpoint to preview processed directory data."""
    # Resolve path relative to repo root (2 levels up from apps/api)
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    file_path = os.path.join(base_dir, "data", "processed", "facilities.cleaned.jsonl")
    
    if not os.path.exists(file_path):
         return JSONResponse(
            status_code=404,
            content={"error": {"code": "DATA_MISSING", "message": f"Processed data not found at {file_path}. Run 'python scripts/validate_directory.py' first."}}
        )
    
    results = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                if i >= limit:
                    break
                if line.strip():
                     results.append(json.loads(line))
        return {"count": len(results), "preview": results}
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to read data: {str(e)}")

# In-memory session store (resets on restart)
sessions = {}

@app.post("/chat", response_model=models.ChatResponse)
async def chat_endpoint(request: models.ChatRequest):
    try:
        # 1. Session Management
        session_id = request.session_id or "default"
        if session_id not in sessions:
            sessions[session_id] = {
                "emergency_lock": False,
                "last_triage": "self_care",
                "urgent_pending": False
            }
        
        session = sessions[session_id]

        # 2. Safety Evaluation (Phase 3.2 Triage)
        # BYPASS for "raw" modes (ablation testing)
        if "_raw" not in request.mode:
            safety_eval = safety_service.evaluate_user_message(request.message, session)
            
            # If Action is NOT allow (Escalate, Refuse, Clarify)
            if safety_eval.action != "allow" and safety_eval.message_override:
                return models.ChatResponse(
                    assistant_message=safety_eval.message_override,
                    urgency=safety_eval.urgency,
                    safety_flags=safety_eval.flags,
                    citations=[],
                    recommendations=safety_eval.questions or []
                )

        # 3. Allow - Handle RAG vs Baseline
        
        # Initialize RAG (Lazy load)
        if "rag" in request.mode: # Handle rag, rag_safety, rag_raw
             rag_service.initialize() # Safe to call multiple times

        retrieved_context = ""
        citations = []
        
        if "rag" in request.mode:
            # Retrieve
            retrieved_items = rag_service.retrieve(request.message, k=4)
            citations = retrieved_items
            
            # Format Context
            if retrieved_items:
                context_str = "\n".join([f"[{i+1}] {item['full_text']}" for i, item in enumerate(retrieved_items)])
                retrieved_context = f"\n\nCONTEXT FROM MEDICAL GUIDELINES:\n{context_str}\n\n"
            else:
                retrieved_context = "\n\nCONTEXT: No relevant medical guidelines found locally.\n\n"

        # Construct messages for Ollama
        system_content = (
            "You are a helpful medical triage assistant. Provide clear, safe advice. "
            "Do not replace professional care. If urgent, advise calling emergency services."
        )
        
        if retrieved_context:
            system_content += (
                f"{retrieved_context}"
                "INSTRUCTIONS: Use the provided CONTEXT to answer the user's question. "
                "Cite the context using [1], [2] etc. where appropriate. "
                "If the context doesn't answer the question, say so, but you may provide general general safety advice foundation knowledge if safe."
            )

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": request.message}
        ]
        
        # Call Ollama
        response_content = await ollama_client.generate_response(messages)
        
        # Append Disclaimer (only for safer modes)
        if "_raw" not in request.mode:
            disclaimer = "\n\nI’m not a doctor. If symptoms worsen or you have serious concerns, seek medical care."
            final_message = response_content + disclaimer
        else:
            final_message = response_content

        # Resolve urgency/flags for raw modes
        final_urgency = "self_care"
        final_flags = []
        if "_raw" not in request.mode:
            final_urgency = safety_eval.urgency
            final_flags = safety_eval.flags
        
        # Return structured response
        return models.ChatResponse(
            assistant_message=final_message,
            urgency=final_urgency, 
            safety_flags=final_flags, 
            citations=citations,
            recommendations=[]
        )
    except (RAGIndexMissingError, RAGRetrievalError) as e:
        # RAG specific errors -> 503
        error_code = "INDEX_MISSING" if isinstance(e, RAGIndexMissingError) else "RAG_ERROR"
        return JSONResponse(
            status_code=503,
            content={"error": {"code": error_code, "message": str(e)}}
        )
    except RuntimeError as e:
        # Ollama connection error - Standardized Error
        return JSONResponse(
            status_code=503, 
            content={"error": {"code": "MODEL_UNAVAILABLE", "message": str(e)}}
        )
    except Exception as e:
        return JSONResponse(
             status_code=500,
             content={"error": {"code": "INTERNAL_ERROR", "message": str(e)}}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
