import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
    Leaf, Home, MessageSquare, Map, User, BarChart3,
    LogOut, ArrowRight, AlertTriangle, Network
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchDashboardData, fetchDashboardRecommendations } from "@/services/api";
import type { DashboardData, DashboardRecommendationsData } from "@/services/api";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";

import {
    MomentumHero,
    NextFocusCard,
    StartSessionCard,
    DailyNurtureCard,
    AnalyticsQuickCard,
    RecentSignals,
    LearningVelocityCard,
    WhatToLearnNext,
    RecentSessionsTimeline,
} from "@/components/dashboard";

/* ──────────────────────────────────────────────
   Animation Presets (Landing Page system)
   ────────────────────────────────────────────── */
const ease = [0.23, 1, 0.32, 1] as const;

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [recs, setRecs] = useState<DashboardRecommendationsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAll = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [dashResult, recsResult] = await Promise.allSettled([
                fetchDashboardData(),
                fetchDashboardRecommendations(),
            ]);
            const dashData = dashResult.status === "fulfilled" ? dashResult.value : null;
            const recsData = recsResult.status === "fulfilled" ? recsResult.value : null;
            if (!dashData) throw new Error("No data");
            setDashboard(dashData);
            setRecs(recsData);
        } catch (e) {
            console.error("Failed to load dashboard", e);
            setError("Unable to load your garden.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadAll(); }, []);

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard", active: true },
        { icon: MessageSquare, label: "Session", path: "/mentor" },
        { icon: Map, label: "Pathways", path: "/roadmap" },
        { icon: Network, label: "Concepts", path: "/concept-map" },
        { icon: BarChart3, label: "Analytics", path: "/analytics" },
        { icon: User, label: "Roots", path: "/profile" },
    ];

    return (
        <div className="min-h-screen bg-[#FDF8F3] relative overflow-hidden">
            <div className="grain-overlay" />

            {/* Ambient Glows */}
            <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="absolute -top-40 right-20 w-[600px] h-[600px] rounded-full bg-[#5C6B4A]/6 blur-[140px]" />
                <div className="absolute bottom-20 -left-32 w-[500px] h-[500px] rounded-full bg-[#D4A574]/8 blur-[120px]" />
                <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] rounded-full bg-[#E8DED4]/25 blur-[90px]" />
            </div>

            <div className="flex min-h-screen relative z-10">

                {/* ═══ SIDEBAR ═══ */}
                <aside className="w-72 flex-col fixed h-screen hidden md:flex bg-white/40 backdrop-blur-xl border-r border-[#E8DED4]/60">
                    <div className="p-8 pb-0">
                        <Link to="/" className="block mb-1">
                            <span className="text-[#5C6B4A] font-extrabold text-xl tracking-tight uppercase"
                                style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}>
                                Synapse
                            </span>
                        </Link>
                        <div className="flex items-center gap-2 mb-10">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                            <span className="mono-tag text-[8px] text-[#8B8178]/50">Active Session</span>
                        </div>
                    </div>

                    <nav className="px-4 space-y-1 flex-1">
                        {navItems.map((item, i) => (
                            <Link key={item.path} to={item.path}
                                className={`group flex items-center gap-3.5 px-5 py-3.5 rounded-2xl transition-all duration-500 relative ${
                                    item.active
                                        ? "bg-[#5C6B4A] text-white shadow-[0_10px_30px_rgba(92,107,74,0.25)]"
                                        : "text-[#8B8178] hover:bg-[#5C6B4A]/5 hover:text-[#3D3D3D]"
                                }`}>
                                <span className={`mono-tag text-[8px] ${item.active ? "text-white/30" : "text-[#8B8178]/30"}`}>0{i + 1}</span>
                                <item.icon className="w-[18px] h-[18px]" />
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.active && (
                                    <motion.div layoutId="nav-indicator" className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white/60" />
                                )}
                            </Link>
                        ))}
                    </nav>

                    <div className="p-4 space-y-2 mt-auto">
                        {user && (
                            <div className="px-5 py-4 rounded-2xl bg-[#5C6B4A]/5 border border-[#5C6B4A]/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-[#5C6B4A] flex items-center justify-center text-white text-sm font-bold">
                                        {(user.name || user.email)?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-sm text-[#3D3D3D] font-medium block truncate">{user.name || user.email}</span>
                                        <span className="mono-tag text-[7px] text-[#8B8178]/50">Learner</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <button onClick={() => { logout(); navigate("/"); }}
                            className="flex items-center gap-3 px-5 py-3 rounded-2xl text-[#8B8178] hover:bg-red-50/80 hover:text-red-500 transition-all duration-500 w-full">
                            <LogOut className="w-[18px] h-[18px]" />
                            <span className="text-sm font-medium">Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* ═══ MAIN CONTENT ═══ */}
                <main className="flex-1 ml-0 md:ml-72 pb-24 md:pb-0">
                    <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-14 py-10 md:py-14 space-y-10">

                        {/* HEADER */}
                        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.9, ease }}
                            className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                            <div>
                                <span className="mono-tag text-[10px] text-[#8B8178] mb-3 block">// Dashboard</span>
                                <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-black leading-[0.9] tracking-tight text-[#5C6B4A] uppercase"
                                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}>
                                    Your<br />Garden.
                                </h1>
                            </div>
                            <Link to="/mentor"
                                className="group inline-flex items-center gap-3 px-7 py-4 bg-[#5C6B4A] text-white rounded-full font-semibold text-sm hover:bg-[#4A5A3A] hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(92,107,74,0.25)] transition-all duration-500 w-fit">
                                New Session
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </motion.header>

                        {isLoading ? (
                            <DashboardSkeleton />
                        ) : error ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-32 gap-5 text-center px-4">
                                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-[#3D3D3D] font-bold text-lg">{error}</h3>
                                    <p className="text-[#8B8178] text-sm mt-1 max-w-sm">Connection lost.</p>
                                </div>
                                <button onClick={loadAll} className="mt-2 px-6 py-2.5 rounded-full bg-[#5C6B4A] text-white text-sm font-semibold hover:bg-[#4A5A3A] transition-colors shadow-md">
                                    Retry
                                </button>
                            </motion.div>
                        ) : dashboard ? (
                            dashboard.effort.total_sessions === 0 ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="flex flex-col items-center justify-center py-32 gap-5 text-center px-4 bg-white/40 backdrop-blur-md rounded-3xl border border-[#E8DED4] shadow-sm">
                                    <div className="w-16 h-16 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                        <Leaf className="w-6 h-6 text-[#5C6B4A]" />
                                    </div>
                                    <div>
                                        <h3 className="text-[#3D3D3D] font-bold text-lg">Your garden is waiting for seeds.</h3>
                                        <p className="text-[#8B8178] text-sm mt-1 max-w-sm">Start a session to begin.</p>
                                    </div>
                                    <button onClick={() => navigate("/mentor")}
                                        className="mt-3 px-6 py-2.5 rounded-full bg-[#5C6B4A] text-white text-sm font-semibold hover:bg-[#4A5A3A] transition-colors shadow-md flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" /> Start Session
                                    </button>
                                </motion.div>
                            ) : (
                                <>
                                    {/* HERO: Momentum */}
                                    <MomentumHero momentum={dashboard.momentum} effort={dashboard.effort} />

                                    {/* BENTO GRID */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                        {/* Row 1: Learning Velocity (2-col) + Start Session (1-col) */}
                                        {recs?.velocity && (
                                            <LearningVelocityCard velocity={recs.velocity} delay={0.15} />
                                        )}
                                        <StartSessionCard delay={0.2} />

                                        {/* Row 2: What to Learn Next (2-col) + Analytics (1-col) */}
                                        {recs?.next_steps && recs.next_steps.length > 0 && (
                                            <WhatToLearnNext nextSteps={recs.next_steps} delay={0.25} />
                                        )}
                                        <AnalyticsQuickCard delay={0.3} />

                                        {/* Row 3: Daily Nurture (2-col, conditional) + Next Focus (1-col, conditional) */}
                                        {dashboard.show_daily_nurture && dashboard.daily_nurture_prompt && (
                                            <div className="lg:col-span-2">
                                                <DailyNurtureCard prompt={dashboard.daily_nurture_prompt} delay={0.35} />
                                            </div>
                                        )}
                                        {dashboard.next_bloom && (
                                            <NextFocusCard nextBloom={dashboard.next_bloom} delay={0.4} />
                                        )}
                                    </div>

                                    {/* RECENT SESSIONS TIMELINE */}
                                    {recs?.recent_sessions && (
                                        <RecentSessionsTimeline sessions={recs.recent_sessions} delay={0.4} />
                                    )}

                                    {/* RECENT SIGNALS */}
                                    <RecentSignals signals={dashboard.recent_signals} delay={0.45} />
                                </>
                            )
                        ) : null}

                        {/* Footer */}
                        <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.7, ease }}
                            className="py-6 flex items-center gap-3">
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
                        <Link key={item.path} to={item.path}
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 ${
                                item.active ? "text-[#5C6B4A]" : "text-[#8B8178]/50"
                            }`}>
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
