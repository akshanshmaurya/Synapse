import { motion } from "framer-motion";
import { Sun, Wind, Droplets, Flame, TrendingUp, Target, Sparkles, MessageSquare } from "lucide-react";
import type { DashboardData } from "@/services/api";

const ease = [0.23, 1, 0.32, 1] as const;

interface MomentumHeroProps {
    momentum: DashboardData["momentum"];
    effort: DashboardData["effort"];
}

const getMomentumLabel = (state: string) => {
    switch (state) {
        case "accelerating": return "Accelerating";
        case "steady": return "Steady Growth";
        case "building": return "Building Understanding";
        case "struggling": return "Needs Attention";
        default: return "Just Beginning";
    }
};

const getMomentumIcon = (state: string) => {
    switch (state) {
        case "accelerating": return <TrendingUp className="w-5 h-5" />;
        case "steady": return <Flame className="w-5 h-5" />;
        case "struggling": return <Target className="w-5 h-5" />;
        default: return <Sparkles className="w-5 h-5" />;
    }
};

const getTrendDisplay = (trend: string) => {
    switch (trend) {
        case "improving": return "Improving";
        case "worsening": return "Declining";
        default: return "Stable";
    }
};

const getWavePath = (state: string) => {
    switch (state) {
        case "starting": case "struggling": return "M 10 140 Q 30 130 50 135 T 90 120";
        case "building": return "M 10 140 Q 30 110 50 115 T 90 90";
        case "steady": return "M 10 140 Q 30 100 50 105 T 90 70";
        default: return "M 10 140 Q 30 90 50 80 T 90 40";
    }
};

const getDotCY = (state: string) => {
    switch (state) {
        case "starting": case "struggling": return "120";
        case "building": return "90";
        case "steady": return "70";
        default: return "40";
    }
};

export default function MomentumHero({ momentum, effort }: MomentumHeroProps) {
    const wavePath = getWavePath(momentum.state);
    const dotCY = getDotCY(momentum.state);

    return (
        <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease }}
            className="relative rounded-[2.5rem] overflow-hidden"
        >
            <div className="absolute inset-0 bg-[#4A5A3A]" />
            <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    mixBlendMode: "multiply",
                }}
            />
            <div className="absolute -top-24 -right-24 w-[350px] h-[350px] rounded-full bg-white/5 blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-[250px] h-[250px] rounded-full bg-[#D4A574]/8 blur-[80px]" />

            <div className="relative z-10 p-8 md:p-12 lg:p-14">
                <div className="flex flex-col lg:flex-row gap-8 lg:gap-14 items-start">
                    {/* SVG wave */}
                    <div className="flex-shrink-0 w-32 h-44 md:w-40 md:h-52">
                        <svg viewBox="0 0 100 150" className="w-full h-full">
                            {[30, 60, 90, 120].map(y => (
                                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                            ))}
                            <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.5, ease: "easeOut" }}
                                d={wavePath} stroke={momentum.state === "struggling" ? "#D4A574" : "rgba(255,255,255,0.6)"} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                            <motion.path initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 2.5, ease: "easeOut" }}
                                d={wavePath} stroke={momentum.state === "struggling" ? "#D4A574" : "rgba(255,255,255,0.15)"} strokeWidth="8" fill="none" strokeLinecap="round" filter="blur(4px)" />
                            <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.6, delay: 2 }} cx="90" cy={dotCY} r="5" fill="#D4A574" />
                            <motion.circle initial={{ scale: 0, opacity: 0 }} animate={{ scale: 2.5, opacity: [0, 0.3, 0] }} transition={{ duration: 2, delay: 2.2, repeat: Infinity, repeatDelay: 3 }}
                                cx="90" cy={dotCY} r="5" fill="none" stroke="#D4A574" strokeWidth="1" />
                        </svg>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50">
                                {getMomentumIcon(momentum.state)}
                            </div>
                            <span className="mono-tag text-[10px] text-white/30">Understanding</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-[0.95] tracking-tight mb-4"
                            style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.03em" }}>
                            {getMomentumLabel(momentum.state)}
                        </h2>
                        <p className="text-white/45 text-sm md:text-base leading-relaxed mb-8 max-w-lg">{momentum.insight}</p>
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/8 border border-white/10 backdrop-blur-sm">
                                <Sun className="w-4 h-4 text-[#D4A574]" />
                                <span className="text-[13px] text-white/60">Clarity</span>
                                <span className="text-[13px] text-white font-bold">{momentum.metrics.clarity_score}%</span>
                            </div>
                            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/8 border border-white/10 backdrop-blur-sm">
                                <Wind className="w-4 h-4 text-white/40" />
                                <span className="text-[13px] text-white/60">Trend</span>
                                <span className="text-[13px] text-white font-bold">{getTrendDisplay(momentum.metrics.understanding_trend || "")}</span>
                            </div>
                            {momentum.metrics.understanding_delta !== 0 && (
                                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/8 border border-white/10 backdrop-blur-sm">
                                    <Droplets className="w-4 h-4 text-white/40" />
                                    <span className="text-[13px] text-white/60">Δ</span>
                                    <span className={`text-[13px] font-bold ${momentum.metrics.understanding_delta > 0 ? "text-emerald-300" : "text-amber-300"}`}>
                                        {momentum.metrics.understanding_delta > 0 ? "+" : ""}{momentum.metrics.understanding_delta}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-10 pt-6 border-t border-white/8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Flame className="w-3.5 h-3.5 text-[#D4A574]" />
                            <span className="text-[12px] text-white/40">{effort.sessions_this_week ?? 0} sessions this week</span>
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] text-white/40">{effort.consistency_streak} day streak</span>
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                        <span className="mono-tag text-[8px] text-white/20">{effort.persistence_label ?? effort.label}</span>
                    </div>
                    <span className="mono-tag text-[8px] text-white/15 hidden md:block">SYNAPSE // GROWTH METRICS</span>
                </div>
            </div>
        </motion.section>
    );
}
