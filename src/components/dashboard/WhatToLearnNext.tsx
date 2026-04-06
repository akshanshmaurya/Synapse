import { motion } from "framer-motion";
import { Lightbulb, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ZPDRecommendation } from "@/services/api";

const ease = [0.23, 1, 0.32, 1] as const;

interface WhatToLearnNextProps {
    nextSteps: ZPDRecommendation[];
    delay?: number;
}

export default function WhatToLearnNext({ nextSteps, delay = 0.25 }: WhatToLearnNextProps) {
    const navigate = useNavigate();

    if (!nextSteps.length) return null;

    return (
        <motion.section
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay, ease }}
            className="relative group rounded-[2rem] p-7 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_25px_50px_-12px_rgba(0,0,0,0.07)] transition-all transition-duration-[600ms] cursor-default lg:col-span-2"
        >
            <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-[#D4A574]/20 group-hover:bg-[#D4A574]/40 transition-colors duration-500" />

            <div className="flex items-center gap-2.5 mb-6">
                <div className="w-8 h-8 rounded-full bg-[#D4A574]/10 flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-[#D4A574]" />
                </div>
                <span className="mono-tag text-[9px] text-[#8B8178]">What to Grow Next</span>
                <span className="mono-tag text-[8px] text-[#8B8178]/25 ml-auto">ZPD Recommendations</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {nextSteps.map((step, idx) => (
                    <motion.div
                        key={step.concept_id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: delay + 0.1 + idx * 0.08, ease }}
                        className="group/card relative rounded-2xl p-5 bg-white/50 border border-[#E8DED4]/60 hover:bg-white/70 hover:-translate-y-1 hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.06)] transition-all duration-500"
                    >
                        {/* Domain badge */}
                        <span className="mono-tag text-[7px] text-[#8B8178]/40 mb-2 block">{step.domain}</span>

                        <h4 className="text-[#3D3D3D] font-bold text-base mb-2 tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                            {step.concept_name}
                        </h4>

                        {/* Readiness bar */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="mono-tag text-[7px] text-[#8B8178]/40">Readiness</span>
                                <span className="mono-tag text-[8px] text-[#5C6B4A] font-bold">{Math.round(step.readiness * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-[#E8DED4]/50 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-[#5C6B4A] to-[#8BA670] rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${step.readiness * 100}%` }}
                                    transition={{ duration: 1, delay: delay + 0.3, ease }}
                                />
                            </div>
                        </div>

                        <p className="text-[#8B8178] text-xs leading-relaxed mb-4">{step.reason}</p>

                        <button
                            onClick={() => navigate(`/mentor?goal=${encodeURIComponent(step.concept_name)}`)}
                            className="group/btn flex items-center gap-1.5 text-[#5C6B4A] text-xs font-semibold hover:gap-2.5 transition-all duration-500"
                        >
                            Start Session
                            <ArrowRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5" />
                        </button>
                    </motion.div>
                ))}
            </div>
        </motion.section>
    );
}
