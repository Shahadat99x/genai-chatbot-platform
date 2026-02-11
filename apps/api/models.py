from pydantic import BaseModel
from typing import List, Optional

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None # For Phase 3.2 Triage State
    mode: Optional[str] = "baseline" # "baseline", "rag", "rag_safety"

class Citation(BaseModel):
    id: str # Stable ID (filename#chunk)
    title: str
    org: str # Phase 4: Organization (NHS, WHO, etc)
    source_type: str
    last_updated: Optional[str] = None
    date_accessed: Optional[str] = None # Phase 4
    source_url: Optional[str] = None
    snippet: str
    full_text: Optional[str] = None

class ChatResponse(BaseModel):
    assistant_message: str
    urgency: str
    safety_flags: List[str]
    citations: List[Citation]
    recommendations: List[str]
    intent: Optional[str] = "medical_symptoms" # Phase 1
    lock_state: Optional[str] = "none" # Phase 1
    red_flag_detected: Optional[bool] = False # Phase 1
    local_resources: Optional[List[dict]] = None # Phase 2
    local_context: Optional[dict] = None # Phase 2
    triage_result: Optional[dict] = None # Phase 3
    response_kind: Optional[str] = "medical" # Phase 5: "chitchat", "medical", "lock", "logistics"
