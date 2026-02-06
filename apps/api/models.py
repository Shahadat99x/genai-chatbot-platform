from pydantic import BaseModel
from typing import List, Optional

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None # For Phase 3.2 Triage State
    mode: Optional[str] = "baseline" # "baseline", "rag", "rag_safety"

class Citation(BaseModel):
    title: str
    source_type: str
    last_updated: Optional[str] = None
    source_url: Optional[str] = None
    snippet: str
    full_text: Optional[str] = None

class ChatResponse(BaseModel):
    assistant_message: str
    urgency: str
    safety_flags: List[str]
    citations: List[Citation]
    recommendations: List[str]
