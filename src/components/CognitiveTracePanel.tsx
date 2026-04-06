import { useEffect, useState, useRef } from 'react';
import { Activity, Brain, Database, FileText, HardDrive, Terminal, ChevronDown } from 'lucide-react';
import { API_URL } from '@/config/env';
import { useAuth } from '@/contexts/AuthContext';
import ErrorBoundary from './ErrorBoundary';

interface TraceDetails {
    strategy?: string;
    clarity_score?: number;
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

function CognitiveTracePanelInner({ sessionId }: CognitiveTracePanelProps) {
    const { user } = useAuth();
    const [traces, setTraces] = useState<Trace[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [authError, setAuthError] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Admin role check — only render the panel for admin users
    // The /api/traces endpoint is admin-only; bail early for regular users
    const isAdmin = user?.email?.endsWith('@synapse.admin') || false;

    useEffect(() => {
        if (!isOpen || !isAdmin) return;

        const fetchTraces = async () => {
            try {
                const url = sessionId
                    ? `${API_URL}/api/traces/?limit=20&session_id=${sessionId}`
                    : `${API_URL}/api/traces/?limit=20`;

                const res = await fetch(url, { credentials: "include" });

                if (res.status === 401 || res.status === 403) {
                    setAuthError(true);
                    return;
                }

                if (res.ok) {
                    const data: Trace[] = await res.json();
                    setTraces(prev => {
                        if (JSON.stringify(prev) !== JSON.stringify(data)) {
                            return data;
                        }
                        return prev;
                    });
                }
            } catch (err) {
                console.error("Trace fetch error", err);
            }
        };

        const interval = setInterval(fetchTraces, 2000);
        fetchTraces();
        return () => clearInterval(interval);
    }, [isOpen, sessionId, isAdmin]);

    // Don't render for non-admin users
    if (!isAdmin) return null;

    // Auth error state
    if (authError) return null;

    const getAgentIcon = (agent: string) => {
        switch (agent) {
            case 'Planner': return <Brain size={14} className="text-blue-400" />;
            case 'Executor': return <FileText size={14} className="text-green-400" />;
            case 'Evaluator': return <Activity size={14} className="text-purple-400" />;
            case 'Memory': return <Database size={14} className="text-yellow-400" />;
            case 'Persistence': return <HardDrive size={14} className="text-red-400" />;
            default: return <Terminal size={14} className="text-gray-400" />;
        }
    };

    const getAgentColor = (agent: string) => {
        switch (agent) {
            case 'Planner': return 'border-blue-500 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.2)]';
            case 'Executor': return 'border-green-500 bg-green-500/10 shadow-[0_0_10px_rgba(34,197,94,0.2)]';
            case 'Evaluator': return 'border-purple-500 bg-purple-500/10 shadow-[0_0_10px_rgba(168,85,247,0.2)]';
            case 'Memory': return 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.2)]';
            case 'Persistence': return 'border-red-500 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
            default: return 'border-gray-500 bg-gray-500/10';
        }
    };

    const getAgentTextColor = (agent: string) => {
        switch (agent) {
            case 'Planner': return 'text-blue-400';
            case 'Executor': return 'text-green-400';
            case 'Evaluator': return 'text-purple-400';
            case 'Memory': return 'text-yellow-400';
            case 'Persistence': return 'text-red-400';
            default: return 'text-gray-300';
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-black/80 backdrop-blur-md text-[#5C6B4A] p-3 rounded-full border border-[#5C6B4A]/30 shadow-lg hover:border-[#5C6B4A] transition-all z-50 group"
            >
                <Activity size={20} className="group-hover:text-[#8B8178]" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-96 max-h-[600px] flex flex-col bg-black/90 backdrop-blur-xl border border-[#5C6B4A]/30 rounded-lg shadow-2xl z-50 overflow-hidden font-mono text-xs">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#5C6B4A]/20 bg-[#5C6B4A]/10">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-[#5C6B4A]" />
                    <span className="text-[#5C6B4A] font-bold tracking-wider">SYSTEM ACTIVITY</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-[#5C6B4A] hover:text-white">
                    <ChevronDown size={16} />
                </button>
            </div>

            {/* Logs */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
                {traces.length === 0 && (
                    <div className="text-gray-500 text-center py-4">Waiting for system logs...</div>
                )}

                {traces.map((trace) => (
                    <div key={trace.trace_id} className={`p-2 rounded border ${getAgentColor(trace.agent)} transition-all hover:opacity-100 opacity-90`}>
                        <div className="flex items-center gap-2 mb-1">
                            {getAgentIcon(trace.agent)}
                            <span className={`font-bold tracking-wider ${getAgentTextColor(trace.agent)}`}>
                                {trace.agent.toUpperCase()}
                            </span>
                            {(trace.agent === 'Persistence' || trace.agent === 'Memory') && (
                                <>
                                    {(trace.action.includes('Saved') || trace.action.includes('Updated')) && (
                                        <span className="text-[10px] bg-red-500/20 text-red-300 px-1 rounded ml-2 font-bold animate-pulse">
                                            DB WRITE
                                        </span>
                                    )}
                                    {(trace.action.includes('Fetched') || trace.action.includes('Loaded')) && (
                                        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1 rounded ml-2 font-bold">
                                            DB READ
                                        </span>
                                    )}
                                </>
                            )}
                            <span className="text-[10px] text-gray-400 ml-auto font-mono">
                                {new Date(trace.timestamp).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                        </div>
                        <div className="text-white mb-2 font-bold text-sm tracking-tight">{trace.action}</div>

                        <div className="mt-1 pl-2 border-l border-[#5C6B4A]/40 space-y-1">
                            {trace.decision && (
                                <div className="text-gray-300 text-xs truncate">
                                    <span className="text-gray-500 font-semibold mr-1">Decision:</span>{trace.decision}
                                </div>
                            )}
                            {trace.reasoning && (
                                <div className="text-gray-300 text-xs truncate">
                                    <span className="text-gray-500 font-semibold mr-1">Reasoning:</span>{trace.reasoning}
                                </div>
                            )}
                            {trace.output_summary && (
                                <div className="text-gray-300 text-xs truncate">
                                    <span className="text-gray-500 font-semibold mr-1">Outcome:</span>{trace.output_summary}
                                </div>
                            )}
                            {(!trace.decision && !trace.reasoning && !trace.output_summary && trace.details) && (
                                <div className="text-gray-400 text-xs truncate">
                                    {trace.agent === 'Planner' && trace.details.strategy
                                        ? `selected strategy: "${trace.details.strategy}"`
                                        : trace.agent === 'Evaluator' && trace.details.clarity_score !== undefined
                                        ? `clarity: ${trace.details.clarity_score}%`
                                        : trace.agent === 'Executor'
                                        ? `generated response`
                                        : JSON.stringify(trace.details)}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-1 px-3 bg-[#5C6B4A]/5 border-t border-[#5C6B4A]/20 text-[10px] text-gray-500 flex justify-between">
                <span>LIVE TRACE</span>
                <span className="text-green-500">● ONLINE</span>
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
