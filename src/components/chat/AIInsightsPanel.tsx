import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Brain, Target, Zap, MessageCircle, TrendingUp, TrendingDown, Minus,
    BookOpen, ChevronRight, Sparkles, Activity, X
} from "lucide-react";
import type { SessionContext } from "@/services/api";
import type { Reflection } from "@/components/chat/MessageBubble";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface AIInsightsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    sessionContext: SessionContext | null;
    sessionContextLoading: boolean;
    reflections: Reflection[];
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

/* ──────────────────────────────────────────────
   Section A — "This Session"
   ────────────────────────────────────────────── */

function SessionSection({ ctx }: { ctx: SessionContext | null }) {
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
    const clarity = ctx.session_clarity ?? 50;

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
                    <span className="text-[11px] font-bold text-[#3D3D3D]">{clarity}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#E8DED4]/50 overflow-hidden">
                    <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${clarity}%` }}
                        transition={{ duration: 0.8, ease }}
                        style={{
                            background: clarity > 70
                                ? "linear-gradient(90deg, #5C6B4A, #7A8B5A)"
                                : clarity > 40
                                ? "linear-gradient(90deg, #D4A574, #E8C49A)"
                                : "linear-gradient(90deg, #C45C5C, #D47A7A)",
                        }}
                    />
                </div>
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

function ConceptsSection({ ctx }: { ctx: SessionContext | null }) {
    const concepts = ctx?.active_concepts ?? [];

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
            {concepts.map((concept, i) => (
                <div
                    key={concept}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/40 border border-[#E8DED4]/40 hover:border-[#5C6B4A]/20 transition-colors"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#5C6B4A]/40 shrink-0" />
                        <span className="text-xs text-[#3D3D3D] font-medium truncate">{concept}</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-[#8B8178]/30 shrink-0" />
                </div>
            ))}
        </div>
    );
}

/* ──────────────────────────────────────────────
   Section C — "What the AI decided"
   ────────────────────────────────────────────── */

function AIDecisionSection({ reflections }: { reflections: Reflection[] }) {
    // Find the latest guidance reflection that has an evaluation
    const lastEval = [...reflections]
        .reverse()
        .find(r => r.type === "guidance" && r.evaluation)
        ?.evaluation;

    if (!lastEval) {
        return (
            <div className="py-4 flex flex-col items-center text-center opacity-50">
                <Sparkles className="w-5 h-5 text-[#8B8178] mb-2" />
                <p className="text-xs text-[#8B8178]">AI decisions will appear after responses.</p>
            </div>
        );
    }

    const delta = lastEval.understanding_delta ?? 0;
    const deltaColor = delta > 0 ? "text-emerald-500" : delta < 0 ? "text-red-400" : "text-[#8B8178]";
    const DeltaIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

    const trend = (lastEval.confusion_trend || "").toLowerCase();
    const trendColor = trend === "increasing" || trend === "high"
        ? "text-red-400 bg-red-500/8"
        : trend === "decreasing" || trend === "low"
        ? "text-emerald-500 bg-emerald-500/8"
        : "text-[#8B8178] bg-[#E8DED4]/30";

    return (
        <div className="space-y-3">
            {/* Clarity Score */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/40 border border-[#E8DED4]/40">
                <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-[#5C6B4A]" />
                    <span className="text-xs text-[#3D3D3D] font-medium">Clarity Score</span>
                </div>
                <span className="text-sm font-bold text-[#5C6B4A]">{lastEval.clarity_score}%</span>
            </div>

            {/* Understanding Delta */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/40 border border-[#E8DED4]/40">
                <div className="flex items-center gap-2">
                    <DeltaIcon className={`w-3.5 h-3.5 ${deltaColor}`} />
                    <span className="text-xs text-[#3D3D3D] font-medium">Understanding</span>
                </div>
                <span className={`text-sm font-bold ${deltaColor}`}>
                    {delta > 0 ? "+" : ""}{delta}
                </span>
            </div>

            {/* Confusion Trend */}
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

/* ──────────────────────────────────────────────
   Main Panel
   ────────────────────────────────────────────── */

export default function AIInsightsPanel({
    isOpen,
    onClose,
    sessionContext,
    sessionContextLoading,
    reflections,
}: AIInsightsPanelProps) {
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
                                    {/* Section A */}
                                    <section>
                                        <h3 className="mono-tag text-[9px] text-[#8B8178] mb-3">This Session</h3>
                                        <SessionSection ctx={sessionContext} />
                                    </section>

                                    <div className="h-px bg-[#E8DED4]/50" />

                                    {/* Section B */}
                                    <section>
                                        <h3 className="mono-tag text-[9px] text-[#8B8178] mb-3">Concepts Discussed</h3>
                                        <ConceptsSection ctx={sessionContext} />
                                    </section>

                                    <div className="h-px bg-[#E8DED4]/50" />

                                    {/* Section C */}
                                    <section>
                                        <h3 className="mono-tag text-[9px] text-[#8B8178] mb-3">What the AI decided</h3>
                                        <AIDecisionSection reflections={reflections} />
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
