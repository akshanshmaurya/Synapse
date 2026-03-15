import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, User, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/* ──────────────────────────────────────────────
   Animation Presets (matches Landing Page)
   ────────────────────────────────────────────── */
const ease = [0.23, 1, 0.32, 1];
const stagger = {
    container: { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } },
    item: {
        hidden: { opacity: 0, y: 25 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } },
    },
};

export default function SignUpPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        if (password.length < 6) {
            setError("Password should be at least 6 characters");
            return;
        }

        setIsLoading(true);

        try {
            await signup(email, password, name);
            navigate("/onboarding");
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

            {/* Ambient Glows */}
            <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#D4A574]/10 blur-[100px]" />
                <div className="absolute bottom-0 -right-24 w-[400px] h-[400px] rounded-full bg-[#5C6B4A]/8 blur-[100px]" />
                <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-[#E8DED4]/30 blur-[80px]" />
            </div>

            {/* ─── Main Split Layout ─── */}
            <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-2">

                {/* ═══ LEFT PANEL — Form ═══ */}
                <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-24 py-12 relative order-2 lg:order-1">

                    {/* Mobile Logo */}
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
                                // New Learner
                            </span>
                            <h1 className="font-serif text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight text-[#5C6B4A] mb-3">
                                Begin your journey.
                            </h1>
                            <p className="text-[#8B8178] text-base leading-relaxed mb-8">
                                Plant the first seed — your mentor will grow with you.
                            </p>
                        </motion.div>

                        {/* Error */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className="mb-5 px-5 py-4 rounded-2xl bg-red-50/80 border border-red-100 backdrop-blur-sm"
                            >
                                <p className="text-red-600 text-sm">{error}</p>
                            </motion.div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Name */}
                            <motion.div variants={stagger.item}>
                                <label className="mono-tag text-[9px] text-[#8B8178] mb-2 block">Name (Optional)</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8B8178]/60 transition-colors group-focus-within:text-[#5C6B4A]" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="How should we call you?"
                                        className="w-full pl-12 pr-4 py-4 bg-white/50 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] placeholder:text-[#8B8178]/40 focus:outline-none focus:ring-2 focus:ring-[#5C6B4A]/15 focus:border-[#5C6B4A]/30 transition-all duration-500 backdrop-blur-sm"
                                        style={{ fontFamily: "'Inter', sans-serif" }}
                                    />
                                </div>
                            </motion.div>

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
                                        placeholder="At least 6 characters"
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

                            {/* Confirm Password */}
                            <motion.div variants={stagger.item}>
                                <label className="mono-tag text-[9px] text-[#8B8178] mb-2 block">Confirm Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#8B8178]/60 transition-colors group-focus-within:text-[#5C6B4A]" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm your password"
                                        className="w-full pl-12 pr-4 py-4 bg-white/50 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] placeholder:text-[#8B8178]/40 focus:outline-none focus:ring-2 focus:ring-[#5C6B4A]/15 focus:border-[#5C6B4A]/30 transition-all duration-500 backdrop-blur-sm"
                                        style={{ fontFamily: "'Inter', sans-serif" }}
                                        required
                                    />
                                </div>
                            </motion.div>

                            {/* Submit */}
                            <motion.div variants={stagger.item} className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="group w-full py-4 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-semibold text-base flex items-center justify-center gap-3 transition-all duration-500 hover:bg-[#4A5A3A] hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(92,107,74,0.2)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                                >
                                    {isLoading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Planting your seed...
                                        </span>
                                    ) : (
                                        <>
                                            Begin Growing
                                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        </form>

                        {/* Divider */}
                        <motion.div variants={stagger.item} className="flex items-center gap-4 my-7">
                            <div className="flex-1 h-px bg-[#E8DED4]" />
                            <span className="mono-tag text-[9px] text-[#8B8178]/50">OR</span>
                            <div className="flex-1 h-px bg-[#E8DED4]" />
                        </motion.div>

                        {/* Sign In Link */}
                        <motion.div variants={stagger.item} className="text-center">
                            <p className="text-[#8B8178] text-sm">
                                Already have roots here?{" "}
                                <Link to="/signin" className="text-[#5C6B4A] font-semibold hover:underline underline-offset-4 transition-all">
                                    Return to your garden
                                </Link>
                            </p>
                        </motion.div>

                        {/* Footer */}
                        <motion.div variants={stagger.item} className="mt-10 flex items-center gap-3">
                            <div className="w-6 h-px bg-[#E8DED4]" />
                            <span className="mono-tag text-[9px] text-[#8B8178]/40">Growth begins with a single step</span>
                        </motion.div>
                    </motion.div>
                </div>

                {/* ═══ RIGHT PANEL — Decorative ═══ */}
                <div className="hidden lg:flex relative flex-col justify-between p-12 xl:p-16 overflow-hidden order-1 lg:order-2">
                    {/* Background */}
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
                        className="relative z-10 self-end"
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

                    {/* Central Decorative — Alabaster Bento Cards */}
                    <div className="relative z-10 flex-1 flex items-center justify-center py-8">
                        <div className="grid grid-cols-2 gap-4 max-w-[380px] w-full">
                            {[
                                { num: "01", label: "MEMORY", desc: "We remember\nyour journey", delay: 0.2 },
                                { num: "02", label: "ADAPT", desc: "Your path\nrecalibrates", delay: 0.35 },
                                { num: "03", label: "EVALUATE", desc: "Honest progress\ntracking", delay: 0.5 },
                                { num: "04", label: "GROW", desc: "Sustained\nmomentum", delay: 0.65 },
                            ].map((card) => (
                                <motion.div
                                    key={card.num}
                                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.9, delay: card.delay, ease }}
                                    className="relative p-6 rounded-[1.5rem] bg-white/8 border border-white/10 backdrop-blur-sm aspect-square flex flex-col justify-between overflow-hidden group hover:bg-white/12 transition-all duration-500"
                                >
                                    <span className="mono-tag text-[9px] text-white/25">{card.num}</span>
                                    <div>
                                        <p className="text-white/70 text-sm leading-snug font-medium whitespace-pre-line mb-2">
                                            {card.desc}
                                        </p>
                                        <span className="mono-tag text-[8px] text-white/30">{card.label}</span>
                                    </div>
                                    {/* Corner accent */}
                                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white/15 group-hover:bg-white/30 transition-colors duration-500" />
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.8, ease }}
                        className="relative z-10"
                    >
                        <p className="text-white/40 text-sm leading-relaxed max-w-xs"
                           style={{ fontFamily: "'Inter', sans-serif" }}
                        >
                            "A career path carved from the raw stone of potential."
                        </p>
                        <div className="mt-4 flex items-center gap-3">
                            <div className="w-8 h-px bg-white/20" />
                            <span className="mono-tag text-[9px] text-white/25">BUILT FOR GROWTH // 2026</span>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
