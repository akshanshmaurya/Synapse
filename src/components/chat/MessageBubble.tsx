import { motion } from "framer-motion";
import { Leaf, Volume2, AlertTriangle, RefreshCw, Sparkles, TrendingUp, Activity } from "lucide-react";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface Evaluation {
    clarity_score: number;
    understanding_delta: number;
    confusion_trend: string;
    engagement_level: string;
}

export interface Reflection {
    id: string;
    type: "guidance" | "thought" | "error";
    content: string;
    timestamp?: string;
    onRetry?: () => void;
    evaluation?: Evaluation;
}

/* ──────────────────────────────────────────────
   EvaluationTag — Compact insight badge below
   mentor bubbles showing learning trajectory.
   ────────────────────────────────────────────── */

const EvaluationTag = ({ evaluation }: { evaluation?: Evaluation }) => {
    if (!evaluation) return null;

    let insightText = "";
    let icon = null;
    let colorClass = "";

    const trend = (evaluation.confusion_trend || "").toLowerCase();
    const engagement = (evaluation.engagement_level || "").toLowerCase();

    if (trend === "increasing" || trend === "high" || evaluation.clarity_score < 50) {
        insightText = "Needs clarification";
        icon = <AlertTriangle className="w-3 h-3" />;
        colorClass = "text-amber-600 bg-amber-500/10 border-amber-500/20";
    } else if (evaluation.understanding_delta > 0 || evaluation.clarity_score > 70) {
        insightText = "Improving understanding";
        icon = <TrendingUp className="w-3 h-3" />;
        colorClass = "text-[#5C6B4A] bg-[#5C6B4A]/10 border-[#5C6B4A]/20";
    } else if (engagement === "high" || engagement === "strong") {
        insightText = "Strong progress";
        icon = <Sparkles className="w-3 h-3" />;
        colorClass = "text-[#D4A574] bg-[#D4A574]/10 border-[#D4A574]/20";
    } else {
        insightText = "Stable understanding";
        icon = <Activity className="w-3 h-3" />;
        colorClass = "text-[#8B8178] bg-[#E8DED4]/30 border-[#E8DED4]";
    }

    return (
        <div className={`mt-3 ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-medium transition-all shadow-[0_2px_10px_rgba(0,0,0,0.02)] ${colorClass}`}>
            {icon}
            {insightText}
        </div>
    );
};

/* ──────────────────────────────────────────────
   MessageBubble — Renders a single chat message.
   Handles mentor (guidance), user (thought), and
   error bubble variants.
   ────────────────────────────────────────────── */

interface MessageBubbleProps {
    reflection: Reflection;
    animationDelay?: number;
    ease: number[];
}

export default function MessageBubble({ reflection, animationDelay = 0, ease }: MessageBubbleProps) {
    const easingValue = ease as [number, number, number, number];
    return (
        <motion.div
            key={reflection.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: animationDelay, ease: easingValue }}
            className={reflection.type === "thought" ? "flex justify-end" : ""}
        >
            {reflection.type === "guidance" ? (
                /* ── Mentor Bubble ── */
                <div className="flex items-start gap-4 max-w-[90%]">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[#5C6B4A] flex items-center justify-center shrink-0 mt-1 shadow-[0_4px_12px_rgba(92,107,74,0.15)]">
                        <Leaf className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="bg-white/60 backdrop-blur-[30px] rounded-[1.5rem] rounded-tl-lg p-6 border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_10px_30px_-5px_rgba(0,0,0,0.04)]">
                            <p className="text-[#3D3D3D] leading-[1.8] whitespace-pre-wrap text-[15px]">
                                {reflection.content}
                            </p>
                        </div>
                        {/* Actions below bubble */}
                        <div className="flex items-center gap-4 mt-2.5 px-2">
                            <button className="flex items-center gap-1.5 text-[#8B8178]/40 hover:text-[#5C6B4A] transition-colors duration-500 group">
                                <Volume2 className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Listen</span>
                            </button>
                            <span className="mono-tag text-[8px] text-[#8B8178]/25">{reflection.timestamp}</span>
                        </div>

                        {/* Inject Evaluation Insights */}
                        <EvaluationTag evaluation={reflection.evaluation} />
                    </div>
                </div>
            ) : reflection.type === "error" ? (
                /* ── Error Bubble ── */
                <div className="flex items-start gap-4 max-w-[90%]">
                    <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-1 shadow-[0_4px_12px_rgba(239,68,68,0.1)]">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="bg-white/60 backdrop-blur-[30px] rounded-[1.5rem] rounded-tl-lg p-5 border border-red-500/20 shadow-sm">
                            <p className="text-[#3D3D3D] leading-relaxed text-[15px]">{reflection.content}</p>
                        </div>
                        <div className="mt-2.5 ml-2">
                            <button onClick={reflection.onRetry} className="flex items-center gap-1.5 text-xs font-medium text-[#5C6B4A] bg-[#5C6B4A]/10 hover:bg-[#5C6B4A]/20 px-3 py-1.5 rounded-full transition-colors border border-[#5C6B4A]/20">
                                <RefreshCw className="w-3.5 h-3.5" /> Retry
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── User Bubble ── */
                <div className="max-w-[85%]">
                    <div className="bg-[#5C6B4A] rounded-[1.5rem] rounded-tr-lg px-6 py-4 shadow-[0_8px_25px_rgba(92,107,74,0.2)]">
                        <p className="text-white/90 leading-[1.7] whitespace-pre-wrap text-[15px]">
                            {reflection.content}
                        </p>
                    </div>
                    <div className="flex justify-end mt-2 px-2">
                        <span className="mono-tag text-[8px] text-[#8B8178]/25">{reflection.timestamp}</span>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
