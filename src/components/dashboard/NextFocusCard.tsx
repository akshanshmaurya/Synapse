import { motion } from "framer-motion";
import { Leaf, ChevronRight, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardData } from "@/services/api";

const ease = [0.23, 1, 0.32, 1] as const;

interface NextFocusCardProps {
    nextBloom: DashboardData["next_bloom"];
    delay?: number;
}

export default function NextFocusCard({ nextBloom, delay = 0.2 }: NextFocusCardProps) {
    if (!nextBloom) return null;

    return (
        <motion.section
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay, ease }}
            className="relative group rounded-[2rem] p-7 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-2 hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_30px_60px_-12px_rgba(0,0,0,0.08)] transition-all transition-duration-[600ms] cursor-default"
        >
            <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-[#5C6B4A]/20 group-hover:bg-[#5C6B4A]/40 transition-colors duration-500" />

            <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                    <Leaf className="w-4 h-4 text-[#5C6B4A]" />
                </div>
                <span className="mono-tag text-[9px] text-[#8B8178]">Next Focus</span>
            </div>

            <div className="p-5 lg:p-6 bg-[#5C6B4A]/5 rounded-2xl border border-[#5C6B4A]/8 mb-5">
                <p className="font-serif text-xl lg:text-2xl text-[#3D3D3D] mb-2 leading-snug">{nextBloom.title}</p>
                <p className="text-[#8B8178] text-sm leading-relaxed">{nextBloom.description}</p>
                {nextBloom.action_hint && (
                    <p className="mt-3 flex items-center gap-2 text-[#5C6B4A] text-xs font-semibold">
                        <ArrowRight className="w-3 h-3" />{nextBloom.action_hint}
                    </p>
                )}
            </div>

            <div className="flex items-center justify-between">
                <span className="mono-tag text-[8px] text-[#8B8178]/30">
                    Via {nextBloom.source === "roadmap" ? "pathway" : "goals"}
                </span>
                <Link to="/roadmap" className="group/link inline-flex items-center gap-1.5 text-[#5C6B4A] text-sm font-semibold hover:gap-2.5 transition-all duration-500">
                    View pathways <ChevronRight className="w-3.5 h-3.5" />
                </Link>
            </div>
        </motion.section>
    );
}
