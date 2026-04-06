import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Leaf, MessageSquare, ArrowRight, AlertTriangle } from "lucide-react";
import { fetchDashboardData, fetchDashboardRecommendations } from "@/services/api";
import type { DashboardData, DashboardRecommendationsData } from "@/services/api";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import AppShell from "@/components/layout/AppShell";

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

const ease = [0.23, 1, 0.32, 1] as const;

export default function DashboardPage() {
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

    return (
        <AppShell activePath="/dashboard">
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
                            <MomentumHero momentum={dashboard.momentum} effort={dashboard.effort} />

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {recs?.velocity && <LearningVelocityCard velocity={recs.velocity} delay={0.15} />}
                                <StartSessionCard delay={0.2} />
                                {recs?.next_steps && recs.next_steps.length > 0 && <WhatToLearnNext nextSteps={recs.next_steps} delay={0.25} />}
                                <AnalyticsQuickCard delay={0.3} />
                                {dashboard.show_daily_nurture && dashboard.daily_nurture_prompt && (
                                    <div className="lg:col-span-2">
                                        <DailyNurtureCard prompt={dashboard.daily_nurture_prompt} delay={0.35} />
                                    </div>
                                )}
                                {dashboard.next_bloom && <NextFocusCard nextBloom={dashboard.next_bloom} delay={0.4} />}
                            </div>

                            {recs?.recent_sessions && <RecentSessionsTimeline sessions={recs.recent_sessions} delay={0.4} />}
                            <RecentSignals signals={dashboard.recent_signals} delay={0.45} />
                        </>
                    )
                ) : null}

                <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.7, ease }}
                    className="py-6 flex items-center gap-3">
                    <div className="w-8 h-px bg-[#E8DED4]" />
                    <span className="mono-tag text-[9px] text-[#8B8178]/30">Your progress is tracked, not scripted</span>
                </motion.footer>
            </div>
        </AppShell>
    );
}
