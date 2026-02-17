import os
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from ..services import redis_client
import json

router = APIRouter()

UPLOAD_DIR = "/app/data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/intake/jobs")
async def create_intake_job(
    file: UploadFile = File(...),
    ocr_engine: str = Form("tesseract"),
    ocr_mode: str = Form("enhanced"),
    corners_override: str = Form(None),
    run_ablation: bool = Form(True),
    include_debug_overlays: bool = Form(False)
):
    # Validation (minimal)
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG/PNG allowed.")
    
    # Parse corners just to validate JSON format early
    if corners_override:
        try:
            parsed = json.loads(corners_override)
            if not isinstance(parsed, list) or len(parsed) != 4:
                raise HTTPException(status_code=400, detail="corners_override must be list of 4 points")
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON in corners_override")

    # Save file to shared volume
    # Use a temp logic: /app/data/uploads/{uuid}.{ext}
    # But we don't have UUID yet. Let's create job first? 
    # Actually create_job generates UUID. Let's generate it here or pass it?
    # redis_client.create_job generates it. 
    # Let's verify file size first.
    
    # We need to read file to save it.
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10MB).")
    
    # Create Job ID via Redis Client
    # We need to save file first so we can pass path to job
    # But we want ID for filename. 
    # Let's modify redis_client to accept ID? Or just generate one here.
    # Simpler: Generate ID here, reuse in saving, then pass to create_job?
    # But create_job generates it internally. 
    # Let's use a temp name first or change create_job.
    # I'll update redis_client logic slightly in my head: 
    # No, I can't change the file I just wrote without another call.
    # I will simple generate a random ID for filename, and let job ID be separate.
    # OR: generate job ID here using uuid for filename, and pass it to create_job?
    # redis_client.create_job parses options. 
    
    import uuid
    file_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{file_id}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    with open(file_path, "wb") as f:
        f.write(contents)
        
    options = {
        "ocr_engine": ocr_engine,
        "ocr_mode": ocr_mode,
        "corners_override": corners_override,
        "run_ablation": run_ablation,
        "include_debug_overlays": include_debug_overlays
    }
    
    job_id = redis_client.create_job(file_path, file.filename, options)
    
    return {"job_id": job_id, "status": "queued"}

@router.get("/intake/jobs/{job_id}")
async def get_intake_job(job_id: str):
    job = redis_client.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
