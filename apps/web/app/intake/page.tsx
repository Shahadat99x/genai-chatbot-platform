"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "../components/AppHeader";
import AnalysisViewer from "../components/AnalysisViewer";
import Link from "next/link";
import { Loader2, ExternalLink, CheckCircle } from "lucide-react";

export default function IntakePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobResult, setJobResult] = useState<any>(null);
  const [error, setError] = useState("");
  
  const fileRef = useRef<File | null>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      fileRef.current = selectedFile;
      setJobId(null);
      setJobStatus(null);
      setJobResult(null);
      setError("");
    }
  };

  const startAnalysis = async () => {
      if (!file) return;
      setAnalyzing(true);
      setError("");
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);
      // Defaults
      formData.append("ocr_engine", "tesseract");
      formData.append("ocr_mode", "enhanced");
      formData.append("return_preview", "true");
      formData.append("run_ablation", "true");
      formData.append("include_debug_overlays", "true");

      try {
          // 1. Upload & Create Job
          const res = await fetch(`${API_BASE}/intake/jobs`, {
              method: "POST",
              body: formData,
          });

          if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.detail || "Upload failed");
          }

          const data = await res.json(); // { job_id: "...", status: "queued" }
          setJobId(data.job_id);
          setJobStatus(data.status);
          pollJob(data.job_id);

      } catch (err: any) {
          setError(err.message);
          setAnalyzing(false);
      }
  };

  const pollJob = async (id: string) => {
      const pollInterval = setInterval(async () => {
          try {
              const res = await fetch(`${API_BASE}/intake/jobs/${id}`);
              if (!res.ok) throw new Error("Polling failed");
              
              const job = await res.json();
              setJobStatus(job.status);
              
              if (job.status === "done") {
                  clearInterval(pollInterval);
                  setJobResult(job.result);
                  setAnalyzing(false);
              } else if (job.status === "failed") {
                  clearInterval(pollInterval);
                  setError(job.error || "Job failed");
                  setAnalyzing(false);
              }
          } catch (err) {
              console.error("Poll Error", err);
              // Don't clear interval immediately, might be transient network issue
          }
      }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-300">
      <AppHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl w-full mx-auto px-3 sm:px-4 md:px-6 py-8 space-y-8">

          {/* Upload Section */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center space-y-4 shadow-sm">
            <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-8 hover:border-emerald-500/50 transition bg-neutral-50 dark:bg-neutral-900/50">
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
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xl font-bold">
                  +
                </div>
                <span className="text-lg font-medium text-neutral-800 dark:text-neutral-100">
                  {file ? file.name : "Click to upload a document"}
                </span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  Supports JPG, PNG (Max 10MB)
                </span>
              </label>
            </div>

            <button
              onClick={startAnalysis}
              disabled={!file || analyzing || (!!jobStatus && jobStatus !== 'failed' && jobStatus !== 'done')}
              className={`w-full py-3 rounded-xl font-semibold transition-all transform active:scale-[0.98] ${
                !file || analyzing
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
              }`}
            >
              {analyzing ? "Processing..." : "Analyze Document (Async)"}
            </button>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-200 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Job Status Card */}
          {jobId && (
              <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between mb-4">
                      <div>
                          <h3 className="text-lg font-bold">Job Status</h3>
                          <div className="font-mono text-xs text-neutral-500">{jobId}</div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 capitalize ${
                             jobStatus === "done" ? "bg-emerald-100 text-emerald-700" :
                             jobStatus === "failed" ? "bg-red-100 text-red-700" :
                             "bg-blue-100 text-blue-700"
                        }`}>
                          {jobStatus === "running" && <Loader2 className="animate-spin" size={14} />}
                          {jobStatus === "done" && <CheckCircle size={14} />}
                          {jobStatus}
                      </div>
                  </div>

                  {jobStatus === "done" && (
                       <Link 
                         href={`/intake/jobs/${jobId}`}
                         className="block w-full text-center py-2.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-emerald-600 dark:text-emerald-400 font-semibold transition"
                       >
                           View Full Permalink Report <ExternalLink size={14} className="inline ml-1"/>
                       </Link>
                  )}
              </div>
          )}

          {/* Inline Result (Optional, for convenience) */}
          {jobResult && (
             <div className="mt-8">
                 <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-bold">Reference Preview</h2>
                    <span className="text-xs text-neutral-500">(Also available at permalink above)</span>
                 </div>
                 <AnalysisViewer result={jobResult} />
             </div>
          )}

        </div>
      </main>
    </div>
  );
}
