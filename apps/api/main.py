# Load environment variables FIRST, before any other imports
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env files (apps/api/.env takes priority over root .env)
_api_env = Path(__file__).parent / ".env"
_root_env = Path(__file__).parent.parent.parent / ".env"

if _api_env.exists():
    load_dotenv(_api_env)
    print(f"[env] Loaded: {_api_env}")
elif _root_env.exists():
    load_dotenv(_root_env)
    print(f"[env] Loaded: {_root_env}")
else:
    print("[env] No .env file found")

# Debug log for OCR setup (safe - doesn't leak secrets)
print(f"[env] TESSERACT_CMD set: {bool(os.getenv('TESSERACT_CMD'))}")

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import models
import json
from services.ollama_client import ollama_client
from services.safety_service import safety_service
from services.rag_service import rag_service, RAGIndexMissingError, RAGRetrievalError
from services.intent_service import intent_service # Phase 1
from services.logistics_service import logistics_service # Phase 2
from services.triage_service import triage_service # Phase 3
from routes import intake
from routes import cv_samples
from store import sessions # Phase 5: Shared store
import datetime

app = FastAPI()
app.include_router(intake.router)
app.include_router(cv_samples.router)

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

# Phase 5: Export Endpoint
@app.post("/export/chat")
async def export_chat(request: Request):
    try:
        data = await request.json()
        session_id = data.get("session_id")
        if not session_id or session_id not in sessions:
             raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = sessions[session_id]
        
        # Save to disk as evidence
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"evidence_{timestamp}_{session_id}.json"
        
        # Ensure directory exists (relative to repo root)
        # apps/api -> apps -> root
        export_dir = Path(__file__).parent.parent.parent / "eval" / "evidence"
        export_dir.mkdir(parents=True, exist_ok=True)
        
        filepath = export_dir / filename
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(session_data, f, indent=2, default=str)
            
        return {
            "status": "exported",
            "file": str(filepath),
            "data": session_data
        }
    except Exception as e:
        print(f"Export Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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

@app.post("/chat", response_model=models.ChatResponse)
async def chat_endpoint(request: models.ChatRequest):
    try:
        # 1. Session Management
        session_id = request.session_id or "default"
        if session_id not in sessions:
            sessions[session_id] = {
                "lock_state": "none", 
                "last_triage": "self_care",
                "urgent_pending": False,
                "history": [] # Phase 5: Track history for export
            }
        
        session = sessions[session_id]
        
        # Append User Msg to History
        session["history"].append({"role": "user", "content": request.message, "timestamp": datetime.datetime.now().isoformat()})

        # 2. Intent Classification (Phase 1)
        # Always run intent classification first
        intent = intent_service.classify_intent(request.message)
        
        is_locked = session.get("lock_state") == "awaiting_confirmation"
        
        response_model = None

        if not is_locked and intent == "chitchat":
            response_model = models.ChatResponse(
                assistant_message="Hello! I am your AI healthcare assistant. How can I help you today?",
                urgency="self_care",
                safety_flags=[],
                citations=[],
                recommendations=[],
                intent="chitchat",
                response_kind="chitchat"
            )
            
        elif not is_locked and intent == "meta":
             response_model = models.ChatResponse(
                assistant_message=(
                    "I am an experimental AI healthcare assistant designed to provide safe triage advice based on medical guidelines. "
                    "I am NOT a doctor. My advice is for informational purposes only. "
                    "I prioritize safety and will refer you to emergency care if red-flag symptoms are detected."
                ),
                urgency="self_care",
                safety_flags=[],
                citations=[],
                recommendations=[],
                intent="meta",
                response_kind="meta"
            )
            
        elif not is_locked and intent == "logistics":
             resources, context = logistics_service.find_resources(request.message)
             
             if resources:
                 msg = "For medical emergencies, please call **112** immediately (Romania/Lithuania/EU). Here are some verified local resources:"
                 if context.get("sector"):
                     msg = f"Here are some medical resources in **Sector {context['sector']}** (Bucharest). For emergencies, call **112**."
             else:
                 msg = "I currently don't have verified information for that specific location in my local database. Please check official maps or call **112** if this is an emergency."
             
             response_model = models.ChatResponse(
                assistant_message=msg,
                urgency="self_care",
                safety_flags=[],
                citations=[],
                recommendations=[],
                intent="logistics",
                local_resources=resources,
                local_context=context,
                response_kind="logistics"
            )

        if response_model:
            session["history"].append({"role": "assistant", "content": response_model.assistant_message, "meta": response_model.dict(), "timestamp": datetime.datetime.now().isoformat()})
            return response_model

        # 3. Safety Evaluation (Phase 3.2 Triage + Phase 1 Lock)
        # BYPASS for "raw" modes (ablation testing) - but Phase 1 logic usually applies to standard usage
        if "_raw" not in request.mode:
            safety_eval = safety_service.evaluate_user_message(request.message, session)
            
            # If Action is NOT allow (Escalate, Refuse, Clarify) OR if we just unlocked
            if safety_eval.action != "allow" or "emergency_lock_cleared" in safety_eval.flags:
                # Phase 2: Attach Emergency Resources if Red Flag or Locked
                local_resources = None
                local_context = None
                
                if "red_flag_detected" in safety_eval.flags or session.get("lock_state") == "awaiting_confirmation":
                    # Get emergency hospitals
                    local_resources = logistics_service.get_emergency_hospitals(limit=3)
                    local_context = {"city": "Bucharest", "mode": "emergency"}

                response_model = models.ChatResponse(
                    assistant_message=safety_eval.message_override or "Safety violation.",
                    urgency=safety_eval.urgency,
                    safety_flags=safety_eval.flags,
                    citations=[],
                    recommendations=safety_eval.questions or [],
                    intent=intent,
                    lock_state=session.get("lock_state"),
                    red_flag_detected="red_flag_detected" in safety_eval.flags,
                    local_resources=local_resources,
                    local_context=local_context,
                    response_kind="emergency_lock" if safety_eval.urgency == "emergency" else "safety_interception"
                )
                session["history"].append({"role": "assistant", "content": response_model.assistant_message, "meta": response_model.dict(), "timestamp": datetime.datetime.now().isoformat()})
                return response_model

        # 3. Allow - Handle RAG vs Baseline with Triage (Phase 3)
        
        # Initialize RAG (Lazy load)
        if "rag" in request.mode: # Handle rag, rag_safety, rag_raw
             rag_service.initialize() # Safe to call multiple times

        # PHASE 3: Run Triage Service
        triage_result = triage_service.triage(request.message)
        final_urgency = triage_result["urgency"]
        
        # If Safety Service detected RED FLAGS, override urgency to EMERGENCY
        if safety_eval.urgency == "emergency":
            final_urgency = "emergency"
            triage_result["urgency"] = "emergency"
            triage_result["reason"] = "Red flags detected by Safety Service."

        retrieved_context = ""
        citations = []
        citations_used = False # Grounding Flag
        
        # Decision: Should we run RAG?
        # If urgency is UNKNOWN, skip RAG -> ask clarifying questions
        # Phase 4: Pass symptom tags to retrieval for expansion
        
        if final_urgency != "unknown" and "rag" in request.mode:
            try:
                # Phase 4: Retrieve with tags + re-ranking
                retrieved_items = rag_service.retrieve(
                    query=request.message, 
                    symptom_tags=triage_result["symptom_tags"],
                    k=8 # Fetch more candidates for re-ranking
                )
                
                # Filter low relevance logic (if needed)
                if retrieved_items:
                    citations = retrieved_items
                    citations_used = True
                    # Formatting context for LLM
                    # Phase 4: Include ID and Org in context
                    context_list = []
                    for i, item in enumerate(retrieved_items):
                        # Use simple numeric ID for citation mapping
                        cid_num = i + 1
                        org = item.get("org", "Unknown")
                        text = item.get("full_text", "")
                        # Store numeric index in item for frontend if possible, but mainly needed for context
                        context_list.append(f"Source [{cid_num}] ({org}): {text}")
                        
                    context_str = "\n".join(context_list)
                    retrieved_context = f"\n\nCONTEXT FROM TRUSTED MEDICAL GUIDELINES:\n{context_str}\n\n"
                else:
                    retrieved_context = "\n\nCONTEXT: No relevant medical guidelines found locally.\n\n"
                    citations_used = False
            except Exception as e:
                print(f"RAG Error: {e}")
                retrieved_context = "\n\nCONTEXT: Error retrieving local guidelines.\n\n"

        # Construct messages for Ollama
        system_content = (
            "You are a helpful medical triage assistant. Provide clear, safe advice based on the provided TRUSTED SOURCES. "
            "Do not replace professional care. If urgent, advise calling emergency services. "
            "NEVER provide a diagnosis. NEVER provide medication dosages (mg/frequency). "
        )
        
        # Message Construction based on Triage
        final_message = ""
        
        # CASE A: Unknown Urgency -> Ask Questions
        if final_urgency == "unknown":
            final_message = (
                "I'm not sure I understand your symptoms clearly enough to provide specific advice. "
                "Could you please clarify?\n\n"
            )
            if triage_result["follow_up_questions"]:
                final_message += "Quick questions:\n" + "\n".join([f"- {q}" for q in triage_result["follow_up_questions"]])
            
            response_model = models.ChatResponse(
                assistant_message=final_message,
                urgency="unknown",
                safety_flags=safety_eval.flags,
                citations=[],
                recommendations=triage_result["follow_up_questions"],
                intent=intent,
                lock_state=session.get("lock_state"),
                red_flag_detected="red_flag_detected" in safety_eval.flags,
                triage_result=triage_result,
                response_kind="medical_clarification"
            )
            session["history"].append({"role": "assistant", "content": response_model.assistant_message, "meta": response_model.dict(), "timestamp": datetime.datetime.now().isoformat()})
            return response_model

        # CASE B: Known Urgency -> Generate Advice with Grounding Check
        
        if retrieved_context:
            system_content += f"{retrieved_context}"
            
            if citations_used:
                system_content += (
                    "INSTRUCTIONS: Use ONLY the provided trusted sources to answer the user's question. "
                    "Cite the sources using their numeric IDs (e.g. [1], [2]) in your response where appropriate. "
                    "DO NOT use filenames or chunk IDs. ONLY use [1], [2], etc. "
                    "If the sources do not cover the user's specific symptoms, state that you cannot find specific guidelines. "
                    "Structure your answer:\n"
                    "1. Brief Summary\n"
                    "2. General Triage Advice (strictly based on sources)\n"
                    "3. When to see a doctor\n"
                    f"URGENCY ASSESSMENT: {final_urgency.upper()}.\n" 
                )
            else:
                 # Grounding Failure: No sources found
                 system_content += (
                     "INSTRUCTIONS: No relevant local medical guidelines were found. "
                     "State clearly that you cannot provide specific medical advice without sources. "
                     "Provide mostly general safety tips and ask the user to consult a doctor. "
                     "Do NOT hallucinate medical facts."
                 )
        
        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": request.message}
        ]
        
        # Call Ollama
        response_content = await ollama_client.generate_response(messages)
        
        # Append Disclaimer
        if "_raw" not in request.mode:
            disclaimer = "\n\nI’m not a doctor. If symptoms worsen or you have serious concerns, seek medical care."
            final_message = response_content + disclaimer
        else:
            final_message = response_content
        
        # Return structured response
        response_model = models.ChatResponse(
            assistant_message=final_message,
            urgency=final_urgency, 
            safety_flags=safety_eval.flags, 
            # Phase 4: Pass structured citations
            citations=citations if citations_used else [],
            recommendations=triage_result["follow_up_questions"],
            intent=intent,
            lock_state=session.get("lock_state"),
            red_flag_detected="red_flag_detected" in safety_eval.flags if "_raw" not in request.mode else False,
            triage_result=triage_result,
            response_kind="medical_advice"
        )
        session["history"].append({"role": "assistant", "content": response_model.assistant_message, "meta": response_model.dict(), "timestamp": datetime.datetime.now().isoformat()})
        return response_model
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
