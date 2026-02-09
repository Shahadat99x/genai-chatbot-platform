from pydantic import BaseModel
from typing import List, Optional

class QualityResult(BaseModel):
    score: float
    issues: List[str]
    tips: List[str]
    blur_score: float
    brightness_mean: float
    glare_ratio: float
    doc_confidence: float

class OcrResult(BaseModel):
    text: str
    confidence: float
    engine: str
    tesseract_found: bool
    tesseract_path_used: Optional[str] = None
    ocr_error: Optional[str] = None
    debug_notes: List[str] = []
    mode: str = "basic"
    timing_ms: int = 0
    debug: Optional[dict] = None

class PreviewResult(BaseModel):
    img_b64: str
    is_scanned: bool

class IntakeResponse(BaseModel):
    quality: QualityResult
    ocr: OcrResult
    preview: Optional[PreviewResult] = None
