import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Brain, Target, Zap, MessageCircle, TrendingUp, TrendingDown, Minus,
    BookOpen, ChevronRight, Sparkles, Activity, X, FileText, Database,
    Loader2, CheckCircle2
} from "lucide-react";
import type { SessionContext, TraceEntry, ConceptMapNode } from "@/services/api";
import { fetchSessionTraces, fetchConceptMap } from "@/services/api";
import type { Reflection } from "@/components/chat/MessageBubble";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface EvaluationResult {
    clarity_score: number;
    understanding_delta: number;
    confusion_trend: string;
    engagement_level: string;
}

interface AIInsightsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    sessionContext: SessionContext | null;
    sessionContextLoading: boolean;
    reflections: Reflection[];
    latestEvaluation: EvaluationResult | null;
    isReflecting: boolean;
    chatId: string | null;
}

const ease = [0.23, 1, 0.32, 1] as const;

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

const intentLabels: Record<string, { label: string; color: string }> = {
    unknown: { label: "Detecting…", color: "bg-[#8B8178]/10 text-[#8B8178]" },
    learning: { label: "Learning", color: "bg-blue-500/10 text-blue-600" },
    problem_solving: { label: "Problem Solving", color: "bg-purple-500/10 text-purple-600" },
    casual: { label: "Casual", color: "bg-amber-500/10 text-amber-600" },
    review: { label: "Review", color: "bg-emerald-500/10 text-emerald-600" },
};

const momentumLabels: Record<string, { label: string; color: string; icon: typeof Zap }> = {
    cold_start: { label: "Cold Start", color: "text-[#8B8178]", icon: Minus },
    warming_up: { label: "Warming Up", color: "text-amber-500", icon: TrendingUp },
    flowing: { label: "Flowing", color: "text-emerald-500", icon: Zap },
    stuck: { label: "Stuck", color: "text-red-400", icon: TrendingDown },
    wrapping_up: { label: "Wrapping Up", color: "text-[#8B8178]", icon: Minus },
};

function Badge({ label, color }: { label: string; color: string }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide ${color}`}>
            {label}
        </span>
    );
}

/** Convert a slug like "binary-search" to "Binary Search" */
function formatConceptName(slug: string): string {
    return slug
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

/* ──────────────────────────────────────────────
   Section A — "This Session"
   ────────────────────────────────────────────── */

function SessionSection({
    ctx,
    latestEvaluation,
}: {
    ctx: SessionContext | null;
    latestEvaluation: EvaluationResult | null;
}) {
    if (!ctx) {
        return (
            <div className="py-6 flex flex-col items-center text-center opacity-50">
                <Brain className="w-5 h-5 text-[#8B8178] mb-2" />
                <p className="text-xs text-[#8B8178]">Send a message to begin tracking.</p>
            </div>
        );
    }

    const intent = intentLabels[ctx.session_intent] ?? intentLabels.unknown;
    const momentum = momentumLabels[ctx.session_momentum] ?? momentumLabels.cold_start;
    const MomentumIcon = momentum.icon;

    // Clarity: session_clarity is the authoritative source (updated by evaluator).
    // latestEvaluation provides delta and trend only (it may have stale pre-evaluator clarity).
    const hasEvaluation = latestEvaluation !== null;
    const rawClarity = ctx.session_clarity;
    const clarityValue = typeof rawClarity === "number" && !isNaN(rawClarity) ? rawClarity : 50;
    const isFreshDefault = !hasEvaluation && clarityValue === 50 && (ctx.message_count ?? 0) === 0;

    // Track previous clarity so the bar animates from old → new (not 0 → new)
    const prevClarityRef = useRef(clarityValue);
    useEffect(() => {
        prevClarityRef.current = clarityValue;
    }, [clarityValue]);

    // Delta from evaluation
    const delta = latestEvaluation?.understanding_delta ?? null;
    const deltaColor = delta !== null
        ? delta > 0 ? "text-emerald-500" : delta < 0 ? "text-red-400" : "text-[#8B8178]"
        : "";
    const DeltaIcon = delta !== null
        ? delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
        : null;

    // Confusion trend
    const trend = latestEvaluation?.confusion_trend?.toLowerCase() ?? null;
    const trendLabel = trend === "improving" || trend === "decreasing" || trend === "low"
        ? "Improving"
        : trend === "declining" || trend === "increasing" || trend === "high"
        ? "Declining"
        : trend === "stable" ? "Stable" : null;
    const trendColor = trendLabel === "Improving"
        ? "text-emerald-500"
        : trendLabel === "Declining"
        ? "text-red-400"
        : "text-[#8B8178]";

    return (
        <div className="space-y-4">
            {/* Intent + Momentum badges */}
            <div className="flex items-center gap-2 flex-wrap">
                <Badge label={intent.label} color={intent.color} />
                <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/60 border border-[#E8DED4]/50 ${momentum.color}`}>
                    <MomentumIcon className="w-3 h-3" />
                    {momentum.label}
                </div>
            </div>

            {/* Goal */}
            {ctx.session_goal && (
                <div className="flex items-start gap-2">
                    <Target className="w-3.5 h-3.5 text-[#5C6B4A] mt-0.5 shrink-0" />
                    <div>
                        <span className="mono-tag text-[8px] text-[#8B8178]/50 block mb-0.5">Session Goal</span>
                        <p className="text-xs text-[#3D3D3D] leading-relaxed">{ctx.session_goal}</p>
                    </div>
                </div>
            )}

            {/* Clarity progress bar */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <span className="mono-tag text-[8px] text-[#8B8178]/50">Clarity</span>
                    <div className="flex items-center gap-1.5">
                        {/* Delta indicator */}
                        {DeltaIcon && delta !== null && delta !== 0 && (
                            <span className={`flex items-center gap-0.5 text-[10px] font-bold ${deltaColor}`}>
                                <DeltaIcon className="w-3 h-3" />
                                {delta > 0 ? "+" : ""}{delta}
                            </span>
                        )}
                        <span className="text-[11px] font-bold text-[#3D3D3D]">
                            {isFreshDefault ? "—" : `${Math.round(clarityValue)}%`}
                        </span>
                    </div>
                </div>
                {!isFreshDefault && (
                    <div className="h-1.5 rounded-full bg-[#E8DED4]/50 overflow-hidden">
                        <motion.div
                            className="h-full rounded-full"
                            initial={{ width: `${prevClarityRef.current}%` }}
                            animate={{ width: `${clarityValue}%` }}
                            transition={{ duration: 0.8, ease }}
                            style={{
                                background: clarityValue > 70
                                    ? "linear-gradient(90deg, #5C6B4A, #7A8B5A)"
                                    : clarityValue > 40
                                    ? "linear-gradient(90deg, #D4A574, #E8C49A)"
                                    : "linear-gradient(90deg, #C45C5C, #D47A7A)",
                                transition: "width 0.8s cubic-bezier(0.23, 1, 0.32, 1)",
                            }}
                        />
                    </div>
                )}
                {/* Confusion trend indicator */}
                {trendLabel && (
                    <span className={`text-[9px] font-medium mt-1 block ${trendColor}`}>
                        Trend: {trendLabel}
                    </span>
                )}
            </div>

            {/* Message count */}
            <div className="flex items-center gap-2 text-[#8B8178]">
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="text-xs">{ctx.message_count ?? 0} messages</span>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────
   Section B — "Concepts Discussed"
   ────────────────────────────────────────────── */

function ConceptsSection({
    ctx,
    conceptMap,
    traceConcepts,
}: {
    ctx: SessionContext | null;
    conceptMap: ConceptMapNode[];
    traceConcepts: string[];
}) {
    // Use active_concepts from session context; supplement with evaluator trace concepts
    const sessionConcepts = ctx?.active_concepts ?? [];
    const merged = new Set([...sessionConcepts, ...traceConcepts]);
    const concepts = Array.from(merged);

    if (concepts.length === 0) {
        return (
            <div className="py-4 flex flex-col items-center text-center opacity-50">
                <BookOpen className="w-5 h-5 text-[#8B8178] mb-2" />
                <p className="text-xs text-[#8B8178]">Start chatting to track concepts.</p>
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            {concepts.map(slug => {
                // Match concept by ID or slug-ified name
                const masteryNode = conceptMap.find(n =>
                    n.concept_id === slug ||
                    n.concept_name.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase()
                );
                const mastery = masteryNode?.mastery_level ?? 0;
                const status = masteryNode?.status ?? "novice";
                const statusLabel = mastery >= 85 ? "Mastered"
                    : mastery >= 60 ? "Proficient"
                    : mastery >= 30 ? "Developing"
                    : "New";
                const statusColor = mastery >= 85 ? "text-emerald-600 bg-emerald-500/10"
                    : mastery >= 60 ? "text-blue-600 bg-blue-500/10"
                    : mastery >= 30 ? "text-amber-600 bg-amber-500/10"
                    : "text-[#8B8178] bg-[#8B8178]/10";

                return (
                    <div
                        key={slug}
                        className="px-3 py-2.5 rounded-xl bg-white/40 border border-[#E8DED4]/40 hover:border-[#5C6B4A]/20 transition-colors"
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#5C6B4A]/40 shrink-0" />
                                <span className="text-xs text-[#3D3D3D] font-medium truncate">
                                    {formatConceptName(slug)}
                                </span>
                            </div>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${statusColor}`}>
                                {statusLabel}
                            </span>
                        </div>
                        {/* Mini mastery bar */}
                        <div className="h-1 rounded-full bg-[#E8DED4]/40 overflow-hidden">
                            <motion.div
                                className="h-full rounded-full bg-[#5C6B4A]/60"
                                initial={{ width: 0 }}
                                animate={{ width: `${mastery}%` }}
                                transition={{ duration: 0.6, ease }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ──────────────────────────────────────────────
   Section C — "What the AI Decided" (Live traces)
   ────────────────────────────────────────────── */

const agentIcons: Record<string, { icon: typeof Brain; color: string }> = {
    Planner: { icon: Brain, color: "text-blue-400" },
    Executor: { icon: FileText, color: "text-emerald-400" },
    Evaluator: { icon: Activity, color: "text-purple-400" },
    Memory: { icon: Database, color: "text-amber-400" },
};

function AIDecisionSection({
    traces,
    reflections,
}: {
    traces: TraceEntry[];
    reflections: Reflection[];
}) {
    // Group by most recent request_id — shows decisions for the last message
    const latestRequestTraces = useMemo(() => {
        if (traces.length === 0) return [];
        const latestReqId = traces[0]?.request_id;
        if (!latestReqId) return [];
        return traces.filter(t => t.request_id === latestReqId);
    }, [traces]);

    // Also check reflections for evaluation data as a fallback
    const lastEvalFromReflection = useMemo(() => {
        return [...reflections]
            .reverse()
            .find(r => r.type === "guidance" && r.evaluation)
            ?.evaluation ?? null;
    }, [reflections]);

    // Show traces if available, otherwise fall back to evaluation from reflections
    if (latestRequestTraces.length === 0 && !lastEvalFromReflection) {
        return (
            <div className="py-4 flex flex-col items-center text-center opacity-50">
                <Sparkles className="w-5 h-5 text-[#8B8178] mb-2" />
                <p className="text-xs text-[#8B8178]">Strategy data will appear after your first response.</p>
            </div>
        );
    }

    // Prefer trace data when available (richer detail)
    if (latestRequestTraces.length > 0) {
        // Show only the most important agents: Planner, Executor, Evaluator, Memory
        const importantAgents = ["Planner", "Executor", "Evaluator", "Memory"];
        const displayTraces = latestRequestTraces.filter(t =>
            importantAgents.includes(t.agent)
        );

        return (
            <div className="space-y-2">
                {displayTraces.map(trace => {
                    const cfg = agentIcons[trace.agent] ?? { icon: Sparkles, color: "text-gray-400" };
                    const Icon = cfg.icon;

                    return (
                        <div
                            key={trace.trace_id}
                            className="px-3 py-2.5 rounded-xl bg-white/40 border border-[#E8DED4]/40"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                                <span className={`text-[10px] font-bold tracking-wide ${cfg.color}`}>
                                    {trace.agent.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-[11px] font-semibold text-[#3D3D3D] leading-snug">
                                {trace.action}
                            </p>
                            {trace.decision && (
                                <p className="text-[10px] text-[#5C6B4A] mt-1 leading-relaxed">
                                    {trace.decision}
                                </p>
                            )}
                            {trace.reasoning && (
                                <p className="text-[10px] text-[#8B8178] mt-0.5 leading-relaxed italic">
                                    {trace.reasoning}
                                </p>
                            )}
                            {trace.output_summary && !trace.decision && (
                                <p className="text-[10px] text-[#8B8178] mt-0.5 leading-relaxed">
                                    {trace.output_summary}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    }

    // Fallback: show evaluation data from reflections
    if (lastEvalFromReflection) {
        const delta = lastEvalFromReflection.understanding_delta ?? 0;
        const deltaColor = delta > 0 ? "text-emerald-500" : delta < 0 ? "text-red-400" : "text-[#8B8178]";
        const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
        const trend = (lastEvalFromReflection.confusion_trend || "").toLowerCase();
        const trendColor = trend === "increasing" || trend === "high"
            ? "text-red-400 bg-red-500/8"
            : trend === "decreasing" || trend === "low"
            ? "text-emerald-500 bg-emerald-500/8"
            : "text-[#8B8178] bg-[#E8DED4]/30";

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/40 border border-[#E8DED4]/40">
                    <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-[#5C6B4A]" />
                        <span className="text-xs text-[#3D3D3D] font-medium">Clarity Score</span>
                    </div>
                    <span className="text-sm font-bold text-[#5C6B4A]">{lastEvalFromReflection.clarity_score}%</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/40 border border-[#E8DED4]/40">
                    <div className="flex items-center gap-2">
                        <DeltaIcon className={`w-3.5 h-3.5 ${deltaColor}`} />
                        <span className="text-xs text-[#3D3D3D] font-medium">Understanding</span>
                    </div>
                    <span className={`text-sm font-bold ${deltaColor}`}>
                        {delta > 0 ? "+" : ""}{delta}
                    </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/40 border border-[#E8DED4]/40">
                    <div className="flex items-center gap-2">
                        <Brain className="w-3.5 h-3.5 text-[#8B8178]" />
                        <span className="text-xs text-[#3D3D3D] font-medium">Confusion</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${trendColor}`}>
                        {trend || "stable"}
                    </span>
                </div>
            </div>
        );
    }

    return null;
}

/* ──────────────────────────────────────────────
   Section D — Pipeline Status (Live Animation)
   ────────────────────────────────────────────── */

const PIPELINE_STEPS = [
    { label: "Classifying intent…", icon: Brain, delay: 0 },
    { label: "Assembling memory…", icon: Database, delay: 700 },
    { label: "Planning strategy…", icon: Sparkles, delay: 1400 },
    { label: "Generating response…", icon: FileText, delay: 2100 },
    { label: "Evaluating…", icon: Activity, delay: 2800 },
];

function PipelineStatus({ isReflecting }: { isReflecting: boolean }) {
    const [visibleSteps, setVisibleSteps] = useState(0);

    useEffect(() => {
        if (!isReflecting) {
            setVisibleSteps(0);
            return;
        }

        // Reveal steps one by one
        const timers = PIPELINE_STEPS.map((step, i) =>
            setTimeout(() => setVisibleSteps(i + 1), step.delay)
        );

        return () => timers.forEach(clearTimeout);
    }, [isReflecting]);

    if (!isReflecting) return null;

    return (
        <div className="space-y-1.5">
            {PIPELINE_STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isVisible = i < visibleSteps;
                const isActive = i === visibleSteps - 1;

                if (!isVisible) return null;

                return (
                    <motion.div
                        key={step.label}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease }}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
                            isActive
                                ? "bg-[#5C6B4A]/8 border-[#5C6B4A]/30"
                                : "bg-white/30 border-[#E8DED4]/30 opacity-60"
                        }`}
                    >
                        <StepIcon className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? "text-[#5C6B4A]" : "text-[#8B8178]"
                        }`} />
                        <span className={`text-[11px] font-medium ${
                            isActive ? "text-[#3D3D3D]" : "text-[#8B8178]"
                        }`}>
                            {step.label}
                        </span>
                        <span className="ml-auto">
                            {isActive ? (
                                <Loader2 className="w-3 h-3 text-[#5C6B4A] animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-3 h-3 text-[#5C6B4A]/40" />
                            )}
                        </span>
                    </motion.div>
                );
            })}
        </div>
    );
}

/* ──────────────────────────────────────────────
   Main Panel
   ────────────────────────────────────────────── */

export default function AIInsightsPanel({
    isOpen,
    onClose,
    sessionContext,
    sessionContextLoading,
    reflections,
    latestEvaluation,
    isReflecting,
    chatId,
}: AIInsightsPanelProps) {
    // Fetch concept map once per chat (for mastery levels)
    const [conceptMap, setConceptMap] = useState<ConceptMapNode[]>([]);
    useEffect(() => {
        if (!chatId) { setConceptMap([]); return; }
        fetchConceptMap()
            .then(data => { if (data?.nodes) setConceptMap(data.nodes); })
            .catch(() => {});
    }, [chatId]);

    // Fetch trace logs after each response (debounced)
    const [traces, setTraces] = useState<TraceEntry[]>([]);
    useEffect(() => {
        if (!chatId || isReflecting) return;

        // Short delay to allow evaluator trace to be written
        const timer = setTimeout(() => {
            fetchSessionTraces(chatId, 15)
                .then(setTraces)
                .catch(() => {});
        }, 1500);

        return () => clearTimeout(timer);
    }, [chatId, reflections.length, isReflecting]);

    // Reset traces when chat changes
    useEffect(() => {
        setTraces([]);
    }, [chatId]);

    // Derive evaluation from Evaluator trace when latestEvaluation isn't set (WS mode)
    const derivedEvaluation = useMemo(() => {
        if (latestEvaluation) return latestEvaluation;
        // Find the latest Evaluator trace for this session
        const evalTrace = traces.find(t => t.agent === "Evaluator");
        if (!evalTrace?.details) return null;
        const d = evalTrace.details as Record<string, unknown>;
        if (typeof d.clarity_score !== "number") return null;
        return {
            clarity_score: d.clarity_score as number,
            understanding_delta: (d.understanding_delta as number) ?? 0,
            confusion_trend: (d.confusion_trend as string) ?? "stable",
            engagement_level: (d.engagement_level as string) ?? "medium",
        };
    }, [latestEvaluation, traces]);

    // Extract concepts from Evaluator trace details (supplement for first few messages)
    const traceConcepts = useMemo(() => {
        const evalTrace = traces.find(t => t.agent === "Evaluator");
        if (!evalTrace?.details) return [];
        const d = evalTrace.details as Record<string, unknown>;
        if (Array.isArray(d.concepts_discussed)) {
            return d.concepts_discussed.filter((c): c is string => typeof c === "string");
        }
        return [];
    }, [traces]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.aside
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease }}
                    className="hidden md:flex flex-col h-screen sticky top-0 border-l border-[#E8DED4]/60 bg-white/30 backdrop-blur-xl overflow-hidden shrink-0"
                >
                    <div className="w-[320px] flex flex-col h-full">
                        {/* Header */}
                        <div className="px-5 py-4 flex items-center justify-between border-b border-[#E8DED4]/50">
                            <div className="flex items-center gap-2">
                                <Brain className="w-4 h-4 text-[#5C6B4A]" />
                                <span className="text-sm font-bold text-[#3D3D3D] tracking-tight"
                                    style={{ fontFamily: "'Inter', sans-serif" }}>
                                    AI Insights
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg hover:bg-[#E8DED4]/50 text-[#8B8178] transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 custom-scrollbar">
                            {sessionContextLoading && !sessionContext ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-8 animate-pulse bg-[#E8DED4]/30 rounded-lg" />
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {/* Section A — This Session */}
                                    <section>
                                        <h3 className="mono-tag text-[9px] text-[#8B8178] mb-3">This Session</h3>
                                        <SessionSection
                                            ctx={sessionContext}
                                            latestEvaluation={derivedEvaluation}
                                        />
                                    </section>

                                    <div className="h-px bg-[#E8DED4]/50" />

                                    {/* Section B — Concepts Discussed */}
                                    <section>
                                        <h3 className="mono-tag text-[9px] text-[#8B8178] mb-3">Concepts Discussed</h3>
                                        <ConceptsSection ctx={sessionContext} conceptMap={conceptMap} traceConcepts={traceConcepts} />
                                    </section>

                                    <div className="h-px bg-[#E8DED4]/50" />

                                    {/* Section C/D — Pipeline Status (while reflecting) or AI Decisions (after response) */}
                                    <section>
                                        <h3 className="mono-tag text-[9px] text-[#8B8178] mb-3">
                                            {isReflecting ? "Pipeline Active" : "What the AI Decided"}
                                        </h3>
                                        {isReflecting ? (
                                            <PipelineStatus isReflecting={isReflecting} />
                                        ) : (
                                            <AIDecisionSection traces={traces} reflections={reflections} />
                                        )}
                                    </section>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-[#E8DED4]/50">
                            <span className="mono-tag text-[8px] text-[#8B8178]/30">Multi-agent intelligence · Live</span>
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}
