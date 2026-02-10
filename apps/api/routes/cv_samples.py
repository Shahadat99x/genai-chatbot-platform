"""
CV Samples Endpoint — POST /cv/save-example
Saves intake results and images to data/cv_samples/<timestamp>/ for reports.
"""
import os
import json
import base64
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

# Data folder for CV samples
CV_SAMPLES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data", "cv_samples"
)


class SaveExampleRequest(BaseModel):
    """Full intake result payload."""
    intake_result: dict
    filename_prefix: Optional[str] = None


class SaveExampleResponse(BaseModel):
    """Paths to every saved file."""
    folder_path: str
    saved_files: List[str]


def _save_b64(b64_data: str, filepath: str) -> bool:
    """Decode a base64 (or data-URL) string and write to disk."""
    try:
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(b64_data))
        return True
    except Exception:
        return False


def _save_json(obj: dict, filepath: str) -> bool:
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(obj, f, indent=2, ensure_ascii=False)
        return True
    except Exception:
        return False


@router.post("/cv/save-example", response_model=SaveExampleResponse)
async def save_example(request: SaveExampleRequest):
    """
    Persist an intake result for later use in reports & presentations.

    Creates:  data/cv_samples/<prefix?>_<YYYYmmdd_HHMMSS>/
      input.png        – original photo
      scan.png         – perspective-corrected scan
      glare.png        – glare overlay (if present)
      edges.png        – edge overlay  (if present)
      boundary.json    – boundary detection result
      ocr.json         – OCR variants + best_variant
      full_response.json – complete API response (with base64 stripped)
    """
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    folder = request.filename_prefix or ""
    folder = f"{folder}_{ts}" if folder else ts
    folder_path = os.path.join(CV_SAMPLES_DIR, folder)

    try:
        os.makedirs(folder_path, exist_ok=True)
    except Exception as e:
        raise HTTPException(500, detail=f"Cannot create folder: {e}")

    r = request.intake_result
    saved: List[str] = []

    # --- images ---
    if r.get("original_preview", {}).get("img_b64"):
        p = os.path.join(folder_path, "input.png")
        if _save_b64(r["original_preview"]["img_b64"], p):
            saved.append("input.png")

    if r.get("preview", {}).get("img_b64"):
        p = os.path.join(folder_path, "scan.png")
        if _save_b64(r["preview"]["img_b64"], p):
            saved.append("scan.png")

    overlays = r.get("debug_overlays") or {}
    if overlays.get("glare_overlay"):
        p = os.path.join(folder_path, "glare.png")
        if _save_b64(overlays["glare_overlay"], p):
            saved.append("glare.png")
    if overlays.get("edge_overlay"):
        p = os.path.join(folder_path, "edges.png")
        if _save_b64(overlays["edge_overlay"], p):
            saved.append("edges.png")

    # --- JSON slices ---
    if r.get("boundary"):
        _save_json(r["boundary"], os.path.join(folder_path, "boundary.json"))
        saved.append("boundary.json")

    ocr_slice = {}
    if r.get("ocr_variants"):
        ocr_slice["ocr_variants"] = r["ocr_variants"]
    if r.get("best_variant"):
        ocr_slice["best_variant"] = r["best_variant"]
    if r.get("ocr"):
        ocr_slice["primary_ocr"] = r["ocr"]
    if ocr_slice:
        _save_json(ocr_slice, os.path.join(folder_path, "ocr.json"))
        saved.append("ocr.json")

    # --- full response (strip heavy base64) ---
    full = {k: v for k, v in r.items()}
    for key in ("original_preview", "preview", "debug_overlays"):
        if key in full:
            full[key] = "<saved as image>"
    _save_json(full, os.path.join(folder_path, "full_response.json"))
    saved.append("full_response.json")

    return SaveExampleResponse(folder_path=folder_path, saved_files=saved)
