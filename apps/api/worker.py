import time
import json
import os
import redis
import traceback
from datetime import datetime

import sys
sys.path.append(os.path.join(os.getcwd(), "apps", "api"))

from services.redis_client import get_redis_client, update_job_status, QUEUE_KEY
from services.supabase_client import get_supabase_client
from cv.utils import decode_image_to_cv2, encode_cv2_to_base64, resize_maintain_aspect
from cv.quality import analyze_quality
from cv.scan import scan_document
from cv.ocr import run_ocr, run_ocr_variants
from cv.visualize import generate_debug_overlays

def save_to_supabase(job_id: str, job_data: dict, result: dict, error: str = None):
    """
    Persist job results to Supabase tables: documents, intake_jobs, audit_log.
    """
    sb = get_supabase_client()
    if not sb:
        print(f"Skipping Supabase save for job {job_id} (Client not configured)")
        return

    try:
        # Prepare Data
        filename = job_data.get("original_filename", "unknown.jpg")
        
        # 1. Insert/Get Document
        # Ideally we might have created this earlier, but doing it here is fine.
        # We can use the job_id as document_id? No, separate.
        # Let's create a document record.
        doc_res = sb.table("documents").insert({
            "filename": filename,
            "content_type": "image/jpeg" # Assumption or derive
        }).execute()
        
        doc_id = doc_res.data[0]["id"] if doc_res.data else None
        
        # 2. Intake Job
        status = "failed" if error else "done"
        
        # Extract Score and Approval State
        score_int = 0
        approval_state = "needs_review"
        raw_text = ""
        extracted_json = {}
        
        if result:
            # Score
            quality = result.get("quality", {})
            score = quality.get("score", 0)
            score_int = int(score) if score is not None else 0
            
            # Text
            ocr = result.get("ocr", {})
            raw_text = ocr.get("text", "")
            
            # Logic: >= 70 Auto Approve
            if score_int >= 70:
                approval_state = "auto_approved"
            else:
                approval_state = "needs_review"
            
            extracted_json = result # Save full result blob
            
        # Insert Job
        job_payload = {
            "id": job_id, # Use same UUID from Redis if possible? 
                          # Yes, Redis job_id is UUID string. 
                          # If collision (unlikely), it might error.
            "document_id": doc_id,
            "status": status,
            "progress": 100,
            "score_int": score_int,
            "approval_state": approval_state,
            "raw_text": raw_text,
            "extracted_json": extracted_json,
            "error": error,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        sb.table("intake_jobs").insert(job_payload).execute()
        
        # 3. Audit Log
        sb.table("audit_log").insert({
            "event_type": "job_completed",
            "entity_type": "intake_jobs",
            "entity_id": job_id,
            "payload": {
                "status": status,
                "score": score_int,
                "approval": approval_state
            }
        }).execute()
        
        print(f"Persisted job {job_id} to Supabase (Doc ID: {doc_id})")

    except Exception as e:
        print(f"Failed to save to Supabase: {e}")
        traceback.print_exc()

def process_job(job_id, job_data):
    """
    Main processing logic (reused from intake.py).
    """
    print(f"Processing job {job_id}...")
    update_job_status(job_id, "running", progress=10)
    
    file_path = job_data.get("file_path")
    options = job_data.get("options", {})
    
    result = None
    error_msg = None
    
    try:
        # 1. Read Image
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        with open(file_path, "rb") as f:
            contents = f.read()
            
        original_img = decode_image_to_cv2(contents)
        if original_img is None:
            raise ValueError("Could not decode image")
            
        orig_h, orig_w = original_img.shape[:2]
        update_job_status(job_id, "running", progress=20)

        # 2. Parse Options (Defaults)
        ocr_engine = options.get("ocr_engine", "tesseract")
        ocr_mode = options.get("ocr_mode", "enhanced")
        run_ablation = options.get("run_ablation", True)
        include_debug_overlays = options.get("include_debug_overlays", False)
        corners_override_str = options.get("corners_override")
        
        parsed_corners = None
        if corners_override_str:
            try:
                parsed_corners = json.loads(corners_override_str)
                parsed_corners = [{"x": float(p["x"]), "y": float(p["y"])} for p in parsed_corners]
            except:
                pass

        # 3. Scan
        scanned_img, boundary_result, scan_meta = scan_document(
            original_img, 
            corners_override=parsed_corners
        )
        update_job_status(job_id, "running", progress=40)

        # 4. Quality
        doc_conf = boundary_result.get("confidence", 0.5)
        quality_res = analyze_quality(original_img, doc_confidence=doc_conf)
        update_job_status(job_id, "running", progress=50)

        # 5. OCR
        ocr_res = run_ocr(scanned_img, engine=ocr_engine, mode=ocr_mode)
        update_job_status(job_id, "running", progress=70)

        # 6. Ablation
        ocr_variants_list = None
        best_variant = None
        if run_ablation:
            variants_data, best_var = run_ocr_variants(original_img, scanned_img)
            if variants_data:
                ocr_variants_list = [
                    {
                        "name": v["name"],
                        "confidence": v["confidence"],
                        "text_preview": v["text_preview"],
                        "text_full": v["text_full"],
                        "timing_ms": v["timing_ms"],
                        "char_count": v["char_count"]
                    }
                    for v in variants_data
                ]
                best_variant = best_var
        update_job_status(job_id, "running", progress=80)

        # 7. Debug Overlays
        debug_overlays = None
        if include_debug_overlays or os.environ.get("CV_DEBUG_VIS", "0") == "1":
            overlays_data = generate_debug_overlays(
                original_img, include_glare=True, include_edges=True
            )
            debug_overlays = {
                "glare_overlay": overlays_data.get("glare_overlay"),
                "edge_overlay": overlays_data.get("edge_overlay")
            }

        # 8. Previews
        preview_img = resize_maintain_aspect(scanned_img, width=800)
        img_b64 = encode_cv2_to_base64(preview_img)
        preview_res = {
            "img_b64": img_b64,
            "is_scanned": scan_meta.scan_warp_success
        }

        orig_preview_img = resize_maintain_aspect(original_img, width=800)
        orig_preview_b64 = encode_cv2_to_base64(orig_preview_img)
        original_preview = {
            "img_b64": orig_preview_b64,
            "width": orig_w,
            "height": orig_h
        }

        boundary_res_dict = {
            "found": boundary_result.get("found", False),
            "corners": boundary_result.get("corners"),
            "confidence": boundary_result.get("confidence", 0.0),
            "debug_notes": boundary_result.get("debug_notes", [])
        }

        result = {
            "quality": quality_res.dict() if hasattr(quality_res, "dict") else quality_res,
            "ocr": ocr_res.dict() if hasattr(ocr_res, "dict") else ocr_res,
            "preview": preview_res,
            "boundary": boundary_res_dict,
            "scan_meta": scan_meta.dict() if hasattr(scan_meta, "dict") else scan_meta,
            "original_preview": original_preview,
            "ocr_variants": ocr_variants_list,
            "best_variant": best_variant,
            "debug_overlays": debug_overlays
        }
        
        update_job_status(job_id, "done", progress=100, result=result)
        print(f"Job {job_id} completed.")
        
    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        traceback.print_exc()
        error_msg = str(e)
        update_job_status(job_id, "failed", error=error_msg)
        
    # Phase 5A: Persistence
    # Always try to save even on failure (to record the error)
    save_to_supabase(job_id, job_data, result, error_msg)


def main():
    print("Worker started. Waiting for jobs...")
    r = get_redis_client()
    
    while True:
        try:
            item = r.brpop(QUEUE_KEY, timeout=5)
            if item:
                _, job_id = item
                job_data_str = r.get(f"intake:job:{job_id}")
                if job_data_str:
                    job_data = json.loads(job_data_str)
                    process_job(job_id, job_data)
                else:
                    print(f"Job {job_id} data not found in Redis.")     
        except redis.exceptions.ConnectionError:
            print("Redis connection lost. Retrying in 5s...")
            time.sleep(5)
        except Exception as e:
            print(f"Unexpected error in worker loop: {e}")
            time.sleep(1)

if __name__ == "__main__":
    main()
