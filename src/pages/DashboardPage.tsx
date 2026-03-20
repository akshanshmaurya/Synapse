import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
    Leaf, Sun, Droplets, Wind, Home, MessageSquare, Map, User, BarChart3,
    ChevronRight, LogOut, ArrowRight, Sparkles, TrendingUp, Flame, Target, AlertTriangle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchDashboardData, DashboardData } from "@/services/api";

/* ──────────────────────────────────────────────
   Animation Presets (Landing Page system)
   ────────────────────────────────────────────── */
const ease = [0.23, 1, 0.32, 1] as const;

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadDashboard = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchDashboardData();
            if (!data) throw new Error("No data");
            setDashboard(data);
        } catch (e) {
            console.error("Failed to load dashboard", e);
            setError("Unable to load your garden.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard", active: true },
        { icon: MessageSquare, label: "Session", path: "/mentor" },
        { icon: Map, label: "Pathways", path: "/roadmap" },
        { icon: BarChart3, label: "Analytics", path: "/analytics" },
        { icon: User, label: "Roots", path: "/profile" },
    ];

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

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

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

    return (
        <div className="min-h-screen bg-[#FDF8F3] relative overflow-hidden">
            {/* Grain Texture */}
            <div className="grain-overlay" />

            {/* Ambient Glows — Large and dramatic like landing hero */}
            <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="absolute -top-40 right-20 w-[600px] h-[600px] rounded-full bg-[#5C6B4A]/6 blur-[140px]" />
                <div className="absolute bottom-20 -left-32 w-[500px] h-[500px] rounded-full bg-[#D4A574]/8 blur-[120px]" />
                <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] rounded-full bg-[#E8DED4]/25 blur-[90px]" />
            </div>

            <div className="flex min-h-screen relative z-10">

                {/* ═══════════════════════════════════════
                    SIDEBAR — Editorial Navigation
                   ═══════════════════════════════════════ */}
                <aside className="w-72 flex-col fixed h-screen hidden md:flex bg-white/40 backdrop-blur-xl border-r border-[#E8DED4]/60">
                    {/* Top Section */}
                    <div className="p-8 pb-0">
                        <Link to="/" className="block mb-1">
                            <span
                                className="text-[#5C6B4A] font-extrabold text-xl tracking-tight uppercase"
                                style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}
                            >
                                Synapse
                            </span>
                        </Link>
                        <div className="flex items-center gap-2 mb-10">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                            <span className="mono-tag text-[8px] text-[#8B8178]/50">Active Session</span>
                        </div>
                    </div>

                    {/* Nav — with index numbers like landing navbar */}
                    <nav className="px-4 space-y-1 flex-1">
                        {navItems.map((item, i) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`group flex items-center gap-3.5 px-5 py-3.5 rounded-2xl transition-all duration-500 relative ${
                                    item.active
                                        ? "bg-[#5C6B4A] text-white shadow-[0_10px_30px_rgba(92,107,74,0.25)]"
                                        : "text-[#8B8178] hover:bg-[#5C6B4A]/5 hover:text-[#3D3D3D]"
                                }`}
                            >
                                <span className={`mono-tag text-[8px] ${item.active ? "text-white/30" : "text-[#8B8178]/30"}`}>
                                    0{i + 1}
                                </span>
                                <item.icon className="w-[18px] h-[18px]" />
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.active && (
                                    <motion.div
                                        layoutId="nav-indicator"
                                        className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white/60"
                                    />
                                )}
                            </Link>
                        ))}
                    </nav>

                    {/* Bottom: User Card */}
                    <div className="p-4 space-y-2 mt-auto">
                        {user && (
                            <div className="px-5 py-4 rounded-2xl bg-[#5C6B4A]/5 border border-[#5C6B4A]/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-[#5C6B4A] flex items-center justify-center text-white text-sm font-bold">
                                        {(user.name || user.email)?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-sm text-[#3D3D3D] font-medium block truncate">
                                            {user.name || user.email}
                                        </span>
                                        <span className="mono-tag text-[7px] text-[#8B8178]/50">Learner</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => { logout(); navigate("/"); }}
                            className="flex items-center gap-3 px-5 py-3 rounded-2xl text-[#8B8178] hover:bg-red-50/80 hover:text-red-500 transition-all duration-500 w-full"
                        >
                            <LogOut className="w-[18px] h-[18px]" />
                            <span className="text-sm font-medium">Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* ═══════════════════════════════════════
                    MAIN CONTENT
                   ═══════════════════════════════════════ */}
                <main className="flex-1 ml-0 md:ml-72 pb-24 md:pb-0">
                    <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-14 py-10 md:py-14 space-y-10">

                        {/* ──── HEADER ──── */}
                        <motion.header
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.9, ease }}
                            className="flex flex-col md:flex-row md:items-end md:justify-between gap-6"
                        >
                            <div>
                                <span className="mono-tag text-[10px] text-[#8B8178] mb-3 block">
                                    // Dashboard
                                </span>
                                <h1
                                    className="text-[clamp(2.5rem,5vw,4rem)] font-black leading-[0.9] tracking-tight text-[#5C6B4A] uppercase"
                                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}
                                >
                                    Your<br />Garden.
                                </h1>
                            </div>

                            {/* Quick action */}
                            <Link
                                to="/mentor"
                                className="group inline-flex items-center gap-3 px-7 py-4 bg-[#5C6B4A] text-white rounded-full font-semibold text-sm hover:bg-[#4A5A3A] hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(92,107,74,0.25)] transition-all duration-500 w-fit"
                            >
                                New Session
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </motion.header>

                        {isLoading ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-40 gap-4">
                                <div className="w-14 h-14 rounded-full bg-[#5C6B4A] flex items-center justify-center shadow-[0_10px_30px_rgba(92,107,74,0.2)]">
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                </div>
                                <span className="mono-tag text-[10px] text-[#8B8178]">Growing your garden...</span>
                            </motion.div>
                        ) : error ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 gap-5 text-center px-4">
                                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-[#3D3D3D] font-bold text-lg">{error}</h3>
                                    <p className="text-[#8B8178] text-sm mt-1 max-w-sm">Connection lost.</p>
                                </div>
                                <button onClick={loadDashboard} className="mt-2 px-6 py-2.5 rounded-full bg-[#5C6B4A] text-white text-sm font-semibold hover:bg-[#4A5A3A] transition-colors shadow-md">
                                    Retry
                                </button>
                            </motion.div>
                        ) : dashboard ? (
                            dashboard.effort.total_sessions === 0 ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 gap-5 text-center px-4 bg-white/40 backdrop-blur-md rounded-3xl border border-[#E8DED4] shadow-sm">
                                    <div className="w-16 h-16 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                        <Leaf className="w-6 h-6 text-[#5C6B4A]" />
                                    </div>
                                    <div>
                                        <h3 className="text-[#3D3D3D] font-bold text-lg">Your garden is waiting for seeds.</h3>
                                        <p className="text-[#8B8178] text-sm mt-1 max-w-sm">Start a session to begin.</p>
                                    </div>
                                    <button onClick={() => navigate("/mentor")} className="mt-3 px-6 py-2.5 rounded-full bg-[#5C6B4A] text-white text-sm font-semibold hover:bg-[#4A5A3A] transition-colors shadow-md flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" /> Start Session
                                    </button>
                                </motion.div>
                            ) : (
                                <>
                                {/* ────────────────────────────────────────
                                    HERO: Momentum — Full-width dark card
                                   ──────────────────────────────────────── */}
                                <motion.section
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.9, delay: 0.1, ease }}
                                    className="relative rounded-[2.5rem] overflow-hidden"
                                >
                                    {/* Dark BG */}
                                    <div className="absolute inset-0 bg-[#4A5A3A]" />
                                    {/* Grain overlay */}
                                    <div
                                        className="absolute inset-0 opacity-[0.04] pointer-events-none"
                                        style={{
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                                            mixBlendMode: "multiply",
                                        }}
                                    />
                                    {/* Internal ambient glows */}
                                    <div className="absolute -top-24 -right-24 w-[350px] h-[350px] rounded-full bg-white/5 blur-[100px]" />
                                    <div className="absolute bottom-0 left-0 w-[250px] h-[250px] rounded-full bg-[#D4A574]/8 blur-[80px]" />

                                    <div className="relative z-10 p-8 md:p-12 lg:p-14">
                                        <div className="flex flex-col lg:flex-row gap-8 lg:gap-14 items-start">

                                            {/* Left: SVG wave visualization */}
                                            <div className="flex-shrink-0 w-32 h-44 md:w-40 md:h-52">
                                                <svg viewBox="0 0 100 150" className="w-full h-full">
                                                    {/* Grid lines */}
                                                    {[30, 60, 90, 120].map(y => (
                                                        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                                                    ))}
                                                    <motion.path
                                                        initial={{ pathLength: 0 }}
                                                        animate={{ pathLength: 1 }}
                                                        transition={{ duration: 2.5, ease: "easeOut" }}
                                                        d={dashboard.momentum.state === "starting" || dashboard.momentum.state === "struggling"
                                                            ? "M 10 140 Q 30 130 50 135 T 90 120"
                                                            : dashboard.momentum.state === "building"
                                                                ? "M 10 140 Q 30 110 50 115 T 90 90"
                                                                : dashboard.momentum.state === "steady"
                                                                    ? "M 10 140 Q 30 100 50 105 T 90 70"
                                                                    : "M 10 140 Q 30 90 50 80 T 90 40"
                                                        }
                                                        stroke={dashboard.momentum.state === "struggling" ? "#D4A574" : "rgba(255,255,255,0.6)"}
                                                        strokeWidth="2.5"
                                                        fill="none"
                                                        strokeLinecap="round"
                                                    />
                                                    {/* Glow trail */}
                                                    <motion.path
                                                        initial={{ pathLength: 0, opacity: 0 }}
                                                        animate={{ pathLength: 1, opacity: 1 }}
                                                        transition={{ duration: 2.5, ease: "easeOut" }}
                                                        d={dashboard.momentum.state === "starting" || dashboard.momentum.state === "struggling"
                                                            ? "M 10 140 Q 30 130 50 135 T 90 120"
                                                            : dashboard.momentum.state === "building"
                                                                ? "M 10 140 Q 30 110 50 115 T 90 90"
                                                                : dashboard.momentum.state === "steady"
                                                                    ? "M 10 140 Q 30 100 50 105 T 90 70"
                                                                    : "M 10 140 Q 30 90 50 80 T 90 40"
                                                        }
                                                        stroke={dashboard.momentum.state === "struggling" ? "#D4A574" : "rgba(255,255,255,0.15)"}
                                                        strokeWidth="8"
                                                        fill="none"
                                                        strokeLinecap="round"
                                                        filter="blur(4px)"
                                                    />
                                                    <motion.circle
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ duration: 0.6, delay: 2 }}
                                                        cx="90"
                                                        cy={dashboard.momentum.state === "starting" || dashboard.momentum.state === "struggling" ? "120"
                                                            : dashboard.momentum.state === "building" ? "90"
                                                                : dashboard.momentum.state === "steady" ? "70" : "40"}
                                                        r="5"
                                                        fill="#D4A574"
                                                    />
                                                    {/* Pulse ring */}
                                                    <motion.circle
                                                        initial={{ scale: 0, opacity: 0 }}
                                                        animate={{ scale: 2.5, opacity: [0, 0.3, 0] }}
                                                        transition={{ duration: 2, delay: 2.2, repeat: Infinity, repeatDelay: 3 }}
                                                        cx="90"
                                                        cy={dashboard.momentum.state === "starting" || dashboard.momentum.state === "struggling" ? "120"
                                                            : dashboard.momentum.state === "building" ? "90"
                                                                : dashboard.momentum.state === "steady" ? "70" : "40"}
                                                        r="5"
                                                        fill="none"
                                                        stroke="#D4A574"
                                                        strokeWidth="1"
                                                    />
                                                </svg>
                                            </div>

                                            {/* Right: Momentum info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50">
                                                        {getMomentumIcon(dashboard.momentum.state)}
                                                    </div>
                                                    <span className="mono-tag text-[10px] text-white/30">Understanding</span>
                                                </div>

                                                <h2
                                                    className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-[0.95] tracking-tight mb-4"
                                                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.03em" }}
                                                >
                                                    {getMomentumLabel(dashboard.momentum.state)}
                                                </h2>

                                                <p className="text-white/45 text-sm md:text-base leading-relaxed mb-8 max-w-lg">
                                                    {dashboard.momentum.insight}
                                                </p>

                                                {/* Metric pills */}
                                                <div className="flex flex-wrap gap-3">
                                                    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/8 border border-white/10 backdrop-blur-sm">
                                                        <Sun className="w-4 h-4 text-[#D4A574]" />
                                                        <span className="text-[13px] text-white/60">Clarity</span>
                                                        <span className="text-[13px] text-white font-bold">{dashboard.momentum.metrics.clarity_score}%</span>
                                                    </div>
                                                    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/8 border border-white/10 backdrop-blur-sm">
                                                        <Wind className="w-4 h-4 text-white/40" />
                                                        <span className="text-[13px] text-white/60">Trend</span>
                                                        <span className="text-[13px] text-white font-bold">{getTrendDisplay(dashboard.momentum.metrics.understanding_trend)}</span>
                                                    </div>
                                                    {dashboard.momentum.metrics.understanding_delta !== 0 && (
                                                        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/8 border border-white/10 backdrop-blur-sm">
                                                            <Droplets className="w-4 h-4 text-white/40" />
                                                            <span className="text-[13px] text-white/60">Δ</span>
                                                            <span className={`text-[13px] font-bold ${dashboard.momentum.metrics.understanding_delta > 0 ? "text-emerald-300" : "text-amber-300"}`}>
                                                                {dashboard.momentum.metrics.understanding_delta > 0 ? "+" : ""}{dashboard.momentum.metrics.understanding_delta}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom decorative bar */}
                                        <div className="mt-10 pt-6 border-t border-white/8 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <Flame className="w-3.5 h-3.5 text-[#D4A574]" />
                                                    <span className="text-[12px] text-white/40">{dashboard.effort.sessions_this_week} sessions this week</span>
                                                </div>
                                                <div className="w-px h-3 bg-white/10" />
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[12px] text-white/40">{dashboard.effort.consistency_streak} day streak</span>
                                                </div>
                                                <div className="w-px h-3 bg-white/10" />
                                                <span className="mono-tag text-[8px] text-white/20">{dashboard.effort.persistence_label}</span>
                                            </div>
                                            <span className="mono-tag text-[8px] text-white/15 hidden md:block">SYNAPSE // GROWTH METRICS</span>
                                        </div>
                                    </div>
                                </motion.section>

                                {/* ────────────────────────────────────────
                                    BENTO GRID — 3-Column Layout
                                   ──────────────────────────────────────── */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

                                    {/* ── Card 1: Next Focus ── */}
                                    {dashboard.next_bloom && (
                                        <motion.section
                                            initial={{ opacity: 0, y: 25 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.8, delay: 0.2, ease }}
                                            className="relative group rounded-[2rem] p-7 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-2 hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_30px_60px_-12px_rgba(0,0,0,0.08)] transition-all transition-duration-[600ms] cursor-default lg:col-span-2"
                                        >
                                            {/* Corner accent */}
                                            <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-[#5C6B4A]/20 group-hover:bg-[#5C6B4A]/40 transition-colors duration-500" />

                                            <div className="flex items-center gap-2.5 mb-5">
                                                <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                                    <Leaf className="w-4 h-4 text-[#5C6B4A]" />
                                                </div>
                                                <span className="mono-tag text-[9px] text-[#8B8178]">Next Focus</span>
                                            </div>

                                            <div className="p-5 lg:p-6 bg-[#5C6B4A]/5 rounded-2xl border border-[#5C6B4A]/8 mb-5">
                                                <p className="font-serif text-xl lg:text-2xl text-[#3D3D3D] mb-2 leading-snug">
                                                    {dashboard.next_bloom.title}
                                                </p>
                                                <p className="text-[#8B8178] text-sm leading-relaxed">
                                                    {dashboard.next_bloom.description}
                                                </p>
                                                {dashboard.next_bloom.action_hint && (
                                                    <p className="mt-3 flex items-center gap-2 text-[#5C6B4A] text-xs font-semibold">
                                                        <ArrowRight className="w-3 h-3" />
                                                        {dashboard.next_bloom.action_hint}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="mono-tag text-[8px] text-[#8B8178]/30">
                                                    Via {dashboard.next_bloom.source === "roadmap" ? "pathway" : "goals"}
                                                </span>
                                                <Link
                                                    to="/roadmap"
                                                    className="group/link inline-flex items-center gap-1.5 text-[#5C6B4A] text-sm font-semibold hover:gap-2.5 transition-all duration-500"
                                                >
                                                    View pathways <ChevronRight className="w-3.5 h-3.5" />
                                                </Link>
                                            </div>
                                        </motion.section>
                                    )}

                                    {/* ── Card 2: Start Session ── */}
                                    <motion.section
                                        initial={{ opacity: 0, y: 25 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, delay: 0.3, ease }}
                                        className="relative group rounded-[2rem] overflow-hidden bg-[#5C6B4A] hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(92,107,74,0.25)] transition-all transition-duration-[600ms] cursor-pointer flex flex-col justify-between"
                                        onClick={() => navigate("/mentor")}
                                    >
                                        {/* Grain */}
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

                                            <h3
                                                className="text-2xl font-black text-white leading-tight tracking-tight mb-3 mt-auto"
                                                style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}
                                            >
                                                Continue<br />Growing.
                                            </h3>

                                            <p className="text-white/40 text-sm mb-6">
                                                Pick up where you left off.
                                            </p>

                                            <div className="flex items-center gap-2 text-white group-hover:gap-3 transition-all duration-500">
                                                <span className="text-sm font-semibold">Start session</span>
                                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                            </div>
                                        </div>
                                    </motion.section>

                                    {/* ── Card 3: Daily Nurture / Reflect ── */}
                                    {dashboard.show_daily_nurture && dashboard.daily_nurture_prompt && (
                                        <motion.section
                                            initial={{ opacity: 0, y: 25 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.8, delay: 0.35, ease }}
                                            className="relative group rounded-[2rem] p-7 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-2 hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_30px_60px_-12px_rgba(0,0,0,0.08)] transition-all transition-duration-[600ms] cursor-default lg:col-span-2"
                                        >
                                            <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-[#D4A574]/20 group-hover:bg-[#D4A574]/40 transition-colors duration-500" />

                                            <div className="flex items-center gap-2.5 mb-5">
                                                <div className="w-8 h-8 rounded-full bg-[#D4A574]/10 flex items-center justify-center">
                                                    <Droplets className="w-4 h-4 text-[#D4A574]" />
                                                </div>
                                                <span className="mono-tag text-[9px] text-[#8B8178]">Reflect</span>
                                            </div>

                                            <p className="font-serif text-xl text-[#3D3D3D] mb-5 leading-relaxed">
                                                "{dashboard.daily_nurture_prompt}"
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
                                    )}

                                    {/* ── Card 4: Analytics Quick View ── */}
                                    <motion.section
                                        initial={{ opacity: 0, y: 25 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, delay: 0.4, ease }}
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

                                        {/* Mini chart visual */}
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
                                </div>

                                {/* ────────────────────────────────────────
                                    RECENT SIGNALS — Timeline style
                                   ──────────────────────────────────────── */}
                                {dashboard.recent_signals.length > 0 && (
                                    <motion.section
                                        initial={{ opacity: 0, y: 25 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, delay: 0.45, ease }}
                                        className="relative rounded-[2rem] p-8 md:p-10 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]"
                                    >
                                        <div className="flex items-center gap-2.5 mb-8">
                                            <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                                <Sparkles className="w-4 h-4 text-[#5C6B4A]" />
                                            </div>
                                            <span className="mono-tag text-[9px] text-[#8B8178]">Recent Signals</span>
                                            <span className="mono-tag text-[8px] text-[#8B8178]/25 ml-auto">{dashboard.recent_signals.length} observations</span>
                                        </div>

                                        <div className="space-y-0 relative">
                                            {/* Vertical timeline line */}
                                            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-[#5C6B4A]/20 via-[#D4A574]/15 to-transparent" />

                                            {dashboard.recent_signals.map((signal, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ duration: 0.6, delay: 0.5 + idx * 0.08, ease }}
                                                    className="flex items-start gap-5 py-4 group/signal"
                                                >
                                                    {/* Timeline dot */}
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
                                )}
                            </>
                            )
                        ) : null}

                        {/* Footer */}
                        <motion.footer
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.7, ease }}
                            className="py-6 flex items-center gap-3"
                        >
                            <div className="w-8 h-px bg-[#E8DED4]" />
                            <span className="mono-tag text-[9px] text-[#8B8178]/30">Your progress is tracked, not scripted</span>
                        </motion.footer>
                    </div>
                </main>
            </div>

            {/* ═══ MOBILE BOTTOM NAV ═══ */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-2xl border-t border-[#E8DED4]/50 px-2 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <div className="flex justify-around">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 ${
                                item.active ? "text-[#5C6B4A]" : "text-[#8B8178]/50"
                            }`}
                        >
                            <item.icon className={`w-5 h-5 ${item.active ? "drop-shadow-sm" : ""}`} />
                            <span className="text-[9px] font-medium">{item.label}</span>
                            {item.active && <div className="w-1 h-1 rounded-full bg-[#5C6B4A]" />}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
