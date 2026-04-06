import { motion } from "framer-motion";
import { MessageSquare, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ease = [0.23, 1, 0.32, 1] as const;

export default function StartSessionCard({ delay = 0.3 }: { delay?: number }) {
    const navigate = useNavigate();

    return (
        <motion.section
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay, ease }}
            className="relative group rounded-[2rem] overflow-hidden bg-[#5C6B4A] hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(92,107,74,0.25)] transition-all transition-duration-[600ms] cursor-pointer flex flex-col justify-between"
            onClick={() => navigate("/mentor")}
        >
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    mixBlendMode: "multiply",
                }}
            />
            <div className="absolute -bottom-10 -right-10 w-[200px] h-[200px] rounded-full bg-white/5 blur-[60px]" />

            <div className="relative z-10 p-7 flex flex-col flex-1">
                <div className="flex items-center gap-2.5 mb-5">
                    <MessageSquare className="w-4 h-4 text-white/50" />
                    <span className="mono-tag text-[9px] text-white/30">Session</span>
                </div>

                <h3 className="text-2xl font-black text-white leading-tight tracking-tight mb-3 mt-auto"
                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
                    Continue<br />Growing.
                </h3>

                <p className="text-white/40 text-sm mb-6">Pick up where you left off.</p>

                <div className="flex items-center gap-2 text-white group-hover:gap-3 transition-all duration-500">
                    <span className="text-sm font-semibold">Start session</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
            </div>
        </motion.section>
    );
}
