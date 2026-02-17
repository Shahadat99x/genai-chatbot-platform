import os
import json
import redis
import uuid
from datetime import datetime

# Configuration
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
QUEUE_KEY = "intake:queue"

def get_redis_client():
    return redis.Redis.from_url(REDIS_URL, decode_responses=True)

def create_job(file_path: str, original_filename: str, options: dict) -> str:
    """Creates a job, saves initial state, and enqueues it."""
    r = get_redis_client()
    job_id = str(uuid.uuid4())
    
    job_data = {
        "id": job_id,
        "status": "queued",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "file_path": file_path,
        "original_filename": original_filename,
        "options": options,
        "progress": 0,
        "result": None,
        "error": None
    }
    
    # Save job state
    r.set(f"intake:job:{job_id}", json.dumps(job_data))
    
    # Enqueue
    r.lpush(QUEUE_KEY, job_id)
    
    return job_id

def get_job(job_id: str) -> dict | None:
    r = get_redis_client()
    data = r.get(f"intake:job:{job_id}")
    if data:
        return json.loads(data)
    return None

def update_job_status(job_id: str, status: str, progress: int = None, result: dict = None, error: str = None):
    r = get_redis_client()
    key = f"intake:job:{job_id}"
    data = r.get(key)
    if not data:
        return
    
    job = json.loads(data)
    job["status"] = status
    job["updated_at"] = datetime.utcnow().isoformat()
    if progress is not None:
        job["progress"] = progress
    if result is not None:
        job["result"] = result
    if error is not None:
        job["error"] = error
        
    r.set(key, json.dumps(job))
