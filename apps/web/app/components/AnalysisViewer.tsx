"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, Save, ExternalLink } from "lucide-react";

// ─── Interfaces ───

export interface CornerPoint {
  x: number;
  y: number;
}

export interface BoundaryResult {
  found: boolean;
  corners: CornerPoint[] | null;
  confidence: number;
  debug_notes: string[];
}

export interface ScanMeta {
  used_auto_corners: boolean;
  corners_used: CornerPoint[] | null;
  scan_warp_success: boolean;
  scan_error: string | null;
}

export interface QualityResult {
  score: number;
  issues: string[];
  tips: string[];
  doc_confidence: number;
}

export interface OcrResult {
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

export interface OcrVariant {
  name: string;
  confidence: number;
  text_preview: string;
  text_full: string;
  timing_ms: number;
  char_count: number;
}

export interface DebugOverlays {
  glare_overlay?: string;
  edge_overlay?: string;
}

export interface OriginalPreview {
  img_b64: string;
  width: number;
  height: number;
}

export interface AnalysisResult {
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

interface AnalysisViewerProps {
  result: AnalysisResult;
  imgFile_optional?: File | null; // For corner adjustment context if needed (not implemented in read-only)
  allowSave?: boolean;
}

export default function AnalysisViewer({ result, allowSave = true }: AnalysisViewerProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "scan" | "compare" | "debug">("summary");
  const [savingExample, setSavingExample] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  // For image scaling logic if needed
  const [displayScale, setDisplayScale] = useState({ scaleX: 1, scaleY: 1 });
  const originalImgRef = useRef<HTMLImageElement>(null);
  
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

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const saveExample = async () => {
    if (!result) return;
    setSavingExample(true);
    setSavedPath(null);
    try {
      const res = await fetch(`${API_BASE}/cv/save-example`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intake_result: result }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setSavedPath(data.folder_path.split(/[\\/]/).pop());
    } catch (err) {
      console.error(err);
    } finally {
      setSavingExample(false);
    }
  };

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

  const tabCls = (t: typeof activeTab) =>
    `px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
      activeTab === t
        ? "bg-neutral-100 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500 dark:border-emerald-400"
        : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
    }`;

  const variantLabels: Record<string, string> = {
    raw: "Raw (Original)",
    scan: "Scanned",
    scan_enhanced: "Scan + Enhanced"
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2 overflow-x-auto">
        <button onClick={() => setActiveTab("summary")} className={tabCls("summary")}>📋 Summary</button>
        <button onClick={() => setActiveTab("scan")} className={tabCls("scan")}>📄 Scan &amp; OCR</button>
        <button onClick={() => setActiveTab("compare")} className={tabCls("compare")}>📊 OCR Compare</button>
        <button onClick={() => setActiveTab("debug")} className={tabCls("debug")}>🔍 Debug</button>
        
        <div className="ml-auto flex items-center gap-2">
           {allowSave && (
            <button
                onClick={saveExample}
                disabled={savingExample}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 whitespace-nowrap ${
                savingExample 
                    ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
                    : "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-700"
                }`}
            >
                <Save size={14} />
                {savingExample ? "Saving..." : "Save Example"}
            </button>
           )}
          <button
            onClick={downloadResults}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition flex items-center gap-2 whitespace-nowrap"
          >
            <Download size={14} /> JSON
          </button>
        </div>
      </div>

      {savedPath && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2 text-sm text-green-700 dark:text-green-300 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          ✓ Saved to: <code className="bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded text-xs font-mono">{savedPath}</code>
        </div>
      )}

      {/* ── Tab: Summary ── */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Original Input</h3>
                {result.quality?.issues && result.quality.issues.length > 0 && (
                  <div className="flex gap-2">
                    {result.quality.issues.slice(0, 2).map(issue => (
                      <span key={issue} className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 capitalize">
                        {issue.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-neutral-100 dark:bg-black rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden h-64 flex items-center justify-center relative group">
                {result.original_preview ? (
                  <img src={result.original_preview.img_b64} className="max-w-full max-h-full object-contain" alt="Original" />
                ) : <span className="text-neutral-400 dark:text-neutral-600 text-xs">No preview</span>}
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white">
                  {result.original_preview?.width}x{result.original_preview?.height}px
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Scanned Corrected</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Perspective Warp</span>
              </div>
              <div className="bg-neutral-100 dark:bg-black rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden h-64 flex items-center justify-center relative">
                {result.preview ? (
                  <img src={result.preview.img_b64} className="max-w-full max-h-full object-contain" alt="Scanned" />
                ) : <span className="text-neutral-400 dark:text-neutral-600 text-xs">No preview</span>}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Extracted Content</h3>
              <button 
                onClick={() => setActiveTab("scan")}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300"
              >
                Edit / Copy Text →
              </button>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-950 rounded-lg p-3 text-xs font-mono text-neutral-700 dark:text-neutral-300 max-h-32 overflow-hidden relative">
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-neutral-50 dark:from-neutral-950 to-transparent"></div>
              {result.ocr.text || <span className="text-neutral-400 dark:text-neutral-600 italic">No text extracted...</span>}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Scan ── */}
      {activeTab === "scan" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
                 {/* Preview */}
                 <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 text-emerald-600 dark:text-emerald-400">Scan Preview</h3>
                    {result.preview?.img_b64 ? (
                        <div className="rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 aspect-[3/4] bg-neutral-100 dark:bg-black">
                        <img
                            src={result.preview.img_b64}
                            alt="Scanned Document"
                            className="w-full h-full object-contain"
                        />
                        </div>
                    ) : (
                        <div className="h-64 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center text-neutral-400 dark:text-neutral-500">
                        No preview available
                        </div>
                    )}
                 </div>

                 {/* Quality */}
                 <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">Quality</h3>
                        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                        result.quality.score > 80 ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" :
                        result.quality.score > 50 ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
                        "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                        }`}>
                        Score: {Math.round(result.quality.score)}
                        </div>
                    </div>
                 </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">Full Text</h3>
                    <span className="text-xs text-neutral-500">{result.ocr.mode} • {Math.round(result.ocr.confidence * 100)}% conf</span>
                </div>
                <textarea 
                    readOnly 
                    className="flex-1 w-full p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg text-sm font-mono border border-neutral-200 dark:border-neutral-800 focus:outline-none resize-none"
                    value={result.ocr.text}
                    rows={20}
                />
            </div>
        </div>
      )}

      {/* ── Tab: Compare ── */}
      {activeTab === "compare" && result.ocr_variants && (
         <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">OCR Performance Comparison</h3>
            <div className="space-y-3">
            {result.ocr_variants.map((v) => {
                const isBest = result.best_variant === v.name;
                const widthPct = Math.max(5, Math.min(100, v.confidence * 100));
                
                return (
                <div key={v.name} className="flex items-center gap-4 text-xs">
                    <div className="w-24 font-medium text-neutral-600 dark:text-neutral-300 shrink-0 flex items-center gap-2">
                    {isBest && <span className="text-emerald-500">★</span>}
                    {variantLabels[v.name] || v.name}
                    </div>
                    <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden relative">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${isBest ? 'bg-emerald-500' : 'bg-neutral-400 dark:bg-neutral-600'}`}
                        style={{ width: `${widthPct}%` }}
                    />
                    </div>
                    <div className="w-48 flex items-center justify-end gap-3 shrink-0 font-mono text-neutral-400 dark:text-neutral-500">
                    <span className={isBest ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""}>
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

      {/* ── Tab: Debug ── */}
      {activeTab === "debug" && (
         <div className="space-y-4">
             <div className="p-4 bg-neutral-100 dark:bg-neutral-900 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre">
                 {JSON.stringify(result, null, 2)}
             </div>
         </div>
      )}

    </div>
  );
}
