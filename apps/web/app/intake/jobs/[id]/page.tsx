"use client";

import { useState, useRef, useEffect } from "react";
import AppHeader from "../../../components/AppHeader";
import AnalysisViewer, { AnalysisResult } from "../../../components/AnalysisViewer";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useParams } from "next/navigation";

export default function JobResultPage() {
  const params = useParams();
  const id = params.id as string;
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    if (id) {
       fetchJob();
    }
  }, [id]);

  const fetchJob = async () => {
    try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/intake/jobs/${id}`);
        if (!res.ok) throw new Error("Failed to fetch job");
        const data = await res.json();
        setJob(data);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  if (loading) {
      return (
          <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center">
              <Loader2 className="animate-spin text-emerald-600" size={32} />
          </div>
      );
  }

  if (error || !job) {
      return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 p-8">
            <AppHeader />
            <div className="max-w-4xl mx-auto mt-10 text-center">
                <div className="text-red-500 mb-4">❌ {error || "Job not found"}</div>
                <Link href="/intake" className="text-blue-600 hover:underline">← Back to Intake</Link>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-300">
      <AppHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto px-3 sm:px-4 md:px-6 py-8 space-y-6">
            
            <div className="flex items-center gap-4 mb-4">
                <Link href="/intake" className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Analysis Result</h1>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span className="font-mono">{job.id}</span>
                        <span>•</span>
                        <span>{new Date(job.created_at).toLocaleString()}</span>
                        <span className={`px-2 py-0.5 rounded-full capitalize ${
                            job.status === "done" ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-600"
                        }`}>
                            {job.status}
                        </span>
                    </div>
                </div>
            </div>

            {job.result ? (
                <AnalysisViewer result={job.result} />
            ) : (
                <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    <p className="text-neutral-500">Job is {job.status} but no result data available.</p>
                </div>
            )}

        </div>
      </main>
    </div>
  );
}
