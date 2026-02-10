"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CornerPoint {
  x: number;
  y: number;
}

interface BoundaryResult {
  found: boolean;
  corners: CornerPoint[] | null;
  confidence: number;
  debug_notes: string[];
}

interface ScanMeta {
  used_auto_corners: boolean;
  corners_used: CornerPoint[] | null;
  scan_warp_success: boolean;
  scan_error: string | null;
}

interface QualityResult {
  score: number;
  issues: string[];
  tips: string[];
  doc_confidence: number;
}

interface OcrResult {
  text: string;
  confidence: number;
  engine: string;
  tesseract_found: boolean;
  tesseract_path_used?: string;
  ocr_error?: string;
  debug_notes?: string[];
  mode?: string;
  timing_ms?: number;
}

interface OcrVariant {
  name: string;
  confidence: number;
  text_preview: string;
  text_full: string;
  timing_ms: number;
  char_count: number;
}

interface DebugOverlays {
  glare_overlay?: string;
  edge_overlay?: string;
}

interface OriginalPreview {
  img_b64: string;
  width: number;
  height: number;
}

interface AnalysisResult {
  quality: QualityResult;
  ocr: OcrResult;
  preview?: {
    img_b64: string;
    is_scanned: boolean;
  };
  boundary?: BoundaryResult;
  scan_meta?: ScanMeta;
  original_preview?: OriginalPreview;
  ocr_variants?: OcrVariant[];
  best_variant?: string;
  debug_overlays?: DebugOverlays;
}

export default function IntakePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [applyingCorners, setApplyingCorners] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [error, setError] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const fileRef = useRef<File | null>(null);

  // Corner adjustment state
  const [adjustMode, setAdjustMode] = useState(false);
  const [corners, setCorners] = useState<CornerPoint[] | null>(null);
  const [autoCorners, setAutoCorners] = useState<CornerPoint[] | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // View tabs
  const [activeTab, setActiveTab] = useState<"summary" | "scan" | "compare" | "debug">("summary");
  const [expandedVariant, setExpandedVariant] = useState<string | null>(null);

  // Image container ref for coordinate mapping
  const originalImgRef = useRef<HTMLImageElement>(null);
  const [displayScale, setDisplayScale] = useState({ scaleX: 1, scaleY: 1 });

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const [savingExample, setSavingExample] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const downloadResults = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intake_results_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveExample = async () => {
    if (!result) return;
    setSavingExample(true);
    setSavedPath(null);
    
    try {
      // Use new endpoint path
      const res = await fetch(`${API_BASE}/cv/save-example`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intake_result: result }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to save example");
      }
      
      const data = await res.json();
      // Show just the folder name if path is long
      const folderName = data.folder_path.split(/[\\\/]/).pop();
      setSavedPath(folderName);
    } catch (err) {
      console.error("Save example failed:", err);
    } finally {
      setSavingExample(false);
    }
  };

// ... [existing code] ...

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-neutral-800 pb-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab("summary")}
                className={`px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
                  activeTab === "summary"
                    ? "bg-neutral-800 text-emerald-400 border-b-2 border-emerald-400"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                📋 Summary
              </button>
              <button
                onClick={() => setActiveTab("scan")}
                className={`px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
                  activeTab === "scan"
                    ? "bg-neutral-800 text-emerald-400 border-b-2 border-emerald-400"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                📄 Scan & OCR
              </button>
              <button
                onClick={() => setActiveTab("compare")}
                className={`px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
                  activeTab === "compare"
                    ? "bg-neutral-800 text-emerald-400 border-b-2 border-emerald-400"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                📊 OCR Compare
              </button>
              <button
                onClick={() => setActiveTab("debug")}
                className={`px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
                  activeTab === "debug"
                    ? "bg-neutral-800 text-emerald-400 border-b-2 border-emerald-400"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                🔍 Debug
              </button>
              
              {/* Download/Save Buttons */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={saveExample}
                  disabled={savingExample}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 whitespace-nowrap ${
                    savingExample 
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                      : "bg-purple-900/30 text-purple-300 hover:bg-purple-900/50 border border-purple-700"
                  }`}
                >
                  {savingExample ? "Saving..." : "💾 Save Example"}
                </button>
                <button
                  onClick={downloadResults}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition flex items-center gap-2 whitespace-nowrap"
                >
                  ⬇️ JSON
                </button>
              </div>
            </div>
            
            {/* Saved Path Indicator */}
            {savedPath && (
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-2 text-sm text-green-300 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                ✓ Saved to: <code className="bg-neutral-800 px-2 py-0.5 rounded text-xs font-mono">{savedPath}</code>
              </div>
            )}

            {/* Tab Content: Summary (New) */}
            {activeTab === "summary" && result && (
              <div className="space-y-6">
                
                {/* 1. Before / After Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Original */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                       <h3 className="text-sm font-semibold text-neutral-400">Original Input</h3>
                       {result.quality?.issues && result.quality.issues.length > 0 && (
                          <div className="flex gap-2">
                            {result.quality.issues.slice(0, 2).map(issue => (
                              <span key={issue} className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/30 text-red-300 border border-red-800 capitalize">
                                {issue.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                       )}
                    </div>
                    <div className="bg-black rounded-lg border border-neutral-800 overflow-hidden h-64 flex items-center justify-center relative group">
                      {result.original_preview ? (
                        <img 
                          src={result.original_preview.img_b64} 
                          className="max-w-full max-h-full object-contain" 
                          alt="Original" 
                        />
                      ) : <span className="text-neutral-600 text-xs">No preview</span>}
                      {/* Overlay Badge */}
                      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white">
                        {result.original_preview?.width}x{result.original_preview?.height}px
                      </div>
                    </div>
                  </div>

                  {/* Scanned */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                       <h3 className="text-sm font-semibold text-emerald-400">Scanned Corrected</h3>
                       <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-300 border border-emerald-800">
                         Perspective Warp
                       </span>
                    </div>
                    <div className="bg-black rounded-lg border border-neutral-800 overflow-hidden h-64 flex items-center justify-center relative">
                      {result.preview ? (
                        <img 
                          src={result.preview.img_b64} 
                          className="max-w-full max-h-full object-contain" 
                          alt="Scanned" 
                        />
                      ) : <span className="text-neutral-600 text-xs">No preview</span>}
                    </div>
                  </div>
                </div>

                {/* 2. OCR Confidence Summary */}
                {result.ocr_variants && (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-white mb-4">OCR Performance Comparison</h3>
                    <div className="space-y-3">
                      {result.ocr_variants.map((v) => {
                        const isBest = result.best_variant === v.name;
                        const widthPct = Math.max(5, Math.min(100, v.confidence * 100));
                        
                        return (
                          <div key={v.name} className="flex items-center gap-4 text-xs">
                             {/* Label */}
                             <div className="w-24 font-medium text-neutral-300 shrink-0 flex items-center gap-2">
                               {isBest && <span className="text-emerald-500">★</span>}
                               {variantLabels[v.name] || v.name}
                             </div>
                             
                             {/* Bar */}
                             <div className="flex-1 bg-neutral-800 h-2 rounded-full overflow-hidden relative">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${isBest ? 'bg-emerald-500' : 'bg-neutral-600'}`}
                                  style={{ width: `${widthPct}%` }}
                                />
                             </div>

                             {/* Stats */}
                             <div className="w-48 flex items-center justify-end gap-3 shrink-0 font-mono text-neutral-500">
                                <span className={isBest ? "text-emerald-400 font-bold" : ""}>
                                  {Math.round(v.confidence * 100)}%
                                </span>
                                <span>{v.timing_ms}ms</span>
                                <span>{v.char_count} chars</span>
                             </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* 3. Extracted Text (Best) */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-semibold text-white">Extracted Content</h3>
                      <button 
                         onClick={() => setActiveTab("scan")}
                         className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        Edit / Copy Text →
                      </button>
                    </div>
                   <div className="bg-neutral-950 rounded-lg p-3 text-xs font-mono text-neutral-300 max-h-32 overflow-hidden relative">
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-neutral-950 to-transparent"></div>
                      {result.ocr.text || <span className="text-neutral-600 italic">No text extracted...</span>}
                   </div>
                </div>

              </div>
            )}

            {/* Tab Content: Scan & OCR */}

  // Calculate display scale when image loads
  const updateDisplayScale = useCallback(() => {
    if (originalImgRef.current && result?.original_preview) {
      const img = originalImgRef.current;
      const displayW = img.clientWidth;
      const displayH = img.clientHeight;
      const origW = result.original_preview.width;
      const origH = result.original_preview.height;
      
      setDisplayScale({
        scaleX: displayW / origW,
        scaleY: displayH / origH
      });
    }
  }, [result?.original_preview]);

  useEffect(() => {
    updateDisplayScale();
    window.addEventListener('resize', updateDisplayScale);
    return () => window.removeEventListener('resize', updateDisplayScale);
  }, [updateDisplayScale]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      fileRef.current = selectedFile;
      setResult(null);
      setError("");
      setCorners(null);
      setAutoCorners(null);
      setAdjustMode(false);
      setActiveTab("scan");
    }
  };

  const analyzeImage = async (mode: "basic" | "enhanced" = "basic", cornersOverride?: CornerPoint[]) => {
    const targetFile = fileRef.current || file;
    if (!targetFile) return;

    if (mode === "enhanced") {
      setRerunning(true);
    } else if (cornersOverride) {
      setApplyingCorners(true);
    } else {
      setAnalyzing(true);
    }
    setError("");

    const formData = new FormData();
    formData.append("file", targetFile);
    formData.append("ocr_engine", "tesseract");
    formData.append("ocr_mode", mode);
    formData.append("return_preview", "true");
    formData.append("run_ablation", "true");
    formData.append("include_debug_overlays", "true");
    
    if (cornersOverride) {
      formData.append("corners_override", JSON.stringify(cornersOverride));
    }

    try {
      const res = await fetch(`${API_BASE}/intake/document`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Upload failed");
      }

      const data: AnalysisResult = await res.json();
      
      // Update state based on mode
      if (mode === "enhanced" && result) {
        // Keep existing preview, just update OCR
        setResult({
          ...result,
          ocr: data.ocr
        });
      } else {
        setResult(data);
        // Store auto-detected corners
        if (data.boundary?.corners) {
          setAutoCorners(data.boundary.corners);
          setCorners(data.boundary.corners);
        } else {
          // Fallback: create corners at image edges with inset
          if (data.original_preview) {
            const w = data.original_preview.width;
            const h = data.original_preview.height;
            const inset = 0.1;
            const fallbackCorners: CornerPoint[] = [
              { x: w * inset, y: h * inset },
              { x: w * (1 - inset), y: h * inset },
              { x: w * (1 - inset), y: h * (1 - inset) },
              { x: w * inset, y: h * (1 - inset) },
            ];
            setAutoCorners(null);
            setCorners(fallbackCorners);
          }
        }
      }
      setOcrText(data.ocr.text);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
      setRerunning(false);
      setApplyingCorners(false);
    }
  };

  const applyScan = () => {
    if (corners && corners.length === 4) {
      analyzeImage("basic", corners);
    }
  };

  const resetCorners = () => {
    if (autoCorners) {
      setCorners(autoCorners);
    } else if (result?.original_preview) {
      // Reset to fallback
      const w = result.original_preview.width;
      const h = result.original_preview.height;
      const inset = 0.1;
      setCorners([
        { x: w * inset, y: h * inset },
        { x: w * (1 - inset), y: h * inset },
        { x: w * (1 - inset), y: h * (1 - inset) },
        { x: w * inset, y: h * (1 - inset) },
      ]);
    }
  };

  const sendToChat = () => {
    if (!ocrText) return;
    localStorage.setItem("intake_text", ocrText);
    router.push("/chat");
  };






  // Drag handlers
  const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
    if (!adjustMode) return;
    e.preventDefault();
    setDraggingIndex(index);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggingIndex === null || !originalImgRef.current || !corners) return;

    const img = originalImgRef.current;
    const rect = img.getBoundingClientRect();
    
    // Get mouse position relative to image
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    
    // Convert to image coordinates
    const imgX = relX / displayScale.scaleX;
    const imgY = relY / displayScale.scaleY;
    
    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(result?.original_preview?.width || imgX, imgX));
    const clampedY = Math.max(0, Math.min(result?.original_preview?.height || imgY, imgY));

    const newCorners = [...corners];
    newCorners[draggingIndex] = { x: clampedX, y: clampedY };
    setCorners(newCorners);
  }, [draggingIndex, corners, displayScale, result?.original_preview]);

  const handleMouseUp = useCallback(() => {
    setDraggingIndex(null);
  }, []);

  useEffect(() => {
    if (draggingIndex !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingIndex, handleMouseMove, handleMouseUp]);

  // Convert image coordinates to display coordinates
  const toDisplayCoords = (pt: CornerPoint) => ({
    x: pt.x * displayScale.scaleX,
    y: pt.y * displayScale.scaleY
  });

  const cornerLabels = ["TL", "TR", "BR", "BL"];
  const variantLabels: Record<string, string> = {
    raw: "Raw (Original)",
    scan: "Scanned",
    scan_enhanced: "Scan + Enhanced"
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 flex flex-col items-center">
      <div className="max-w-6xl w-full space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Document Intake
            </h1>
            <div className="text-xs text-neutral-600 font-mono mt-1">
                API: {API_BASE}
            </div>
          </div>
          <Link href="/chat" className="text-neutral-400 hover:text-white transition">
            Back to Chat
          </Link>
        </div>

        {/* Upload Section */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-4 shadow-xl">
          <div className="border-2 border-dashed border-neutral-700 rounded-xl p-8 hover:border-emerald-500/50 transition bg-neutral-900/50">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xl font-bold">
                +
              </div>
              <span className="text-lg font-medium">
                {file ? file.name : "Click to upload a document"}
              </span>
              <span className="text-sm text-neutral-500">
                Supports JPG, PNG (Max 10MB)
              </span>
            </label>
          </div>

          <button
            onClick={() => analyzeImage("basic")}
            disabled={!file || analyzing}
            className={`w-full py-3 rounded-lg font-medium transition-all transform active:scale-95 ${
              !file || analyzing
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
            }`}
          >
            {analyzing ? "Analyzing..." : "Analyze Document"}
          </button>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800/50 text-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-neutral-800 pb-2">
              <button
                onClick={() => setActiveTab("scan")}
                className={`px-4 py-2 rounded-t-lg font-medium transition ${
                  activeTab === "scan"
                    ? "bg-neutral-800 text-emerald-400 border-b-2 border-emerald-400"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                📄 Scan & OCR
              </button>
              <button
                onClick={() => setActiveTab("compare")}
                className={`px-4 py-2 rounded-t-lg font-medium transition ${
                  activeTab === "compare"
                    ? "bg-neutral-800 text-emerald-400 border-b-2 border-emerald-400"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                📊 OCR Compare
              </button>
              <button
                onClick={() => setActiveTab("debug")}
                className={`px-4 py-2 rounded-t-lg font-medium transition ${
                  activeTab === "debug"
                    ? "bg-neutral-800 text-emerald-400 border-b-2 border-emerald-400"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                🔍 Debug Overlays
              </button>
              
              {/* Download Button */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={saveExample}
                  disabled={savingExample}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
                    savingExample 
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                      : "bg-purple-900/30 text-purple-300 hover:bg-purple-900/50 border border-purple-700"
                  }`}
                >
                  {savingExample ? "Saving..." : "💾 Save Example"}
                </button>
                <button
                  onClick={downloadResults}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition flex items-center gap-2"
                >
                  ⬇️ Download JSON
                </button>
              </div>
            </div>
            
            {/* Saved Path Indicator */}
            {savedPath && (
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-2 text-sm text-green-300 flex items-center gap-2">
                ✓ Saved to: <code className="bg-neutral-800 px-2 py-0.5 rounded text-xs">{savedPath}</code>
              </div>
            )}

            {/* Tab Content: Scan & OCR */}
            {activeTab === "scan" && (
              <>
                {/* Corner Adjustment Section */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-emerald-400">
                      Document Boundary
                    </h3>
                    <div className="flex items-center gap-3">
                      {result.boundary?.found ? (
                        <span className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded">
                          Auto-detected ({Math.round((result.boundary.confidence || 0) * 100)}%)
                        </span>
                      ) : corners && corners.length === 4 ? (
                        <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-1 rounded">
                          Uncertain — adjust corners
                        </span>
                      ) : (
                        <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded">
                          Detection failed
                        </span>
                      )}
                    </div>
                  </div>

                  {!result.boundary?.found && corners && corners.length === 4 && (
                    <div className="mb-4 p-3 bg-amber-900/20 border border-amber-800 rounded-lg text-sm text-amber-200">
                      ⚠️ Auto-detection uncertain — please adjust corners manually for best results.
                    </div>
                  )}
                  {!result.boundary?.found && (!corners || corners.length !== 4) && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-200">
                      ❌ Auto-detection failed. No corners available.
                    </div>
                  )}

                  {/* Original Image with Overlay */}
                  {result.original_preview && (
                    <div className="relative mb-4 bg-black rounded-lg overflow-hidden">
                      <img
                        ref={originalImgRef}
                        src={result.original_preview.img_b64}
                        alt="Original Document"
                        className="w-full h-auto max-h-[500px] object-contain"
                        onLoad={updateDisplayScale}
                        draggable={false}
                      />
                      
                      {/* SVG Overlay for corners */}
                      {corners && corners.length === 4 && (
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-none"
                          style={{ pointerEvents: adjustMode ? 'auto' : 'none' }}
                        >
                          {/* Polygon connecting corners */}
                          <polygon
                            points={corners.map(c => {
                              const d = toDisplayCoords(c);
                              return `${d.x},${d.y}`;
                            }).join(' ')}
                            fill="rgba(16, 185, 129, 0.15)"
                            stroke="#10b981"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />
                          
                          {/* Draggable corner handles */}
                          {corners.map((corner, idx) => {
                            const d = toDisplayCoords(corner);
                            return (
                              <g key={idx}>
                                {/* Outer ring */}
                                <circle
                                  cx={d.x}
                                  cy={d.y}
                                  r={adjustMode ? 16 : 10}
                                  fill={adjustMode ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.2)"}
                                  stroke="#10b981"
                                  strokeWidth="2"
                                  style={{ 
                                    cursor: adjustMode ? 'grab' : 'default',
                                    pointerEvents: adjustMode ? 'auto' : 'none'
                                  }}
                                  onMouseDown={handleMouseDown(idx)}
                                />
                                {/* Inner dot */}
                                <circle
                                  cx={d.x}
                                  cy={d.y}
                                  r="4"
                                  fill="#10b981"
                                  style={{ pointerEvents: 'none' }}
                                />
                                {/* Label */}
                                <text
                                  x={d.x}
                                  y={d.y - 20}
                                  textAnchor="middle"
                                  fill="#10b981"
                                  fontSize="10"
                                  fontWeight="bold"
                                  style={{ pointerEvents: 'none' }}
                                >
                                  {cornerLabels[idx]}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      )}
                    </div>
                  )}

                  {/* Corner Controls */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setAdjustMode(!adjustMode)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        adjustMode
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      {adjustMode ? "✓ Adjusting Corners" : "Adjust Corners"}
                    </button>
                    
                    <button
                      onClick={applyScan}
                      disabled={!corners || applyingCorners}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        !corners || applyingCorners
                          ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-500 text-white"
                      }`}
                    >
                      {applyingCorners ? "Applying..." : "Apply Scan"}
                    </button>
                    
                    <button
                      onClick={resetCorners}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Preview & Quality */}
                  <div className="space-y-6">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
                      <h3 className="text-lg font-semibold mb-4 text-emerald-400">Scan Preview</h3>
                      {result.preview?.img_b64 ? (
                        <div className="rounded-lg overflow-hidden border border-neutral-700 aspect-[3/4] bg-black">
                          <img
                            src={result.preview.img_b64}
                            alt="Scanned Document"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                         <div className="h-64 bg-neutral-800 rounded-lg flex items-center justify-center text-neutral-500">
                           No preview available
                         </div>
                      )}
                      {result.scan_meta?.scan_error && (
                        <div className="mt-2 text-xs text-amber-400">
                          ⚠️ {result.scan_meta.scan_error}
                        </div>
                      )}
                    </div>

                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
                       <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-emerald-400">Quality Check</h3>
                          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                              result.quality.score > 80 ? "bg-emerald-500/20 text-emerald-400" :
                              result.quality.score > 50 ? "bg-yellow-500/20 text-yellow-400" :
                              "bg-red-500/20 text-red-400"
                          }`}>
                              Score: {Math.round(result.quality.score)}/100
                          </div>
                       </div>
                       
                       {result.quality.issues.length > 0 ? (
                          <ul className="space-y-2 mb-4">
                              {result.quality.issues.map((issue, i) => (
                                  <li key={i} className="flex items-center gap-2 text-red-300 text-sm">
                                      <span>⚠️</span>
                                      <span className="capitalize">{issue.replace("_", " ")}</span>
                                  </li>
                              ))}
                          </ul>
                       ) : (
                          <div className="text-emerald-300 text-sm mb-4">✓ No major issues detected</div>
                       )}
                       
                       {result.quality.tips.length > 0 && (
                          <div className="bg-neutral-800/50 rounded-lg p-3 text-sm text-neutral-300">
                              <strong className="block mb-1 text-neutral-400">Tips to improve:</strong>
                              <ul className="list-disc list-inside space-y-1">
                                  {result.quality.tips.map((tip, i) => (
                                      <li key={i}>{tip}</li>
                                  ))}
                              </ul>
                          </div>
                       )}
                    </div>
                  </div>

                  {/* OCR Text */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-emerald-400">Extracted Text</h3>
                      <div className="flex items-center gap-2">
                        {result.ocr.mode && (
                          <span className="text-xs bg-neutral-800 px-2 py-0.5 rounded text-neutral-400">
                            {result.ocr.mode}
                          </span>
                        )}
                        <span className={`text-xs ${result.ocr.confidence > 0.6 ? 'text-neutral-500' : 'text-red-400'}`}>
                           {Math.round(result.ocr.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                    
                    {/* OCR Error/Warning Alerts */}
                    {!result.ocr.tesseract_found && (
                      <div className="bg-red-900/20 border border-red-800 p-3 rounded-lg mb-4">
                          <div className="text-red-400 font-bold text-sm mb-1">⚠️ OCR Engine Not Found</div>
                          <div className="text-red-200 text-xs">
                              Tesseract is not installed or not configured. 
                              <br />Set TESSERACT_CMD in apps/api/.env and restart the backend.
                          </div>
                      </div>
                    )}

                    {result.ocr.ocr_error && (
                      <div className="bg-red-900/20 border border-red-800 p-3 rounded-lg mb-4">
                          <div className="text-red-400 font-bold text-sm mb-1">OCR Error</div>
                          <div className="text-red-200 text-xs break-words">
                              {result.ocr.ocr_error}
                          </div>
                      </div>
                    )}

                    {!ocrText && result.ocr.tesseract_found && !result.ocr.ocr_error && (
                      <div className="bg-yellow-900/20 border border-yellow-800 p-3 rounded-lg mb-4">
                          <div className="text-yellow-400 font-bold text-sm mb-1">No Text Extracted</div>
                          <div className="text-yellow-200 text-xs">
                              Try the "Re-run OCR (Enhanced)" button below for better results on difficult images.
                          </div>
                      </div>
                    )}
                    
                    <textarea
                      value={ocrText}
                      onChange={(e) => setOcrText(e.target.value)}
                      className="flex-1 min-h-[200px] w-full bg-neutral-950 border border-neutral-700 rounded-lg p-4 text-sm font-mono leading-relaxed focus:ring-2 focus:ring-emerald-500/50 outline-none resize-none mb-4 custom-scrollbar"
                      placeholder="No text extracted..."
                    />
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 mb-3">
                       <button 
                         onClick={() => navigator.clipboard.writeText(ocrText)}
                         disabled={!ocrText}
                         className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                           ocrText 
                             ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                             : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                         }`}
                       >
                          Copy Text
                       </button>
                       <button 
                         onClick={sendToChat}
                         disabled={!ocrText}
                         className={`flex-1 py-2 rounded-lg text-sm font-medium transition shadow-lg ${
                             !ocrText 
                             ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" 
                             : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
                         }`}
                       >
                          Send to Chat →
                       </button>
                    </div>

                    {/* Re-run OCR Button */}
                    <button 
                      onClick={() => analyzeImage("enhanced")}
                      disabled={rerunning}
                      className={`w-full py-2 rounded-lg text-sm font-medium transition border ${
                        rerunning
                          ? "bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed"
                          : "bg-amber-900/20 hover:bg-amber-900/40 text-amber-400 border-amber-800"
                      }`}
                    >
                      {rerunning ? "Re-running OCR..." : "🔄 Re-run OCR (Enhanced)"}
                    </button>
                    {result.ocr.timing_ms !== undefined && (
                      <div className="text-center text-xs text-neutral-600 mt-1">
                        Last OCR took {result.ocr.timing_ms}ms
                      </div>
                    )}

                     {/* Debug Toggle */}
                     <div className="mt-4 pt-4 border-t border-neutral-800">
                          <button 
                              onClick={() => setShowDebug(!showDebug)}
                              className="text-xs text-neutral-600 hover:text-neutral-400 flex items-center gap-1 w-full justify-center"
                          >
                              {showDebug ? "Hide Debug Info" : "Show Debug Info"}
                              <svg className={`w-3 h-3 transform transition ${showDebug ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                          </button>
                          
                          {showDebug && (
                              <div className="mt-2 text-xs font-mono bg-neutral-950 p-3 rounded border border-neutral-800 overflow-x-auto space-y-2">
                                  <div><span className="text-neutral-500">Engine:</span> {result.ocr.engine}</div>
                                  <div><span className="text-neutral-500">Mode:</span> {result.ocr.mode || "basic"}</div>
                                  <div><span className="text-neutral-500">Found:</span> {result.ocr.tesseract_found ? "✓ YES" : "✗ NO"}</div>
                                  <div><span className="text-neutral-500">Path:</span> {result.ocr.tesseract_path_used || "N/A"}</div>
                                  <div><span className="text-neutral-500">Timing:</span> {result.ocr.timing_ms}ms</div>
                                  
                                  {result.boundary && (
                                    <div className="pt-2 border-t border-neutral-800">
                                      <div className="text-neutral-400 mb-1">Boundary Detection:</div>
                                      <div><span className="text-neutral-500">Found:</span> {result.boundary.found ? "✓" : "✗"}</div>
                                      <div><span className="text-neutral-500">Confidence:</span> {Math.round((result.boundary.confidence || 0) * 100)}%</div>
                                      {result.boundary.debug_notes?.map((note, i) => (
                                        <div key={i} className="text-neutral-600 text-[10px]">{note}</div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {result.ocr.debug_notes && result.ocr.debug_notes.length > 0 && (
                                      <div className="pt-2 border-t border-neutral-800">
                                          <div className="text-neutral-500 mb-1">OCR Discovery Notes:</div>
                                          <ul className="list-none text-neutral-400 space-y-0.5">
                                              {result.ocr.debug_notes.map((note, i) => (
                                                  <li key={i}>{note}</li>
                                              ))}
                                          </ul>
                                      </div>
                                  )}
                              </div>
                          )}
                     </div>

                  </div>
                </div>
              </>
            )}

            {/* Tab Content: OCR Compare */}
            {activeTab === "compare" && result.ocr_variants && (
              <div className="space-y-6">
                {/* Explainer Note */}
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 text-sm text-blue-200">
                  ℹ️ <strong>Best variant</strong> is chosen by highest average OCR confidence score, weighted slightly toward longer extracted text.
                </div>

                {/* Evaluation Summary Table */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
                  <h3 className="text-lg font-semibold mb-4 text-emerald-400">Evaluation Summary</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-700">
                          <th className="text-left py-2 px-3 text-neutral-400">Variant</th>
                          <th className="text-right py-2 px-3 text-neutral-400">Confidence</th>
                          <th className="text-right py-2 px-3 text-neutral-400">Characters</th>
                          <th className="text-right py-2 px-3 text-neutral-400">Time (ms)</th>
                          <th className="text-center py-2 px-3 text-neutral-400">Best</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.ocr_variants.map((variant) => (
                          <tr key={variant.name} className="border-b border-neutral-800 hover:bg-neutral-800/50">
                            <td className="py-3 px-3 font-medium">{variantLabels[variant.name] || variant.name}</td>
                            <td className="py-3 px-3 text-right">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                variant.confidence > 0.7 ? "bg-emerald-900/30 text-emerald-400" :
                                variant.confidence > 0.4 ? "bg-yellow-900/30 text-yellow-400" :
                                "bg-red-900/30 text-red-400"
                              }`}>
                                {Math.round(variant.confidence * 100)}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right text-neutral-300">{variant.char_count}</td>
                            <td className="py-3 px-3 text-right text-neutral-400">{variant.timing_ms}</td>
                            <td className="py-3 px-3 text-center">
                              {result.best_variant === variant.name && (
                                <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded">
                                  BEST
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3-Column Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {result.ocr_variants.map((variant) => (
                    <div 
                      key={variant.name}
                      className={`bg-neutral-900 border rounded-xl p-4 shadow-lg transition ${
                        result.best_variant === variant.name
                          ? "border-emerald-500"
                          : "border-neutral-800"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-semibold text-neutral-100">
                          {variantLabels[variant.name] || variant.name}
                        </h4>
                        {result.best_variant === variant.name && (
                          <span className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold rounded">
                            BEST
                          </span>
                        )}
                      </div>
                      
                      <div className="flex gap-2 mb-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          variant.confidence > 0.7 ? "bg-emerald-900/30 text-emerald-400" :
                          variant.confidence > 0.4 ? "bg-yellow-900/30 text-yellow-400" :
                          "bg-red-900/30 text-red-400"
                        }`}>
                          {Math.round(variant.confidence * 100)}%
                        </span>
                        <span className="text-xs text-neutral-500">{variant.char_count} chars</span>
                        <span className="text-xs text-neutral-600">{variant.timing_ms}ms</span>
                      </div>
                      
                      <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs font-mono h-48 overflow-y-auto custom-scrollbar">
                        {expandedVariant === variant.name ? 
                          variant.text_full || <span className="text-neutral-600">No text</span> :
                          variant.text_preview || <span className="text-neutral-600">No text</span>
                        }
                      </div>
                      
                      {variant.text_full.length > 500 && (
                        <button
                          onClick={() => setExpandedVariant(
                            expandedVariant === variant.name ? null : variant.name
                          )}
                          className="text-xs text-emerald-400 hover:text-emerald-300 mt-2"
                        >
                          {expandedVariant === variant.name ? "Show less" : "Show more..."}
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          setOcrText(variant.text_full);
                          setActiveTab("scan");
                        }}
                        className="w-full mt-3 py-2 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                      >
                        Use This Text
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab Content: Debug Overlays */}
            {activeTab === "debug" && (
              <div className="space-y-6">
                {result.debug_overlays ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Glare Overlay */}
                    {result.debug_overlays.glare_overlay && (
                      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
                        <h3 className="text-lg font-semibold mb-4 text-amber-400">🔆 Glare Detection</h3>
                        <div className="rounded-lg overflow-hidden border border-neutral-700 bg-black">
                          <img
                            src={result.debug_overlays.glare_overlay}
                            alt="Glare Overlay"
                            className="w-full h-auto"
                          />
                        </div>
                        <p className="text-xs text-neutral-500 mt-2">
                          <span className="text-neutral-400">Method:</span> HSV brightness threshold + connected components<br/>
                          Red areas indicate detected glare/reflections. Yellow contours outline glare boundaries.
                        </p>
                      </div>
                    )}

                    {/* Edge Overlay */}
                    {result.debug_overlays.edge_overlay && (
                      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-lg">
                        <h3 className="text-lg font-semibold mb-4 text-green-400">📐 Edge Detection</h3>
                        <div className="rounded-lg overflow-hidden border border-neutral-700 bg-black">
                          <img
                            src={result.debug_overlays.edge_overlay}
                            alt="Edge Overlay"
                            className="w-full h-auto"
                          />
                        </div>
                        <p className="text-xs text-neutral-500 mt-2">
                          <span className="text-neutral-400">Method:</span> Canny edges + dilation<br/>
                          Green lines show detected edges used for document boundary detection.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center">
                    <div className="text-neutral-500 mb-4">
                      Debug overlays are not enabled.
                    </div>
                    <p className="text-sm text-neutral-600">
                      Set <code className="bg-neutral-800 px-2 py-0.5 rounded">CV_DEBUG_VIS=1</code> in <code className="bg-neutral-800 px-2 py-0.5 rounded">apps/api/.env</code> to enable debug overlays, or pass <code className="bg-neutral-800 px-2 py-0.5 rounded">include_debug_overlays=true</code> in the request.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
