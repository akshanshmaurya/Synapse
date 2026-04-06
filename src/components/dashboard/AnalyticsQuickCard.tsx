import { motion } from "framer-motion";
import { BarChart3, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ease = [0.23, 1, 0.32, 1] as const;

export default function AnalyticsQuickCard({ delay = 0.4 }: { delay?: number }) {
    const navigate = useNavigate();

    return (
        <motion.section
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay, ease }}
            className="relative group rounded-[2rem] p-7 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-2 hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_30px_60px_-12px_rgba(0,0,0,0.08)] transition-all transition-duration-[600ms] cursor-pointer"
            onClick={() => navigate("/analytics")}
        >
            <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-[#8B8178]/15 group-hover:bg-[#8B8178]/30 transition-colors duration-500" />

            <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#8B8178]/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-[#8B8178]" />
                </div>
                <span className="mono-tag text-[9px] text-[#8B8178]">Analytics</span>
            </div>

            <div className="flex items-end gap-1 h-16 mb-4">
                {[35, 55, 40, 70, 60, 80, 65].map((h, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.6, delay: 0.5 + i * 0.08, ease }}
                        className="flex-1 rounded-t-md bg-[#5C6B4A]/15 group-hover:bg-[#5C6B4A]/25 transition-colors duration-500"
                    />
                ))}
            </div>

            <p className="text-[#8B8178] text-sm mb-4">View your learning patterns and clarity trends.</p>

            <div className="flex items-center gap-2 text-[#5C6B4A] group-hover:gap-3 transition-all duration-500">
                <span className="text-sm font-semibold">View analytics</span>
                <ChevronRight className="w-3.5 h-3.5" />
            </div>
        </motion.section>
    );
}
