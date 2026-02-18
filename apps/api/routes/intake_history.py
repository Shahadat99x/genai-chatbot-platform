from fastapi import APIRouter, HTTPException
from ..services.supabase_client import get_supabase_client
from typing import List
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class IntakeJobSummary(BaseModel):
    id: str
    filename: str
    status: str
    score_int: int
    approval_state: str
    created_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

@router.get("/intake/history", response_model=List[IntakeJobSummary])
async def get_intake_history(limit: int = 50):
    sb = get_supabase_client()
    if not sb:
        # Fallback or empty if DB not configured (dev mode without secrets)
        return []

    try:
        # Join intake_jobs with documents
        # Supabase-py syntax for joins can be tricky. 
        # Easier to fetch intake_jobs and select document:filename.
        # select('*, documents(filename)')
        
        response = sb.table("intake_jobs")\
            .select("id, status, score_int, approval_state, created_at, documents(filename)")\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()
            
        data = response.data
        
        # Flatten/Map
        results = []
        for row in data:
            doc = row.get("documents")
            filename = doc.get("filename") if doc else "unknown"
            
            results.append({
                "id": row["id"],
                "filename": filename,
                "status": row["status"],
                "score_int": row["score_int"] or 0,
                "approval_state": row["approval_state"] or "needs_review",
                "created_at": row["created_at"]
            })
            
        return results

    except Exception as e:
        print(f"History fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
