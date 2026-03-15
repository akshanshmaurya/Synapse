import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/* ──────────────────────────────────────────────
   Animation Presets (matches Landing Page)
   ────────────────────────────────────────────── */
const ease = [0.23, 1, 0.32, 1];
const stagger = {
    container: { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } },
    item: {
        hidden: { opacity: 0, y: 25 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } },
    },
};

export default function SignInPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const result = await login(email, password);
            if (result.needsOnboarding) {
                navigate("/onboarding");
            } else {
                navigate("/dashboard");
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDF8F3] relative overflow-hidden">
            {/* Grain Texture — same as Landing */}
            <div className="grain-overlay" />

            {/* Ambient Glows — same palette as Landing */}
            <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[#5C6B4A]/8 blur-[100px]" />
                <div className="absolute bottom-0 -left-24 w-[400px] h-[400px] rounded-full bg-[#D4A574]/10 blur-[100px]" />
                <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] rounded-full bg-[#E8DED4]/30 blur-[80px]" />
            </div>

            {/* ─── Main Split Layout ─── */}
            <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-2">

                {/* ═══ LEFT PANEL — Decorative ═══ */}
                <div className="hidden lg:flex relative flex-col justify-between p-12 xl:p-16 overflow-hidden">
                    {/* Background for left panel */}
                    <div className="absolute inset-0 bg-[#4A5A3A]" />
                    <div
                        className="absolute inset-0 opacity-[0.03] pointer-events-none"
                        style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                            mixBlendMode: "multiply",
                        }}
                    />

                    {/* Logo */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease }}
                        className="relative z-10"
                    >
                        <Link to="/" className="inline-block">
                            <span
                                className="text-[#FDF8F3] font-extrabold text-xl tracking-tight uppercase"
                                style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}
                            >
                                Synapse
                            </span>
                        </Link>
                    </motion.div>

                    {/* Decorative Monolith Pillars */}
                    <div className="relative z-10 flex-1 flex items-center justify-center">
                        <div className="flex gap-6 items-end h-[55%] w-full max-w-[360px]">
                            {[
                                { label: "REMEMBER", height: "55%", width: "30%", delay: 0 },
                                { label: "RECONNECT", height: "80%", width: "35%", delay: 0.2 },
                                { label: "RESUME", height: "45%", width: "30%", delay: 0.4 },
                            ].map((pillar, i) => (
                                <motion.div
                                    key={pillar.label}
                                    initial={{ opacity: 0, y: 60, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 1, delay: 0.3 + pillar.delay, ease }}
                                    style={{ height: pillar.height, width: pillar.width }}
                                    className="relative rounded-t-[60px] rounded-b-[12px] bg-gradient-to-b from-white/15 to-white/5 border border-white/10 backdrop-blur-md flex flex-col justify-end items-center pb-6 overflow-hidden"
                                >
                                    {/* Shimmer effect */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                                    <span
                                        className="text-[0.55rem] text-white/30 tracking-[0.2em] text-center"
                                        style={{
                                            fontFamily: "'JetBrains Mono', monospace",
                                            writingMode: "vertical-rl",
                                            textOrientation: "mixed",
                                            transform: "rotate(180deg)",
                                        }}
                                    >
                                        {pillar.label}
                                    </span>
                                    <div className="w-2 h-2 bg-white/30 rounded-full mt-4" />
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Quote */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.8, ease }}
                        className="relative z-10"
                    >
                        <p className="text-white/40 text-sm leading-relaxed max-w-xs"
                           style={{ fontFamily: "'Inter', sans-serif" }}
                        >
                            "Every session builds on the last. Your mentor remembers — so you don't have to."
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                            <div className="w-8 h-px bg-white/20" />
                            <span className="mono-tag text-[9px] text-white/25">SYNAPSE // 2026</span>
                        </div>
                    </motion.div>
                </div>

                {/* ═══ RIGHT PANEL — Sign In Form ═══ */}
                <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12 relative">

                    {/* Mobile Logo (hidden on desktop) */}
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease }}
                        className="lg:hidden mb-10"
                    >
                        <Link to="/">
                            <span
                                className="text-[#5C6B4A] font-extrabold text-xl tracking-tight uppercase"
                                style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}
                            >
                                Synapse
                            </span>
                        </Link>
                    </motion.div>

                    {/* Form Container */}
                    <motion.div
                        variants={stagger.container}
                        initial="hidden"
                        animate="visible"
                        className="w-full max-w-[440px] mx-auto lg:mx-0"
                    >
                        {/* Header */}
                        <motion.div variants={stagger.item}>
                            <span className="mono-tag text-[10px] text-[#8B8178] mb-4 block">
                                // Welcome Back
                            </span>
                            <h1
                                className="font-serif text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight text-[#5C6B4A] mb-3"
                            >
                                Continue your journey.
                            </h1>
                            <p className="text-[#8B8178] text-base leading-relaxed mb-10">
                                Your mentor is waiting — pick up exactly where you left off.
                            </p>
                        </motion.div>

                        {/* Error Message */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="mb-6 px-5 py-4 rounded-2xl bg-red-50/80 border border-red-100 backdrop-blur-sm"
                            >
                                <p className="text-red-600 text-sm">{error}</p>
                            </motion.div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Email */}
                            <motion.div variants={stagger.item}>
                                <label className="mono-tag text-[9px] text-[#8B8178] mb-2 block">Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8B8178]/60 transition-colors group-focus-within:text-[#5C6B4A]" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        className="w-full pl-12 pr-4 py-4 bg-white/50 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] placeholder:text-[#8B8178]/40 focus:outline-none focus:ring-2 focus:ring-[#5C6B4A]/15 focus:border-[#5C6B4A]/30 transition-all duration-500 backdrop-blur-sm"
                                        style={{ fontFamily: "'Inter', sans-serif" }}
                                        required
                                    />
                                </div>
                            </motion.div>

                            {/* Password */}
                            <motion.div variants={stagger.item}>
                                <label className="mono-tag text-[9px] text-[#8B8178] mb-2 block">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8B8178]/60 transition-colors group-focus-within:text-[#5C6B4A]" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Your password"
                                        className="w-full pl-12 pr-12 py-4 bg-white/50 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] placeholder:text-[#8B8178]/40 focus:outline-none focus:ring-2 focus:ring-[#5C6B4A]/15 focus:border-[#5C6B4A]/30 transition-all duration-500 backdrop-blur-sm"
                                        style={{ fontFamily: "'Inter', sans-serif" }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B8178]/50 hover:text-[#5C6B4A] transition-colors duration-300"
                                    >
                                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                                    </button>
                                </div>
                            </motion.div>

                            {/* Submit Button */}
                            <motion.div variants={stagger.item}>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="group w-full py-4 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-semibold text-base flex items-center justify-center gap-3 transition-all duration-500 hover:bg-[#4A5A3A] hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(92,107,74,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Entering...
                                        </span>
                                    ) : (
                                        <>
                                            Sign In
                                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        </form>

                        {/* Divider */}
                        <motion.div variants={stagger.item} className="flex items-center gap-4 my-8">
                            <div className="flex-1 h-px bg-[#E8DED4]" />
                            <span className="mono-tag text-[9px] text-[#8B8178]/50">OR</span>
                            <div className="flex-1 h-px bg-[#E8DED4]" />
                        </motion.div>

                        {/* Sign Up Link */}
                        <motion.div variants={stagger.item} className="text-center">
                            <p className="text-[#8B8178] text-sm">
                                New here?{" "}
                                <Link to="/signup" className="text-[#5C6B4A] font-semibold hover:underline underline-offset-4 transition-all">
                                    Begin your journey
                                </Link>
                            </p>
                        </motion.div>

                        {/* Footer */}
                        <motion.div variants={stagger.item} className="mt-12 flex items-center gap-3">
                            <div className="w-6 h-px bg-[#E8DED4]" />
                            <span className="mono-tag text-[9px] text-[#8B8178]/40">A quiet space for growth</span>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
