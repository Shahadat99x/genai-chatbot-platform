"use client";

import { useState } from "react";

interface ChatResponse {
  assistant_message: string;
  urgency: "self_care" | "gp" | "urgent" | "emergency";
  safety_flags: string[];
  recommendations: string[];
  citations?: {
    title: string;
    source_type: string;
    snippet: string;
    source_url?: string;
  }[];
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string; meta?: ChatResponse }[]
  >([]);
  const [loading, setLoading] = useState(false);
  // Add mode state (hidden for now, defaulted to "rag" or "baseline")
  const [mode, setMode] = useState("rag"); // Default to RAG for Phase 3

  // API Base URL - shown in UI for debugging
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    // Timeout controller (30s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, mode: mode }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        // Try to read error body
        let errorMsg = `API Error: ${res.status}`;
        try {
          const errorData = await res.json();
          if (errorData.error?.message) {
            errorMsg = errorData.error.message;
          }
        } catch {}
        throw new Error(errorMsg);
      }
      const data: ChatResponse = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.assistant_message,
          meta: data,
        },
      ]);
    } catch (e: any) {
      console.error(e);
      let errorContent = `⚠️ Error: ${e.message || "Unknown error"}`;
      
      // Better message for network errors
      if (e.name === "AbortError") {
        errorContent = `⚠️ Request timed out. Is the API running at ${apiBase}?`;
      } else if (e.message === "Failed to fetch") {
        errorContent = `⚠️ Cannot reach API at ${apiBase}. Is FastAPI running on port 8000?`;
      }
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorContent },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (u?: string) => {
    if (u === "emergency") return "bg-red-600 text-white font-bold animate-pulse";
    if (u === "urgent") return "bg-orange-100 text-orange-800";
    if (u === "gp") return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-700";
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="border-b p-4 flex justify-between items-center bg-gray-50">
        <h1 className="text-xl font-bold text-gray-800">Healthcare Assistant</h1>
        <div className="text-right">
          <div className="text-sm text-gray-500">Phase 3: RAG Implementation</div>
          <div className="text-[10px] text-gray-400 font-mono">API: {apiBase}</div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col ${
              m.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {m.content}
            </div>

            {m.role === "assistant" && m.meta && (
              <div className="mt-2 text-xs text-gray-500 max-w-[80%] space-y-2">
                {/* Emergency Banner */}
                {m.meta.urgency === "emergency" && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-red-700 font-bold text-sm flex items-center gap-2">
                             🚨 EMERGENCY: Call 112 or go to ER now.
                        </p>
                    </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                   <span className={`px-2 py-0.5 rounded-full font-medium ${getUrgencyColor(m.meta.urgency)}`}>
                    Urgency: {m.meta.urgency}
                  </span>
                  {m.meta.safety_flags?.map((flag, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-700">
                          {flag}
                      </span>
                  ))}
                </div>
                {m.meta.recommendations.length > 0 && (
                  <div>
                    <p className="font-semibold text-gray-700">Recommendations:</p>
                    <ul className="list-disc pl-5">
                      {m.meta.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Citations (Phase 3) */}
                {m.meta.citations && m.meta.citations.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="font-semibold text-gray-600 mb-1 flex items-center gap-1">
                            📚 Guidelines & Sources
                        </p>
                        <ul className="space-y-2">
                            {m.meta.citations.map((cite, idx) => (
                                <li key={idx} className="bg-gray-50 p-2 rounded text-[11px] border border-gray-200">
                                    <div className="font-bold text-blue-800">
                                        [{idx+1}] {cite.title} 
                                        {cite.source_type && <span className="opacity-75 font-normal ml-1">({cite.source_type})</span>}
                                    </div>
                                    <div className="text-gray-600 mt-1 italic">"{cite.snippet}"</div>
                                     {cite.source_url && (
                                        <a href={cite.source_url} target="_blank" className="text-blue-500 hover:underline mt-1 block">
                                            Source Link
                                        </a>
                                     )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="border-t pt-1 mt-1 border-gray-200 text-gray-400 italic">
                        No sources used (General Knowledge or Safe Chit-chat)
                    </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-gray-400 text-sm">Assistant is thinking...</div>}
      </main>

      <footer className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-gray-300 p-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe your symptoms..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={sendMessage}
            disabled={loading}
          >
            Send
          </button>
        </div>
      </footer>
    </div>
  );
}
