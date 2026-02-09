"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

interface AnalysisResult {
  quality: QualityResult;
  ocr: OcrResult;
  preview?: {
    img_b64: string;
    is_scanned: boolean;
  };
}

export default function IntakePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [error, setError] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const fileRef = useRef<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      fileRef.current = selectedFile;
      setResult(null);
      setError("");
    }
  };

  const analyzeImage = async (mode: "basic" | "enhanced" = "basic") => {
    const targetFile = fileRef.current || file;
    if (!targetFile) return;

    if (mode === "enhanced") {
      setRerunning(true);
    } else {
      setAnalyzing(true);
    }
    setError("");

    const formData = new FormData();
    formData.append("file", targetFile);
    formData.append("ocr_engine", "tesseract");
    formData.append("ocr_mode", mode);
    formData.append("return_preview", mode === "basic" ? "true" : "false");

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${API_BASE}/intake/document`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Upload failed");
      }

      const data: AnalysisResult = await res.json();
      
      if (mode === "enhanced" && result) {
        // Keep existing preview, just update OCR
        setResult({
          ...result,
          ocr: data.ocr
        });
      } else {
        setResult(data);
      }
      setOcrText(data.ocr.text);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
      setRerunning(false);
    }
  };

  const sendToChat = () => {
    if (!ocrText) return;
    localStorage.setItem("intake_text", ocrText);
    router.push("/chat");
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 flex flex-col items-center">
      <div className="max-w-3xl w-full space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Document Intake
            </h1>
            <div className="text-xs text-neutral-600 font-mono mt-1">
                API: {process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                        <div className="mt-2 text-xs font-mono bg-neutral-950 p-3 rounded border border-neutral-800 overflow-x-auto">
                            <div className="mb-1"><span className="text-neutral-500">Engine:</span> {result.ocr.engine}</div>
                            <div className="mb-1"><span className="text-neutral-500">Mode:</span> {result.ocr.mode || "basic"}</div>
                            <div className="mb-1"><span className="text-neutral-500">Found:</span> {result.ocr.tesseract_found ? "✓ YES" : "✗ NO"}</div>
                            <div className="mb-1"><span className="text-neutral-500">Path:</span> {result.ocr.tesseract_path_used || "N/A"}</div>
                            <div className="mb-1"><span className="text-neutral-500">Timing:</span> {result.ocr.timing_ms}ms</div>
                            {result.ocr.debug_notes && result.ocr.debug_notes.length > 0 && (
                                <div className="mt-2">
                                    <div className="text-neutral-500 mb-1">Discovery Notes:</div>
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
        )}
      </div>
    </div>
  );
}
