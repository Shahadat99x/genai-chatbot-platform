import json
import os
from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from cv.schemas import (
    IntakeResponse, PreviewResult, QualityResult, OcrResult,
    BoundaryResult, ScanMeta, CornerPoint, OriginalPreview,
    OcrVariant, DebugOverlays
)
from cv.utils import decode_image_to_cv2, encode_cv2_to_base64, resize_maintain_aspect
from cv.quality import analyze_quality
from cv.scan import scan_document
from cv.ocr import run_ocr, run_ocr_variants
from cv.visualize import generate_debug_overlays
import cv2

router = APIRouter()

# Check for debug visualization flag
CV_DEBUG_VIS = os.environ.get("CV_DEBUG_VIS", "0") == "1"


@router.post("/intake/document", response_model=IntakeResponse)
async def intake_document(
    file: UploadFile = File(...),
    ocr_engine: str = Form("tesseract"),
    ocr_mode: str = Form("enhanced"),  # "basic" or "enhanced"
    return_preview: bool = Form(True),
    corners_override: str = Form(None),  # JSON string: [{"x":.."y":..}, ...]
    run_ablation: bool = Form(True),  # Run OCR ablation for comparison
    include_debug_overlays: bool = Form(False)  # Include glare/edge overlays
):
    """
    Process a document image for intake.
    
    Args:
        file: Image file (JPEG/PNG)
        ocr_engine: OCR engine to use (default: tesseract)
        ocr_mode: "basic" for fast OCR, "enhanced" for better accuracy on difficult images
        return_preview: Whether to return base64 preview image
        corners_override: Optional JSON string with 4 corner points for manual boundary
        run_ablation: Run OCR on multiple variants for comparison
        include_debug_overlays: Include debug visualizations (glare, edges)
    """
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG/PNG allowed.")

    # Validate ocr_mode
    if ocr_mode not in ["basic", "enhanced"]:
        ocr_mode = "basic"

    # Parse corners_override if provided
    parsed_corners = None
    if corners_override:
        try:
            parsed_corners = json.loads(corners_override)
            if not isinstance(parsed_corners, list) or len(parsed_corners) != 4:
                raise HTTPException(
                    status_code=400, 
                    detail="corners_override must be a JSON array of exactly 4 {x, y} points"
                )
            # Validate each point has x and y
            for i, pt in enumerate(parsed_corners):
                if not isinstance(pt, dict) or "x" not in pt or "y" not in pt:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Corner point {i} must have 'x' and 'y' fields"
                    )
                parsed_corners[i] = {"x": float(pt["x"]), "y": float(pt["y"])}
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON in corners_override: {str(e)}")

    # Read and decode
    try:
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=413, detail="File too large (max 10MB).")
             
        original_img = decode_image_to_cv2(contents)
        if original_img is None:
            raise HTTPException(status_code=400, detail="Could not decode image.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

    orig_h, orig_w = original_img.shape[:2]

    # 1. Scan / Crop with optional manual corners
    scanned_img, boundary_result, scan_meta = scan_document(
        original_img, 
        corners_override=parsed_corners
    )
    
    # 2. Quality Check (use boundary confidence)
    doc_conf = boundary_result.get("confidence", 0.5)
    quality_res = analyze_quality(original_img, doc_confidence=doc_conf)

    # 3. OCR (primary - on scanned image, with mode)
    ocr_res = run_ocr(scanned_img, engine=ocr_engine, mode=ocr_mode)
    
    # 4. OCR Ablation (if requested)
    ocr_variants_list = None
    best_variant = None
    if run_ablation:
        variants_data, best_var = run_ocr_variants(original_img, scanned_img)
        if variants_data:
            ocr_variants_list = [
                OcrVariant(
                    name=v["name"],
                    confidence=v["confidence"],
                    text_preview=v["text_preview"],
                    text_full=v["text_full"],
                    timing_ms=v["timing_ms"],
                    char_count=v["char_count"]
                )
                for v in variants_data
            ]
            best_variant = best_var if best_var else None
    
    # 5. Debug Overlays (if requested or CV_DEBUG_VIS=1)
    debug_overlays = None
    if include_debug_overlays or CV_DEBUG_VIS:
        overlays_data = generate_debug_overlays(
            original_img,
            include_glare=True,
            include_edges=True
        )
        debug_overlays = DebugOverlays(
            glare_overlay=overlays_data.get("glare_overlay"),
            edge_overlay=overlays_data.get("edge_overlay")
        )
    
    # 6. Build boundary result for response
    boundary_res = BoundaryResult(
        found=boundary_result.get("found", False),
        corners=[
            CornerPoint(x=c["x"], y=c["y"]) 
            for c in boundary_result.get("corners", [])
        ] if boundary_result.get("corners") else None,
        confidence=boundary_result.get("confidence", 0.0),
        debug_notes=boundary_result.get("debug_notes", [])
    )
    
    # 7. Preview (scanned output)
    preview_res = None
    if return_preview:
        preview_img = resize_maintain_aspect(scanned_img, width=800)
        img_b64 = encode_cv2_to_base64(preview_img)
        preview_res = PreviewResult(
            img_b64=img_b64,
            is_scanned=scan_meta.scan_warp_success
        )

    # 8. Original preview (for corner overlay on frontend)
    # Resize original to reasonable size for display
    orig_preview_img = resize_maintain_aspect(original_img, width=800)
    orig_preview_b64 = encode_cv2_to_base64(orig_preview_img)
    
    original_preview = OriginalPreview(
        img_b64=orig_preview_b64,
        width=orig_w,  # Original image dimensions for coordinate mapping
        height=orig_h
    )

    return IntakeResponse(
        quality=quality_res,
        ocr=ocr_res,
        preview=preview_res,
        boundary=boundary_res,
        scan_meta=scan_meta,
        original_preview=original_preview,
        ocr_variants=ocr_variants_list,
        best_variant=best_variant,
        debug_overlays=debug_overlays
    )


