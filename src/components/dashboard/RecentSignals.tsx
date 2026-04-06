import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { DashboardData } from "@/services/api";

const ease = [0.23, 1, 0.32, 1] as const;

interface RecentSignalsProps {
    signals: DashboardData["recent_signals"];
    delay?: number;
}

const getSignalColor = (type: string) => {
    switch (type) {
        case "progress": return "bg-[#5C6B4A]";
        case "struggle": return "bg-[#D4A574]";
        default: return "bg-[#8B8178]";
    }
};

const getSignalBadge = (type: string) => {
    switch (type) {
        case "progress": return { label: "Growth", color: "text-[#5C6B4A] bg-[#5C6B4A]/8" };
        case "struggle": return { label: "Challenge", color: "text-[#D4A574] bg-[#D4A574]/10" };
        default: return { label: "Insight", color: "text-[#8B8178] bg-[#8B8178]/10" };
    }
};

const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
};

export default function RecentSignals({ signals, delay = 0.45 }: RecentSignalsProps) {
    if (!signals.length) return null;

    return (
        <motion.section
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay, ease }}
            className="relative rounded-[2rem] p-8 md:p-10 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]"
        >
            <div className="flex items-center gap-2.5 mb-8">
                <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[#5C6B4A]" />
                </div>
                <span className="mono-tag text-[9px] text-[#8B8178]">Recent Signals</span>
                <span className="mono-tag text-[8px] text-[#8B8178]/25 ml-auto">{signals.length} observations</span>
            </div>

            <div className="space-y-0 relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-[#5C6B4A]/20 via-[#D4A574]/15 to-transparent" />
                {signals.map((signal, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: (delay + 0.05) + idx * 0.08, ease }}
                        className="flex items-start gap-5 py-4 group/signal"
                    >
                        <div className="relative z-10 mt-1 flex-shrink-0">
                            <div className={`w-[10px] h-[10px] rounded-full ring-[3px] ring-[#FDF8F3] ${getSignalColor(signal.type)} group-hover/signal:scale-125 transition-transform duration-300`} />
                        </div>
                        <div className="flex-1 min-w-0 pb-4 border-b border-[#E8DED4]/40 last:border-0">
                            <div className="flex items-start justify-between gap-4">
                                <p className="text-[#3D3D3D] text-sm leading-relaxed">{signal.observation}</p>
                                <span className={`shrink-0 mono-tag text-[7px] px-2 py-1 rounded-full ${getSignalBadge(signal.type).color}`}>
                                    {getSignalBadge(signal.type).label}
                                </span>
                            </div>
                            <span className="mono-tag text-[8px] text-[#8B8178]/30 mt-1.5 block">
                                {formatTimestamp(signal.timestamp)}
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.section>
    );
}
