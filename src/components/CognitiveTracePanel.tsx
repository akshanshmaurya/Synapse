import { useEffect, useState, useRef } from 'react';
import {
    Activity, Brain, Database, FileText, HardDrive,
    Terminal, ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react';
import { API_URL } from '@/config/env';
import ErrorBoundary from './ErrorBoundary';

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface TraceDetails {
    strategy?: string;
    tone?: string;
    pacing?: string;
    focus_concepts?: string[];
    clarity_score?: number;
    line_count?: number;
    char_count?: number;
    [key: string]: unknown;
}

interface Trace {
    trace_id: string;
    request_id: string;
    agent: string;
    action: string;
    details: TraceDetails | null;
    timestamp: string;
    input_summary?: string;
    decision?: string;
    reasoning?: string;
    output_summary?: string;
}

interface CognitiveTracePanelProps {
    sessionId?: string | null;
}

/* ──────────────────────────────────────────────
   Agent styling helpers
   ────────────────────────────────────────────── */

const agentConfig: Record<string, {
    icon: typeof Brain;
    color: string;
    border: string;
    label: string;
}> = {
    Planner: {
        icon: Brain,
        color: 'text-blue-400',
        border: 'border-blue-500 bg-blue-500/8 shadow-[0_0_10px_rgba(59,130,246,0.15)]',
        label: 'PLANNER',
    },
    Executor: {
        icon: FileText,
        color: 'text-emerald-400',
        border: 'border-emerald-500 bg-emerald-500/8 shadow-[0_0_10px_rgba(34,197,94,0.15)]',
        label: 'EXECUTOR',
    },
    Evaluator: {
        icon: Activity,
        color: 'text-purple-400',
        border: 'border-purple-500 bg-purple-500/8 shadow-[0_0_10px_rgba(168,85,247,0.15)]',
        label: 'EVALUATOR',
    },
    Memory: {
        icon: Database,
        color: 'text-amber-400',
        border: 'border-amber-500 bg-amber-500/8 shadow-[0_0_10px_rgba(234,179,8,0.15)]',
        label: 'MEMORY',
    },
    Persistence: {
        icon: HardDrive,
        color: 'text-red-400',
        border: 'border-red-500 bg-red-500/8 shadow-[0_0_10px_rgba(239,68,68,0.15)]',
        label: 'PERSISTENCE',
    },
};

const getConfig = (agent: string) =>
    agentConfig[agent] ?? {
        icon: Terminal,
        color: 'text-gray-300',
        border: 'border-gray-600 bg-gray-600/8',
        label: agent.toUpperCase(),
    };

/* ──────────────────────────────────────────────
   TraceCard — Expandable single trace entry
   ────────────────────────────────────────────── */

function TraceCard({ trace }: { trace: Trace }) {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const cfg = getConfig(trace.agent);
    const AgentIcon = cfg.icon;

    const isDbWrite = trace.action.includes('Saved') || trace.action.includes('Updated') || trace.action.includes('Written');
    const isDbRead  = trace.action.includes('Fetched') || trace.action.includes('Loaded') || trace.action.includes('Assembled');

    const copyRaw = () => {
        const raw = JSON.stringify(trace, null, 2);
        navigator.clipboard.writeText(raw).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className={`rounded-lg border ${cfg.border} transition-all`}>
            {/* Header row — always visible */}
            <button
                className="w-full text-left p-2.5 flex items-center gap-2"
                onClick={() => setExpanded(p => !p)}
            >
                <AgentIcon size={13} className={cfg.color} />
                <span className={`font-bold tracking-wider text-[10px] ${cfg.color}`}>
                    {cfg.label}
                </span>

                {/* Operation badges */}
                {isDbWrite && (
                    <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-bold animate-pulse">
                        DB WRITE
                    </span>
                )}
                {isDbRead && (
                    <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">
                        DB READ
                    </span>
                )}

                <span className="text-[10px] text-gray-500 ml-auto font-mono shrink-0">
                    {new Date(trace.timestamp).toLocaleTimeString(undefined, {
                        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                </span>
                {expanded
                    ? <ChevronUp size={12} className="text-gray-500 shrink-0" />
                    : <ChevronDown size={12} className="text-gray-500 shrink-0" />
                }
            </button>

            {/* Action label */}
            <div className="px-2.5 pb-2 text-white text-[11px] font-semibold leading-tight">
                {trace.action}
            </div>

            {/* Summary line — always visible (collapsed) */}
            {!expanded && (trace.decision || trace.output_summary) && (
                <div className="px-2.5 pb-2 pl-4 border-l border-gray-700/60 ml-2.5 mr-2.5 mb-1">
                    <p className="text-gray-400 text-[10px] truncate">
                        {trace.decision ?? trace.output_summary}
                    </p>
                </div>
            )}

            {/* Expanded detail */}
            {expanded && (
                <div className="px-2.5 pb-2.5 space-y-2 border-t border-gray-800/60 pt-2 mx-1">

                    {/* Input */}
                    {trace.input_summary && (
                        <div>
                            <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Input</span>
                            <p className="text-gray-300 text-[10px] mt-0.5 leading-relaxed">{trace.input_summary}</p>
                        </div>
                    )}

                    {/* Decision */}
                    {trace.decision && (
                        <div>
                            <span className="text-[9px] text-blue-400 font-semibold uppercase tracking-wider">Decision</span>
                            <p className="text-white text-[10px] mt-0.5 leading-relaxed font-medium">{trace.decision}</p>
                        </div>
                    )}

                    {/* Reasoning */}
                    {trace.reasoning && (
                        <div>
                            <span className="text-[9px] text-amber-400 font-semibold uppercase tracking-wider">Reasoning</span>
                            <p className="text-gray-300 text-[10px] mt-0.5 leading-relaxed">{trace.reasoning}</p>
                        </div>
                    )}

                    {/* Outcome */}
                    {trace.output_summary && (
                        <div>
                            <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider">Outcome</span>
                            <p className="text-gray-300 text-[10px] mt-0.5 leading-relaxed">{trace.output_summary}</p>
                        </div>
                    )}

                    {/* Details object — shown when no rich fields are present */}
                    {!trace.decision && !trace.reasoning && !trace.output_summary && trace.details && (
                        <div>
                            <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">Details</span>
                            <pre className="text-gray-400 text-[9px] mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                                {JSON.stringify(trace.details, null, 2)}
                            </pre>
                        </div>
                    )}

                    {/* Request ID */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-800/40">
                        <span className="text-[9px] text-gray-600 font-mono">
                            req·{trace.request_id.slice(0, 8)}
                        </span>
                        <button
                            onClick={copyRaw}
                            className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            {copied
                                ? <><Check size={10} className="text-emerald-400" /> copied</>
                                : <><Copy size={10} /> copy raw</>
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ──────────────────────────────────────────────
   Main Panel
   ────────────────────────────────────────────── */

function CognitiveTracePanelInner({ sessionId }: CognitiveTracePanelProps) {
    const [traces, setTraces] = useState<Trace[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [liveCount, setLiveCount] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const prevCountRef = useRef(0);

    useEffect(() => {
        if (!isOpen) return;

        const fetchTraces = async () => {
            try {
                const params = new URLSearchParams({ limit: '30' });
                if (sessionId) params.set('session_id', sessionId);

                const res = await fetch(`${API_URL}/api/traces/?${params}`, {
                    credentials: 'include',
                });

                if (!res.ok) return;

                const data: Trace[] = await res.json();
                setTraces(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(data)) {
                        // Count new entries since last fetch
                        const newCount = data.length - prevCountRef.current;
                        if (newCount > 0) setLiveCount(c => c + newCount);
                        prevCountRef.current = data.length;
                        return data;
                    }
                    return prev;
                });
            } catch {
                // silently ignore fetch errors — non-critical panel
            }
        };

        const interval = setInterval(fetchTraces, 2000);
        fetchTraces();
        return () => clearInterval(interval);
    }, [isOpen, sessionId]);

    // Auto-scroll to bottom when new traces arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0; // newest first
        }
    }, [traces.length]);

    if (!isOpen) {
        return (
            <button
                onClick={() => { setIsOpen(true); setLiveCount(0); }}
                className="fixed bottom-4 right-4 bg-black/80 backdrop-blur-md text-[#5C6B4A] p-3 rounded-full border border-[#5C6B4A]/30 shadow-lg hover:border-[#5C6B4A] hover:bg-black/90 transition-all z-50 group"
                title="Open AI pipeline traces"
            >
                <Activity size={20} className="group-hover:scale-110 transition-transform" />
                {liveCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                        {liveCount > 9 ? '9+' : liveCount}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-[420px] max-h-[640px] flex flex-col bg-[#0D0D0D]/95 backdrop-blur-xl border border-[#5C6B4A]/30 rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs">

            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#5C6B4A]/20 bg-[#5C6B4A]/8 shrink-0">
                <div className="flex items-center gap-2">
                    <Terminal size={13} className="text-[#5C6B4A]" />
                    <span className="text-[#5C6B4A] font-bold tracking-widest text-[10px]">
                        AI PIPELINE TRACES
                    </span>
                    <span className="text-[9px] text-gray-600 font-mono ml-1">
                        [{traces.length}]
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[9px] text-emerald-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        LIVE
                    </span>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-gray-500 hover:text-white transition-colors p-0.5"
                    >
                        <ChevronDown size={15} />
                    </button>
                </div>
            </div>

            {/* Agent legend */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 border-b border-gray-800/50 bg-black/30 shrink-0 flex-wrap">
                {Object.entries(agentConfig).map(([name, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                        <span key={name} className={`flex items-center gap-1 text-[9px] ${cfg.color}`}>
                            <Icon size={10} />
                            {name}
                        </span>
                    );
                })}
            </div>

            {/* Trace list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2" ref={scrollRef}>
                {traces.length === 0 ? (
                    <div className="text-gray-600 text-center py-8 text-[11px]">
                        <Terminal size={20} className="mx-auto mb-2 opacity-30" />
                        Waiting for pipeline events...
                        <p className="text-[10px] mt-1 text-gray-700">Send a message to start tracing.</p>
                    </div>
                ) : (
                    traces.map(trace => <TraceCard key={trace.trace_id} trace={trace} />)
                )}
            </div>

            {/* Footer */}
            <div className="px-3.5 py-2 bg-black/40 border-t border-gray-800/50 flex items-center justify-between shrink-0">
                <span className="text-[9px] text-gray-600">
                    {sessionId ? `session·${sessionId.slice(-8)}` : 'all sessions'}
                </span>
                <span className="text-[9px] text-gray-600">↑ newest first · click to expand</span>
            </div>
        </div>
    );
}

export default function CognitiveTracePanel(props: CognitiveTracePanelProps) {
    return (
        <ErrorBoundary fallbackTitle="Trace panel unavailable">
            <CognitiveTracePanelInner {...props} />
        </ErrorBoundary>
    );
}
