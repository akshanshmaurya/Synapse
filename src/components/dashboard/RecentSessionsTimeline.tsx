import { motion } from "framer-motion";
import { Clock, MessageSquare } from "lucide-react";
import type { RecentSession } from "@/services/api";

const ease = [0.23, 1, 0.32, 1] as const;

interface RecentSessionsTimelineProps {
    sessions: RecentSession[];
    delay?: number;
}

const effectivenessStyles: Record<string, { label: string; color: string; dot: string }> = {
    good: { label: "Effective", color: "text-emerald-600 bg-emerald-500/10", dot: "bg-emerald-500" },
    moderate: { label: "Moderate", color: "text-[#D4A574] bg-[#D4A574]/10", dot: "bg-[#D4A574]" },
    low: { label: "Low", color: "text-[#8B8178] bg-[#8B8178]/10", dot: "bg-[#8B8178]" },
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
        return "";
    }
};

export default function RecentSessionsTimeline({ sessions, delay = 0.35 }: RecentSessionsTimelineProps) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay, ease }}
            className="relative rounded-[2rem] p-8 md:p-10 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]"
        >
            <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-[#5C6B4A]" />
                </div>
                <span className="mono-tag text-[9px] text-[#8B8178]">Recent Sessions</span>
                <span className="mono-tag text-[8px] text-[#8B8178]/25 ml-auto">{sessions.length} sessions</span>
            </div>

            {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#8B8178]/8 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-[#8B8178]/40" />
                    </div>
                    <p className="text-[#8B8178]/60 text-sm">Your session history will appear here</p>
                </div>
            ) : (
                <div className="space-y-0 relative">
                    {/* Timeline line */}
                    <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-[#5C6B4A]/15 via-[#E8DED4]/30 to-transparent" />

                    {sessions.map((session, idx) => {
                        const eff = effectivenessStyles[session.effectiveness] || effectivenessStyles.low;
                        return (
                            <motion.div
                                key={session.session_id || idx}
                                initial={{ opacity: 0, x: -15 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: delay + 0.08 + idx * 0.06, ease }}
                                className="flex items-start gap-5 py-3.5 group/session"
                            >
                                {/* Timeline dot */}
                                <div className="relative z-10 mt-1.5 flex-shrink-0">
                                    <div className={`w-[10px] h-[10px] rounded-full ring-[3px] ring-[#FDF8F3] ${eff.dot} group-hover/session:scale-125 transition-transform duration-300`} />
                                </div>

                                <div className="flex-1 min-w-0 pb-3.5 border-b border-[#E8DED4]/30 last:border-0">
                                    <div className="flex items-start justify-between gap-3 mb-1.5">
                                        <div className="min-w-0">
                                            <p className="text-[#3D3D3D] text-sm font-medium truncate">
                                                {session.goal || "No goal set"}
                                            </p>
                                            <span className="mono-tag text-[8px] text-[#8B8178]/30">
                                                {formatDate(session.date)}
                                            </span>
                                        </div>
                                        <span className={`shrink-0 mono-tag text-[7px] px-2.5 py-1 rounded-full ${eff.color} font-medium`}>
                                            {eff.label}
                                        </span>
                                    </div>

                                    {/* Concepts chips */}
                                    {session.concepts_improved.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {session.concepts_improved.map((c, ci) => (
                                                <span key={ci} className="mono-tag text-[7px] px-2 py-0.5 rounded-full bg-[#5C6B4A]/6 text-[#5C6B4A]/70">
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </motion.section>
    );
}
