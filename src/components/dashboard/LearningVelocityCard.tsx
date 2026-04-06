import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Zap, BookOpen, Sprout } from "lucide-react";
import type { VelocityData } from "@/services/api";

const ease = [0.23, 1, 0.32, 1] as const;

interface LearningVelocityCardProps {
    velocity: VelocityData;
    delay?: number;
}

const velStyles: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
    fast: { icon: <Zap className="w-4 h-4" />, color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/15" },
    steady: { icon: <Sprout className="w-4 h-4" />, color: "text-[#5C6B4A]", bg: "bg-[#5C6B4A]/8", border: "border-[#5C6B4A]/12" },
    slow: { icon: <BookOpen className="w-4 h-4" />, color: "text-[#D4A574]", bg: "bg-[#D4A574]/10", border: "border-[#D4A574]/15" },
    insufficient_data: { icon: <Minus className="w-4 h-4" />, color: "text-[#8B8178]", bg: "bg-[#8B8178]/8", border: "border-[#8B8178]/12" },
};

const trendIcons: Record<string, React.ReactNode> = {
    improving: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />,
    declining: <TrendingDown className="w-3.5 h-3.5 text-amber-500" />,
    stable: <Minus className="w-3.5 h-3.5 text-[#8B8178]" />,
};

export default function LearningVelocityCard({ velocity, delay = 0.2 }: LearningVelocityCardProps) {
    const style = velStyles[velocity.label] || velStyles.insufficient_data;
    const sparkline = velocity.mastery_sparkline;
    const maxVal = Math.max(...sparkline.filter(v => v > 0), 0.01);

    return (
        <motion.section
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay, ease }}
            className="relative group rounded-[2rem] p-7 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-2 hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_30px_60px_-12px_rgba(0,0,0,0.08)] transition-all transition-duration-[600ms] cursor-default lg:col-span-2"
        >
            <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-[#5C6B4A]/20 group-hover:bg-[#5C6B4A]/40 transition-colors duration-500" />

            <div className="flex items-center gap-2.5 mb-5">
                <div className={`w-8 h-8 rounded-full ${style.bg} flex items-center justify-center ${style.color}`}>
                    {style.icon}
                </div>
                <span className="mono-tag text-[9px] text-[#8B8178]">Learning Velocity</span>
                <div className="flex items-center gap-1.5 ml-auto">
                    {trendIcons[velocity.trend]}
                    <span className="mono-tag text-[8px] text-[#8B8178]/50 capitalize">{velocity.trend}</span>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Left: Label + Insight */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3 mb-3">
                        <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold capitalize ${style.bg} ${style.color} ${style.border} border`}>
                            {velocity.label === "insufficient_data" ? "Getting Started" : velocity.label}
                        </span>
                    </div>
                    <p className="text-[#8B8178] text-sm leading-relaxed mb-4">{velocity.insight}</p>

                    {/* Mastered / In Progress counts */}
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#5C6B4A]/5 border border-[#5C6B4A]/8">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[12px] text-[#8B8178]">Mastered</span>
                            <span className="text-[14px] font-bold text-[#3D3D3D]">{velocity.mastered_count}</span>
                        </div>
                        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#D4A574]/5 border border-[#D4A574]/8">
                            <div className="w-2 h-2 rounded-full bg-[#D4A574]" />
                            <span className="text-[12px] text-[#8B8178]">In Progress</span>
                            <span className="text-[14px] font-bold text-[#3D3D3D]">{velocity.in_progress_count}</span>
                        </div>
                    </div>
                </div>

                {/* Right: Sparkline */}
                {sparkline.length > 1 && (
                    <div className="w-full md:w-48 h-20 flex-shrink-0">
                        <span className="mono-tag text-[7px] text-[#8B8178]/30 mb-1 block">7-Day Mastery</span>
                        <svg viewBox="0 0 140 48" className="w-full h-full">
                            <defs>
                                <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#5C6B4A" stopOpacity="0.2" />
                                    <stop offset="100%" stopColor="#5C6B4A" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {/* Area fill */}
                            <path
                                d={`M ${sparkline.map((v, i) => `${(i / (sparkline.length - 1)) * 140},${46 - (v / maxVal) * 40}`).join(" L ")} L 140,46 L 0,46 Z`}
                                fill="url(#velGrad)"
                            />
                            {/* Line */}
                            <path
                                d={`M ${sparkline.map((v, i) => `${(i / (sparkline.length - 1)) * 140},${46 - (v / maxVal) * 40}`).join(" L ")}`}
                                fill="none"
                                stroke="#5C6B4A"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            {/* End dot */}
                            <circle
                                cx={140}
                                cy={46 - (sparkline[sparkline.length - 1] / maxVal) * 40}
                                r="3"
                                fill="#5C6B4A"
                            />
                        </svg>
                    </div>
                )}
            </div>
        </motion.section>
    );
}
