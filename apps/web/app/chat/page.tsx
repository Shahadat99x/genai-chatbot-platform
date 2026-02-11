"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Play, Info, AlertTriangle, Phone, MapPin } from "lucide-react";
import AppHeader from "../components/AppHeader";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Citation {
  id: string;
  title: string;
  org: string;
  source_type: string;
  snippet: string;
  source_url?: string;
  date_accessed?: string;
}

interface LocalResource {
  id: string;
  name: string;
  address: string;
  phone?: string;
  sector?: number;
  type: string;
  notes?: string;
  maps_url?: string;
}

interface TriageResult {
  urgency: string;
  symptom_tags: string[];
  recommended_action: string;
  follow_up_questions: string[];
  reason: string;
}

interface ChatResponse {
  assistant_message: string;
  urgency: string;
  safety_flags: string[];
  recommendations: string[];
  citations?: Citation[];
  intent?: string;
  lock_state?: string;
  red_flag_detected?: boolean;
  local_resources?: LocalResource[];
  local_context?: any;
  triage_result?: TriageResult;
  response_kind?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  meta?: ChatResponse;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SCENARIOS = [
  { key: "chitchat",  emoji: "👋", label: "Chitchat",            msg: "Hello",                         desc: "Tests intent routing (Phase 1)" },
  { key: "fever",     emoji: "🌡️", label: "Fever (Grounded)",   msg: "I have a fever for 1 day",      desc: "Tests RAG + citations (Phase 3-4)" },
  { key: "rash",      emoji: "⚠️",  label: "Rash (Unknown)",     msg: "I have a rash",                 desc: "Tests grounding refusal (Phase 4)" },
  { key: "stroke",    emoji: "🚑", label: "Emergency",           msg: "I have stroke symptoms",        desc: "Tests safety lock + 112 (Phase 1-2)" },
  { key: "logistics", emoji: "📍", label: "Logistics",           msg: "Emergency number in Bucharest", desc: "Tests local resources (Phase 2)" },
] as const;

const URGENCY_STYLE: Record<string, string> = {
  emergency: "bg-red-600 text-white animate-pulse",
  urgent:    "bg-amber-500 text-white",
  gp:        "bg-yellow-400 text-yellow-950",
  self_care: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300",
  unknown:   "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300",
};

const ORG_STYLE: Record<string, string> = {
  NHS:  "bg-blue-600 text-white",
  WHO:  "bg-cyan-700 text-white",
  CDC:  "bg-indigo-600 text-white",
  NICE: "bg-violet-600 text-white",
};

// ─── Sub-components ──────────────────────────────────────────────────────────


function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 tracking-wide uppercase select-none whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

// ─── Markdown (with citation linking) ────────────────────────────────────────

function AssistantMarkdown({ children }: { children: string }) {
  // Pre-process: [1], [2] -> [[1]](#citation-1), [[2]](#citation-2)
  // This creates standard markdown links that ReactMarkdown can render.
  const processedContent = children.replace(/\[(\d+)\]/g, " **[[$1]](#citation-$1)**");

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2 text-neutral-900 dark:text-neutral-100">{children}</h2>,
        h2: ({ children }) => <h3 className="text-base font-bold mt-3 mb-1.5 text-neutral-900 dark:text-neutral-100">{children}</h3>,
        h3: ({ children }) => <h4 className="text-sm font-bold mt-2 mb-1 text-neutral-800 dark:text-neutral-200">{children}</h4>,
        h4: ({ children }) => <h5 className="text-sm font-semibold mt-2 mb-1 text-neutral-800 dark:text-neutral-200">{children}</h5>,
        p:  ({ children }) => <p  className="mb-2 last:mb-0 text-neutral-800 dark:text-neutral-200 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1 text-neutral-800 dark:text-neutral-200">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-neutral-800 dark:text-neutral-200">{children}</ol>,
        li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-bold text-neutral-900 dark:text-white">{children}</strong>,
        em:     ({ children }) => <em className="italic">{children}</em>,
        a: ({ href, children }) => {
          const isCitation = href?.startsWith("#citation-");
          
          const handleClick = (e: React.MouseEvent) => {
            if (isCitation && href) {
              e.preventDefault();
              const id = href.slice(1);
              const el = document.getElementById(id);
              if (el) {
                // Open the details panel if it's closed (hacky but effective)
                const details = el.closest("details");
                if (details && !details.open) details.open = true;

                el.scrollIntoView({ behavior: "smooth", block: "center" });
                
                // Flash highlight
                el.classList.add("ring-2", "ring-blue-500", "ring-offset-2", "dark:ring-offset-neutral-900");
                setTimeout(() => el.classList.remove("ring-2", "ring-blue-500", "ring-offset-2", "dark:ring-offset-neutral-900"), 2000);
              }
            }
          };

          return (
            <a 
              href={href} 
              onClick={handleClick}
              target={isCitation ? undefined : "_blank"}
              rel={isCitation ? undefined : "noopener noreferrer"}
              className={`transition ${isCitation 
                ? "text-blue-600 dark:text-blue-400 no-underline bg-blue-50 dark:bg-blue-900/30 px-1 rounded-sm text-[10px] align-super font-bold cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800" 
                : "text-blue-600 dark:text-blue-400 underline decoration-blue-300 dark:decoration-blue-700 hover:decoration-blue-600 dark:hover:decoration-blue-400"}`}
            >
              {children}
            </a>
          );
        },
        code: ({ children }) => (
          <code className="bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded px-1 py-0.5 text-[13px] font-mono">{children}</code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-blue-300 dark:border-blue-700 pl-3 italic text-neutral-600 dark:text-neutral-400 my-2">{children}</blockquote>
        ),
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function EmergencyBanner({ meta, onSafe }: { meta: ChatResponse; onSafe: () => void }) {
  const isLocked = meta.lock_state === "awaiting_confirmation";
  return (
    <div className="rounded-xl border-2 border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950 p-4 shadow-md">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none animate-pulse">🚨</span>
        <div className="flex-1 min-w-0">
          <p className="text-red-800 dark:text-red-200 font-bold text-base">
            EMERGENCY — Call 112 or go to ER now
          </p>
          {isLocked && (
            <p className="text-red-700 dark:text-red-300 text-xs mt-1">
              Conversation locked for safety. If this is a false alarm:
            </p>
          )}
        </div>
      </div>
      {isLocked && (
        <button
          onClick={onSafe}
          className="mt-3 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-semibold py-2.5 text-sm transition-all shadow"
        >
          ✅ I am safe / False Alarm
        </button>
      )}
    </div>
  );
}

function LocalResources({ resources, context }: { resources: LocalResource[]; context?: any }) {
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 space-y-2">
      <p className="text-red-800 dark:text-red-200 font-bold text-sm flex items-center gap-1.5">
        🏥 {context?.mode === "emergency" ? "Emergency Resources" : "Nearby Resources"}
        {context?.city && <span className="font-normal text-red-600 dark:text-red-400 text-xs">({context.city})</span>}
      </p>
      <div className="grid gap-2">
        {resources.map((r) => (
          <div key={r.id} className="rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-neutral-900 p-3 text-sm shadow-sm">
            <div className="flex justify-between items-start gap-2 flex-wrap">
              <span className="font-bold text-red-900 dark:text-red-100">{r.name}</span>
              {r.sector && <Pill className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200">Sector {r.sector}</Pill>}
            </div>
            <p className="text-neutral-700 dark:text-neutral-300 text-xs mt-1">{r.address}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {r.phone && (
                <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 rounded-md bg-red-100 dark:bg-red-900 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 transition">
                  <Phone size={12} /> {r.phone}
                </a>
              )}
              {r.maps_url && (
                <a href={r.maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition">
                  <MapPin size={12} /> Map
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-neutral-400 italic text-right">Verified Local Dataset (2024)</p>
    </div>
  );
}

function SourcesPanel({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <details className="group rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 overflow-hidden">
      <summary className="cursor-pointer select-none flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
        <span className="transition-transform group-open:rotate-90 text-[10px]">▶</span>
        📚 Guidelines &amp; Sources ({citations.length})
      </summary>
      <div className="px-4 pb-3 space-y-2">
        {citations.map((c, i) => (
          <div 
            key={i} 
            id={`citation-${i + 1}`}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-xs shadow-sm transition-all duration-500"
          >
            <div className="flex justify-between items-start gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 w-5 h-5 flex items-center justify-center rounded-full font-bold text-[10px]">
                  {i + 1}
                </span>
                <Pill className={ORG_STYLE[c.org] ?? "bg-neutral-500 text-white"}>{c.org}</Pill>
                {c.source_url ? (
                  <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 dark:text-blue-400 hover:underline truncate">
                    {c.title}
                  </a>
                ) : (
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{c.title}</span>
                )}
              </div>
              <span className="text-[10px] text-neutral-400 whitespace-nowrap font-mono">{c.id?.split("#")[0]}</span>
            </div>
            {c.snippet && (
              <p className="mt-1.5 text-neutral-500 dark:text-neutral-400 italic border-l-2 border-neutral-300 dark:border-neutral-600 pl-2 line-clamp-2">
                &ldquo;{c.snippet}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function ChipsRow({ meta }: { meta: ChatResponse }) {
  const showUrgency = meta.urgency && !["chitchat", "meta", "logistics"].includes(meta.intent || "");
  const tags = meta.triage_result?.symptom_tags ?? [];
  const reason = meta.triage_result?.reason;
  if (!showUrgency && !tags.length && !reason) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2">
      {showUrgency && (
        <Pill className={`${meta.urgency === "emergency" ? "animate-pulse " : ""}${URGENCY_STYLE[meta.urgency] ?? URGENCY_STYLE.unknown}`}>
          {meta.urgency === "self_care" ? "Low Risk" : meta.urgency}
        </Pill>
      )}
      {reason && (
        <Pill className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 normal-case font-normal">
          📝 {reason}
        </Pill>
      )}
      {tags.map((t) => (
        <Pill key={t} className="bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 normal-case font-normal">
          #{t}
        </Pill>
      ))}
    </div>
  );
}

function QuickQuestions({ questions, onAsk }: { questions: string[]; onAsk: (q: string) => void }) {
  if (!questions.length) return null;
  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 p-3">
      <p className="text-xs font-bold text-blue-800 dark:text-blue-200 mb-2">❓ Quick clarifying questions:</p>
      <ul className="space-y-1">
        {questions.map((q, i) => (
          <li key={i}>
            <button onClick={() => onAsk(q)}
              className="text-left w-full text-xs text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg px-2.5 py-1.5 transition">
              • {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoSourcesWarning() {
  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 px-4 py-3 flex items-start gap-2.5">
      <AlertTriangle className="text-amber-600 dark:text-amber-500 shrink-0" size={20} />
      <p className="text-xs text-amber-800 dark:text-amber-200">
        <strong className="font-bold">No verified guidelines found</strong> for these specific symptoms. General safety advice only — please consult a doctor.
      </p>
    </div>
  );
}

// ─── Demo panel ──────────────────────────────────────────────────────────────

function DemoPanel({ open, onClose, onRun, disabled }: {
  open: boolean; onClose: () => void; onRun: (msg: string) => void; disabled: boolean;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-700 shadow-2xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Play size={16} className="text-blue-600" /> Demo Scenarios
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-lg transition">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              disabled={disabled}
              onClick={() => { onRun(s.msg); onClose(); }}
              className="w-full text-left rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 p-3 transition disabled:opacity-40 group"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                <span>{s.emoji}</span> {s.label}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">{s.desc}</p>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 font-mono truncate">&ldquo;{s.msg}&rdquo;</p>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-neutral-200 dark:border-neutral-700 text-[10px] text-neutral-400 text-center">
          Scenarios send pre-defined messages — behaviour reflects live system.
        </div>
      </div>
    </>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode] = useState("rag");
  const [sessionId] = useState(() => `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const [attachmentText, setAttachmentText] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

  useEffect(() => {
    const text = localStorage.getItem("intake_text");
    if (text) { setAttachmentText(text); localStorage.removeItem("intake_text"); }
    inputRef.current?.focus();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMsg = text.trim();
    setInput("");
    setMessages((p) => [...p, { role: "user", content: userMsg }]);
    setLoading(true);

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 30_000);

    try {
      let finalMessage = userMsg;
      if (attachmentText) finalMessage += `\n\n[ATTACHED DOCUMENT TEXT]:\n${attachmentText}`;

      const res = await fetch(`${apiBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: finalMessage, mode, session_id: sessionId }),
        signal: ctrl.signal,
      });
      if (res.ok && attachmentText) setAttachmentText("");
      clearTimeout(tid);

      if (!res.ok) {
        let msg = `API Error: ${res.status}`;
        try { const d = await res.json(); if (d.error?.message) msg = d.error.message; } catch {}
        throw new Error(msg);
      }

      const data: ChatResponse = await res.json();
      setMessages((p) => [...p, { role: "assistant", content: data.assistant_message, meta: data }]);
    } catch (e: any) {
      const msg = e.name === "AbortError"
         ? `⚠️ Timed out — is the API running at ${apiBase}?`
         : `⚠️ ${e.message || "Unknown error"}`;
      setMessages((p) => [...p, { role: "assistant", content: msg }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const isMedical = (m: ChatResponse) => !m.intent || m.intent === "medical_symptoms";
  const isEmergency = (m: ChatResponse) =>
    m.urgency === "emergency" || m.red_flag_detected || m.lock_state === "awaiting_confirmation";

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors duration-300">

      {/* ── header ─────────────────────────────────────────────────────────── */}
      <AppHeader>
        <button
          onClick={() => setDemoOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 px-3 py-1.5 text-neutral-700 dark:text-neutral-200 transition shadow-sm"
        >
          <Play size={13} className="fill-current opacity-50" />
          <span className="hidden sm:inline">Scenarios</span>
        </button>
        <button
          onClick={() => setShowDebug(!showDebug)}
          className={`p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${showDebug ? "text-blue-600" : "text-neutral-400"}`}
          title="Toggle debug info"
        >
          <Info size={18} />
        </button>
      </AppHeader>

      {/* ── demo drawer ────────────────────────────────────────────────────── */}
      <DemoPanel open={demoOpen} onClose={() => setDemoOpen(false)} onRun={send} disabled={loading} />

      {/* ── messages ───────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl w-full mx-auto px-3 sm:px-4 md:px-6 py-6 space-y-6">

          {/* welcome state */}
          {messages.length === 0 && (
            <div className="text-center py-20 space-y-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="text-6xl mb-4">🩺</div>
              <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">AI Healthcare Assistant</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
                Describe your symptoms and I&apos;ll provide safe triage advice based on trusted medical guidelines. 
                I am <strong className="text-neutral-700 dark:text-neutral-300">not</strong> a doctor.
              </p>
              <div className="flex justify-center gap-3 pt-4">
                <button onClick={() => setDemoOpen(true)} className="text-sm bg-neutral-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl font-medium hover:opacity-90 transition">
                  Try Demo Scenario
                </button>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>

              {/* ── user bubble ─────────────────────────────────────────────── */}
              {m.role === "user" && (
                <div className="max-w-[90%] sm:max-w-[75%] md:max-w-[65%] rounded-2xl rounded-br-sm bg-blue-600 px-5 py-3 text-white text-sm shadow-md">
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              )}

              {/* ── assistant bubble ────────────────────────────────────────── */}
              {m.role === "assistant" && (
                <div className="max-w-[90%] sm:max-w-[75%] md:max-w-[65%] space-y-3">

                  {/* emergency banner */}
                  {m.meta && isEmergency(m.meta) && <EmergencyBanner meta={m.meta} onSafe={() => send("I am safe")} />}

                  {/* main card */}
                  <div className="rounded-2xl rounded-bl-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-5 py-5 shadow-sm">
                    {m.meta && <ChipsRow meta={m.meta} />}
                    <div className="text-sm">
                      <AssistantMarkdown>{m.content}</AssistantMarkdown>
                    </div>
                  </div>

                  {/* auxiliary cards */}
                  {m.meta?.triage_result?.follow_up_questions && m.meta.triage_result.follow_up_questions.length > 0 && (
                    <QuickQuestions questions={m.meta.triage_result.follow_up_questions} onAsk={send} />
                  )}
                   {/* fallback recommendations */}
                  {m.meta && (m.meta.triage_result?.follow_up_questions?.length ?? 0) === 0 && (m.meta.recommendations?.length ?? 0) > 0 && (
                    <QuickQuestions questions={m.meta.recommendations} onAsk={send} />
                  )}
                  {m.meta?.local_resources && m.meta.local_resources.length > 0 && (
                    <LocalResources resources={m.meta.local_resources} context={m.meta.local_context} />
                  )}

                  {/* citations */}
                  {m.meta && isMedical(m.meta) && (
                    m.meta.citations && m.meta.citations.length > 0
                      ? <SourcesPanel citations={m.meta.citations} />
                      : m.meta.urgency !== "unknown" && m.meta.urgency !== "self_care" && <NoSourcesWarning />
                  )}

                  {/* debug */}
                  {showDebug && m.meta && (
                    <div className="p-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-[10px] font-mono text-neutral-500 overflow-x-auto">
                      {JSON.stringify({ intent: m.meta.intent, urgency: m.meta.urgency, kind: m.meta.response_kind, flags: m.meta.safety_flags }, null, 2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* loading */}
          {loading && (
            <div className="flex justify-start animate-pulse">
              <div className="rounded-2xl rounded-bl-sm border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-5 py-4 shadow-sm text-neutral-400 text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── input bar ──────────────────────────────────────────────────────── */}
      <footer className="sticky bottom-0 border-t border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 backdrop-blur shadow-[0_-2px_8px_rgba(0,0,0,0.04)] transition-colors duration-300">
        <div className="max-w-4xl w-full mx-auto px-3 sm:px-4 md:px-6 py-3 space-y-2">
          {attachmentText && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3 text-xs">
               <div className="flex-1 min-w-0">
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Document Attached</p>
                <div className="mt-1 text-neutral-600 dark:text-neutral-400 font-mono line-clamp-2">{attachmentText}</div>
              </div>
              <button onClick={() => { setAttachmentText(""); inputRef.current?.focus(); }} className="text-red-400 hover:text-red-600 p-1">✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              className="flex-1 min-w-0 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm"
              placeholder={attachmentText ? "Ask about the document..." : "Describe your symptoms..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
