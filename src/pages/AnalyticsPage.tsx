import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
    Home, MessageSquare, Map, User, BarChart3, ChevronRight,
    LogOut, TrendingUp, TrendingDown, Minus, Activity,
    AlertTriangle, Zap, Brain, ArrowRight, Leaf, Network
} from "lucide-react";
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAnalyticsData, AnalyticsData } from "@/services/api";

/* ──────────────────────────────────────────────
   Animation Presets (Landing Page system)
   ────────────────────────────────────────────── */
const ease = [0.23, 1, 0.32, 1] as const;

export default function AnalyticsPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const analytics = await fetchAnalyticsData();
            if (!analytics) throw new Error("No data");
            setData(analytics);
        } catch (e) {
            console.error("Failed to load analytics", e);
            setError("Unable to map your progress.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard" },
        { icon: MessageSquare, label: "Session", path: "/mentor" },
        { icon: Map, label: "Pathways", path: "/roadmap" },
        { icon: Network, label: "Concepts", path: "/concept-map" },
        { icon: BarChart3, label: "Analytics", path: "/analytics", active: true },
        { icon: User, label: "Roots", path: "/profile" },
    ];

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case "improving": return <TrendingUp className="w-4 h-4 text-emerald-500" />;
            case "worsening": return <TrendingDown className="w-4 h-4 text-amber-500" />;
            default: return <Minus className="w-4 h-4 text-[#8B8178]" />;
        }
    };

    const getTrendLabel = (trend: string) => {
        switch (trend) {
            case "improving": return "Improving";
            case "worsening": return "Declining";
            default: return "Stable";
        }
    };

    const getPaceStyle = (pace: string) => {
        switch (pace) {
            case "fast": return "text-emerald-600 bg-emerald-500/10";
            case "slow": return "text-amber-600 bg-amber-500/10";
            default: return "text-[#5C6B4A] bg-[#5C6B4A]/8";
        }
    };

    const getSeverityStyle = (severity: string) => {
        switch (severity) {
            case "significant": return { dot: "bg-red-500", badge: "text-red-600 bg-red-500/10" };
            case "moderate": return { dot: "bg-amber-500", badge: "text-amber-600 bg-amber-500/10" };
            default: return { dot: "bg-[#8B8178]", badge: "text-[#8B8178] bg-[#8B8178]/10" };
        }
    };

    const customTooltipStyle = {
        background: "rgba(253,248,243,0.95)",
        border: "1px solid rgba(232,222,212,0.6)",
        borderRadius: "16px",
        fontSize: "13px",
        padding: "10px 14px",
        backdropFilter: "blur(10px)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
    };

    return (
        <div className="min-h-screen bg-[#FDF8F3] relative overflow-hidden">
            <div className="grain-overlay" />

            <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="absolute -top-32 right-20 w-[600px] h-[600px] rounded-full bg-[#5C6B4A]/5 blur-[140px]" />
                <div className="absolute bottom-10 -left-20 w-[500px] h-[500px] rounded-full bg-[#D4A574]/8 blur-[120px]" />
            </div>

            <div className="flex min-h-screen relative z-10">
                {/* ═══ SIDEBAR ═══ */}
                <aside className="w-72 flex-col fixed h-screen hidden md:flex bg-white/40 backdrop-blur-xl border-r border-[#E8DED4]/60">
                    <div className="p-8 pb-0">
                        <Link to="/" className="block mb-1">
                            <span className="text-[#5C6B4A] font-extrabold text-xl tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}>Synapse</span>
                        </Link>
                        <div className="flex items-center gap-2 mb-10">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                            <span className="mono-tag text-[8px] text-[#8B8178]/50">Active Session</span>
                        </div>
                    </div>
                    <nav className="px-4 space-y-1 flex-1">
                        {navItems.map((item, i) => (
                            <Link key={item.path} to={item.path} className={`group flex items-center gap-3.5 px-5 py-3.5 rounded-2xl transition-all duration-500 relative ${item.active ? "bg-[#5C6B4A] text-white shadow-[0_10px_30px_rgba(92,107,74,0.25)]" : "text-[#8B8178] hover:bg-[#5C6B4A]/5 hover:text-[#3D3D3D]"}`}>
                                <span className={`mono-tag text-[8px] ${item.active ? "text-white/30" : "text-[#8B8178]/30"}`}>0{i + 1}</span>
                                <item.icon className="w-[18px] h-[18px]" />
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.active && <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white/60" />}
                            </Link>
                        ))}
                    </nav>
                    <div className="p-4 space-y-2 mt-auto">
                        {user ? (
                            <>
                                <div className="px-5 py-4 rounded-2xl bg-[#5C6B4A]/5 border border-[#5C6B4A]/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-[#5C6B4A] flex items-center justify-center text-white text-sm font-bold">{(user.name || user.email)?.[0]?.toUpperCase()}</div>
                                        <div className="min-w-0"><span className="text-sm text-[#3D3D3D] font-medium block truncate">{user.name || user.email}</span><span className="mono-tag text-[7px] text-[#8B8178]/50">Learner</span></div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                        <button onClick={() => { logout(); navigate("/"); }} className="flex items-center gap-3 px-5 py-3 rounded-2xl text-[#8B8178] hover:bg-red-50/80 hover:text-red-500 transition-all duration-500 w-full">
                            <LogOut className="w-[18px] h-[18px]" /><span className="text-sm font-medium">Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* ═══ MAIN ═══ */}
                <main className="flex-1 ml-0 md:ml-72 pb-24 md:pb-0">
                    <div className="max-w-5xl mx-auto px-6 md:px-10 lg:px-14 py-10 md:py-14 space-y-10">

                        {/* Header */}
                        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }}>
                            <span className="mono-tag text-[10px] text-[#8B8178] mb-3 block">// Learning Metrics</span>
                            <h1 className="text-[clamp(2.2rem,5vw,3.5rem)] font-black leading-[0.9] tracking-tight text-[#5C6B4A] uppercase" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}>
                                Analytics.
                            </h1>
                        </motion.header>

                        {isLoading ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-40 gap-4">
                                <div className="w-14 h-14 rounded-full bg-[#5C6B4A] flex items-center justify-center shadow-[0_10px_30px_rgba(92,107,74,0.2)]">
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                </div>
                                <span className="mono-tag text-[10px] text-[#8B8178]">Analyzing metrics...</span>
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
                                <button onClick={loadData} className="mt-2 px-6 py-2.5 rounded-full bg-[#5C6B4A] text-white text-sm font-semibold hover:bg-[#4A5A3A] transition-colors shadow-md">
                                    Retry
                                </button>
                            </motion.div>
                        ) : data ? (
                            data.summary.total_sessions === 0 ? (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 gap-5 text-center px-4 bg-white/40 backdrop-blur-md rounded-3xl border border-[#E8DED4] shadow-sm">
                                    <div className="w-16 h-16 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                        <Leaf className="w-6 h-6 text-[#5C6B4A]" />
                                    </div>
                                    <div>
                                        <h3 className="text-[#3D3D3D] font-bold text-lg">Not enough data yet.</h3>
                                        <p className="text-[#8B8178] text-sm mt-1 max-w-sm">Complete a few sessions to see your analytics bloom.</p>
                                    </div>
                                    <button onClick={() => navigate("/mentor")} className="mt-3 px-6 py-2.5 rounded-full bg-[#5C6B4A] text-white text-sm font-semibold hover:bg-[#4A5A3A] transition-colors shadow-md flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" /> Start Session
                                    </button>
                                </motion.div>
                            ) : (
                                <>
                                    {/* ──── Summary Cards ──── */}
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease }}
                                    className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                                    {/* Clarity */}
                                    <div className="group relative rounded-[1.5rem] p-6 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_25px_50px_-12px_rgba(0,0,0,0.07)] transition-all transition-duration-[600ms]">
                                        <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-[#5C6B4A]/20 group-hover:bg-[#5C6B4A]/40 transition-colors" />
                                        <div className="flex items-center gap-2 mb-4">
                                            <Brain className="w-4 h-4 text-[#5C6B4A]" />
                                            <span className="mono-tag text-[8px] text-[#8B8178]">Clarity</span>
                                        </div>
                                        <p className="text-4xl font-black text-[#3D3D3D] tracking-tight" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.03em" }}>
                                            {data.summary.current_clarity}<span className="text-lg text-[#8B8178]/40">%</span>
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-2">
                                            {getTrendIcon(data.summary.current_trend)}
                                            <span className="text-[11px] text-[#8B8178]">{getTrendLabel(data.summary.current_trend)}</span>
                                        </div>
                                    </div>

                                    {/* Pace */}
                                    <div className="group relative rounded-[1.5rem] p-6 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_25px_50px_-12px_rgba(0,0,0,0.07)] transition-all transition-duration-[600ms]">
                                        <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-[#D4A574]/20 group-hover:bg-[#D4A574]/40 transition-colors" />
                                        <div className="flex items-center gap-2 mb-4">
                                            <Zap className="w-4 h-4 text-[#D4A574]" />
                                            <span className="mono-tag text-[8px] text-[#8B8178]">Pace</span>
                                        </div>
                                        <span className={`inline-block px-3.5 py-1.5 rounded-full text-sm font-semibold capitalize ${getPaceStyle(data.summary.learning_pace)}`}>
                                            {data.summary.learning_pace}
                                        </span>
                                        <p className="text-[11px] text-[#8B8178] mt-2.5 capitalize">{data.summary.stage} stage</p>
                                    </div>

                                    {/* Sessions */}
                                    <div className="group relative rounded-[1.5rem] p-6 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_25px_50px_-12px_rgba(0,0,0,0.07)] transition-all transition-duration-[600ms]">
                                        <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-[#5C6B4A]/20 group-hover:bg-[#5C6B4A]/40 transition-colors" />
                                        <div className="flex items-center gap-2 mb-4">
                                            <Activity className="w-4 h-4 text-[#5C6B4A]" />
                                            <span className="mono-tag text-[8px] text-[#8B8178]">Sessions</span>
                                        </div>
                                        <p className="text-4xl font-black text-[#3D3D3D] tracking-tight" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.03em" }}>
                                            {data.summary.total_sessions}
                                        </p>
                                        <p className="text-[11px] text-[#8B8178] mt-2">{data.summary.total_evaluations} evaluations</p>
                                    </div>

                                    {/* Struggles */}
                                    <div className="group relative rounded-[1.5rem] p-6 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)] hover:-translate-y-1 hover:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_25px_50px_-12px_rgba(0,0,0,0.07)] transition-all transition-duration-[600ms]">
                                        <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-amber-400/20 group-hover:bg-amber-400/40 transition-colors" />
                                        <div className="flex items-center gap-2 mb-4">
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            <span className="mono-tag text-[8px] text-[#8B8178]">Struggles</span>
                                        </div>
                                        <p className="text-4xl font-black text-[#3D3D3D] tracking-tight" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.03em" }}>
                                            {data.struggles.length}
                                        </p>
                                        <p className="text-[11px] text-[#8B8178] mt-2">areas of difficulty</p>
                                    </div>
                                </motion.div>

                                {/* ──── Clarity Trend Chart ──── */}
                                {data.clarity_trend.length > 0 && (
                                    <motion.section initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease }}
                                        className="relative rounded-[2rem] p-7 md:p-8 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]">
                                        <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-[#5C6B4A]/20" />

                                        <div className="flex items-center gap-2.5 mb-6">
                                            <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                                <TrendingUp className="w-4 h-4 text-[#5C6B4A]" />
                                            </div>
                                            <span className="mono-tag text-[9px] text-[#8B8178]">Clarity Over Time</span>
                                        </div>

                                        <ResponsiveContainer width="100%" height={280}>
                                            <AreaChart data={data.clarity_trend}>
                                                <defs>
                                                    <linearGradient id="clarityGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#5C6B4A" stopOpacity={0.2} />
                                                        <stop offset="95%" stopColor="#5C6B4A" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,222,212,0.5)" vertical={false} />
                                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8B8178" }} axisLine={{ stroke: "rgba(232,222,212,0.5)" }} tickLine={false} />
                                                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#8B8178" }} axisLine={false} tickLine={false} />
                                                <Tooltip contentStyle={customTooltipStyle} />
                                                <Area type="monotone" dataKey="score" stroke="#5C6B4A" strokeWidth={2.5} fill="url(#clarityGradient)"
                                                    dot={{ fill: "#5C6B4A", r: 3, strokeWidth: 0 }}
                                                    activeDot={{ r: 6, fill: "#D4A574", stroke: "#FDF8F3", strokeWidth: 2 }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </motion.section>
                                )}

                                {/* ──── Session Activity Chart ──── */}
                                <motion.section initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3, ease }}
                                    className="relative rounded-[2rem] p-7 md:p-8 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]">
                                    <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-[#D4A574]/20" />

                                    <div className="flex items-center gap-2.5 mb-6">
                                        <div className="w-8 h-8 rounded-full bg-[#D4A574]/10 flex items-center justify-center">
                                            <Activity className="w-4 h-4 text-[#D4A574]" />
                                        </div>
                                        <span className="mono-tag text-[9px] text-[#8B8178]">Session Activity</span>
                                        <span className="mono-tag text-[8px] text-[#8B8178]/25 ml-auto">30 Days</span>
                                    </div>

                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={data.session_activity}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(232,222,212,0.5)" vertical={false} />
                                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#8B8178" }} tickFormatter={(val: string) => val.slice(5)} axisLine={{ stroke: "rgba(232,222,212,0.5)" }} tickLine={false} />
                                            <YAxis tick={{ fontSize: 10, fill: "#8B8178" }} allowDecimals={false} axisLine={false} tickLine={false} />
                                            <Tooltip contentStyle={customTooltipStyle} />
                                            <Bar dataKey="sessions" fill="#D4A574" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </motion.section>

                                {/* ──── Struggles ──── */}
                                {data.struggles.length > 0 && (
                                    <motion.section initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4, ease }}
                                        className="relative rounded-[2rem] p-7 md:p-8 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]">
                                        <div className="flex items-center gap-2.5 mb-6">
                                            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            </div>
                                            <span className="mono-tag text-[9px] text-[#8B8178]">Areas of Difficulty</span>
                                            <span className="mono-tag text-[8px] text-[#8B8178]/25 ml-auto">{data.struggles.length} topics</span>
                                        </div>

                                        <div className="space-y-2.5">
                                            {data.struggles.map((s, idx) => {
                                                const sev = getSeverityStyle(s.severity);
                                                return (
                                                    <motion.div key={idx} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                                                        transition={{ duration: 0.5, delay: 0.45 + idx * 0.06, ease }}
                                                        className="group flex items-center justify-between p-4 rounded-xl bg-white/40 border border-[#E8DED4]/50 hover:bg-white/60 hover:-translate-y-0.5 transition-all duration-500">
                                                        <div className="flex items-center gap-3.5">
                                                            <div className={`w-2 h-2 rounded-full ${sev.dot}`} />
                                                            <span className="text-[#3D3D3D] font-medium text-sm">{s.topic}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="mono-tag text-[8px] text-[#8B8178]/40">{s.count}× encountered</span>
                                                            <span className={`mono-tag text-[8px] px-2.5 py-1 rounded-full ${sev.badge} capitalize`}>{s.severity}</span>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </motion.section>
                                )}
                            </>
                            )
                        ) : null}

                        <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.6, ease }} className="py-6 flex items-center gap-3">
                            <div className="w-8 h-px bg-[#E8DED4]" />
                            <span className="mono-tag text-[9px] text-[#8B8178]/30">Learning is not linear — these metrics guide, not define</span>
                        </motion.footer>
                    </div>
                </main>
            </div>

            {/* ═══ MOBILE BOTTOM NAV ═══ */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-2xl border-t border-[#E8DED4]/50 px-2 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <div className="flex justify-around">
                    {navItems.map((item) => (
                        <Link key={item.path} to={item.path} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 ${item.active ? "text-[#5C6B4A]" : "text-[#8B8178]/50"}`}>
                            <item.icon className="w-5 h-5" />
                            <span className="text-[9px] font-medium">{item.label}</span>
                            {item.active && <div className="w-1 h-1 rounded-full bg-[#5C6B4A]" />}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
