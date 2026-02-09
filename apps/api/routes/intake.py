from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from cv.schemas import IntakeResponse, PreviewResult, QualityResult, OcrResult
from cv.utils import decode_image_to_cv2, encode_cv2_to_base64, resize_maintain_aspect
from cv.quality import analyze_quality
from cv.scan import scan_document
from cv.ocr import run_ocr
import cv2

router = APIRouter()

@router.post("/intake/document", response_model=IntakeResponse)
async def intake_document(
    file: UploadFile = File(...),
    ocr_engine: str = Form("tesseract"),
    ocr_mode: str = Form("basic"),  # "basic" or "enhanced"
    return_preview: bool = Form(True)
):
    """
    Process a document image for intake.
    
    Args:
        file: Image file (JPEG/PNG)
        ocr_engine: OCR engine to use (default: tesseract)
        ocr_mode: "basic" for fast OCR, "enhanced" for better accuracy on difficult images
        return_preview: Whether to return base64 preview image
    """
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG/PNG allowed.")

    # Validate ocr_mode
    if ocr_mode not in ["basic", "enhanced"]:
        ocr_mode = "basic"

    # Read and decode
    try:
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024: # 10MB limit
             raise HTTPException(status_code=413, detail="File too large (max 10MB).")
             
        original_img = decode_image_to_cv2(contents)
        if original_img is None:
             raise HTTPException(status_code=400, detail="Could not decode image.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

    # 1. Scan / Crop
    scanned_img, doc_conf, was_warped = scan_document(original_img)
    
    # 2. Quality Check
    quality_res = analyze_quality(original_img, doc_confidence=doc_conf)

    # 3. OCR (on scanned image, with mode)
    ocr_res = run_ocr(scanned_img, engine=ocr_engine, mode=ocr_mode)
    
    # 4. Preview
    preview_res = None
    if return_preview:
        preview_img = resize_maintain_aspect(scanned_img, width=800)
        img_b64 = encode_cv2_to_base64(preview_img)
        preview_res = PreviewResult(
            img_b64=img_b64,
            is_scanned=was_warped
        )

    return IntakeResponse(
        quality=quality_res,
        ocr=ocr_res,
        preview=preview_res
    )
