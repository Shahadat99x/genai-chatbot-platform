"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AppHeader from "../../components/AppHeader";
import { ArrowLeft, CheckCircle, AlertCircle, Clock, FileText, ChevronRight } from "lucide-react";

interface JobHistoryItem {
  id: string;
  filename: string;
  status: string;
  score_int: number;
  approval_state: string;
  created_at: string;
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<JobHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/intake/history`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setJobs(data);
    } catch (err: unknown) {
        if (err instanceof Error) {
            setError(err.message);
        } else {
            setError("An unknown error occurred");
        }
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Removed fetchHistory from outer scope to avoid dependency issues

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "failed": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "running": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      default: return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <span className="text-emerald-600 font-bold">{score}</span>;
    if (score >= 50) return <span className="text-yellow-600 font-bold">{score}</span>;
    return <span className="text-red-600 font-bold">{score}</span>;
  };

  const getApprovalBadge = (state: string) => {
    if (state === "auto_approved") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
          <CheckCircle size={10} /> Auto Approved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
        <AlertCircle size={10} /> Needs Review
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-300">
      <AppHeader />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-6">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/intake" className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition">
                <ArrowLeft size={20} />
              </Link>
              <h1 className="text-2xl font-bold">Intake History</h1>
            </div>
            <button 
              onClick={fetchHistory} 
              className="text-sm text-neutral-500 hover:text-emerald-600 transition flex items-center gap-1"
            >
              <Clock size={14} /> Refresh
            </button>
          </div>

          {loading ? (
             <div className="py-20 text-center text-neutral-400 animate-pulse">Loading history...</div>
          ) : error ? (
             <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>
          ) : jobs.length === 0 ? (
             <div className="py-20 text-center text-neutral-400">No history found.</div>
          ) : (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                  <tr>
                    <th className="px-6 py-3 font-medium">Document</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-center">Score</th>
                    <th className="px-6 py-3 font-medium">Approval</th>
                    <th className="px-6 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-medium text-neutral-900 dark:text-neutral-100">
                          <FileText size={16} className="text-neutral-400" />
                          {job.filename}
                        </div>
                        <div className="text-xs text-neutral-400 font-mono pl-6">{job.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4 text-neutral-500">
                        {new Date(job.created_at).toLocaleDateString()}
                        <div className="text-xs">{new Date(job.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-block px-2 py-0.5 rounded text-xs capitalize ${getStatusColor(job.status)}`}>
                          {job.status}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-lg">
                        {getScoreBadge(job.score_int)}
                      </td>
                      <td className="px-6 py-4">
                        {getApprovalBadge(job.approval_state)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/intake/jobs/${job.id}`}
                          className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-neutral-600 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition inline-flex items-center gap-1 text-xs font-medium"
                        >
                          View <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
