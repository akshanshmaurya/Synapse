import { motion } from "framer-motion";
import { Droplets, ArrowRight } from "lucide-react";

const ease = [0.23, 1, 0.32, 1] as const;

interface DailyNurtureCardProps {
    prompt: string;
    delay?: number;
}

export default function DailyNurtureCard({ prompt, delay = 0.35 }: DailyNurtureCardProps) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay, ease }}
            className="relative group rounded-[2rem] p-7 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-2 hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_30px_60px_-12px_rgba(0,0,0,0.08)] transition-all transition-duration-[600ms] cursor-default"
        >
            <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-[#D4A574]/20 group-hover:bg-[#D4A574]/40 transition-colors duration-500" />

            <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-full bg-[#D4A574]/10 flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-[#D4A574]" />
                </div>
                <span className="mono-tag text-[9px] text-[#8B8178]">Reflect</span>
            </div>

            <p className="font-serif text-xl text-[#3D3D3D] mb-5 leading-relaxed">
                "{prompt}"
            </p>

            <textarea
                placeholder="Your thoughts..."
                className="w-full bg-white/60 border border-[#E8DED4] rounded-2xl p-4 text-[#3D3D3D] placeholder:text-[#8B8178]/40 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-[#5C6B4A]/15 focus:border-[#5C6B4A]/30 transition-all duration-500 backdrop-blur-sm"
                style={{ fontFamily: "'Inter', sans-serif" }}
            />

            <button className="mt-4 group/btn px-6 py-3 bg-[#5C6B4A] text-white rounded-full text-sm font-semibold hover:bg-[#4A5A3A] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(92,107,74,0.2)] transition-all duration-500 flex items-center gap-2 w-fit">
                Save reflection
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
            </button>
        </motion.section>
    );
}
