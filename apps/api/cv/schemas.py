from pydantic import BaseModel
from typing import List, Optional


class CornerPoint(BaseModel):
    """A single corner point with x,y coordinates."""
    x: float
    y: float


class BoundaryResult(BaseModel):
    """Result of document boundary detection."""
    found: bool
    corners: Optional[List[CornerPoint]] = None
    confidence: float = 0.0
    debug_notes: List[str] = []


class ScanMeta(BaseModel):
    """Metadata about the scan/warp operation."""
    used_auto_corners: bool
    corners_used: Optional[List[CornerPoint]] = None
    scan_warp_success: bool
    scan_error: Optional[str] = None


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


class OcrVariant(BaseModel):
    """OCR result for a specific processing variant."""
    name: str  # "raw", "scan", "scan_enhanced"
    confidence: float
    text_preview: str  # First 500 chars
    text_full: str
    timing_ms: int
    char_count: int


class PreviewResult(BaseModel):
    img_b64: str
    is_scanned: bool


class OriginalPreview(BaseModel):
    """Preview of the original uploaded image for overlay purposes."""
    img_b64: str
    width: int
    height: int


class DebugOverlays(BaseModel):
    """Visual debug overlays for presentation."""
    glare_overlay: Optional[str] = None  # base64 image with glare highlighted
    edge_overlay: Optional[str] = None   # base64 image with edges highlighted


class IntakeResponse(BaseModel):
    quality: QualityResult
    ocr: OcrResult
    preview: Optional[PreviewResult] = None
    boundary: Optional[BoundaryResult] = None
    scan_meta: Optional[ScanMeta] = None
    original_preview: Optional[OriginalPreview] = None
    # Phase CV-2 additions
    ocr_variants: Optional[List[OcrVariant]] = None
    best_variant: Optional[str] = None
    debug_overlays: Optional[DebugOverlays] = None

