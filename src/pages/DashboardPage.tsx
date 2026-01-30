import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Leaf, Sprout, Sun, Droplets, Wind, Home, MessageSquare, Map, User, ChevronRight, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchDashboardData, DashboardData } from "@/services/api";
import Logo from "@/components/Logo";

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const data = await fetchDashboardData();
                setDashboard(data);
            } catch (e) {
                console.error("Failed to load dashboard", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadDashboard();
    }, []);

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard", active: true },
        { icon: MessageSquare, label: "Session", path: "/mentor" },
        { icon: Map, label: "Pathways", path: "/roadmap" },
        { icon: User, label: "Roots", path: "/profile" },
    ];

    // Map momentum state to display labels
    const getMomentumLabel = (state: string) => {
        switch (state) {
            case "accelerating": return "Accelerating";
            case "steady": return "Steady Growth";
            case "building": return "Building Understanding";
            case "struggling": return "Needs Attention";  // NEW: Honest state
            default: return "Just Beginning";
        }
    };

    // Map understanding trend to display
    const getTrendDisplay = (trend: string) => {
        switch (trend) {
            case "improving": return "Improving";
            case "worsening": return "Declining";
            default: return "Stable";
        }
    };

    // Format timestamp for display
    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    // Get signal type color
    const getSignalColor = (type: string) => {
        switch (type) {
            case "progress": return "bg-[#5C6B4A]";
            case "struggle": return "bg-[#D4A574]";
            default: return "bg-[#8B8178]";
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4]">
            {/* Subtle background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 right-20 w-[400px] h-[400px] rounded-full bg-[#D4A574]/10 blur-3xl" />
                <div className="absolute bottom-20 left-20 w-[300px] h-[300px] rounded-full bg-[#5C6B4A]/5 blur-3xl" />
            </div>

            <div className="flex min-h-screen relative z-10">
                {/* Sidebar */}
                <aside className="w-64 p-6 flex flex-col fixed h-screen">
                    <div className="flex items-center gap-3 mb-12">
                        <Logo size="md" />
                    </div>

                    <nav className="space-y-2 flex-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-500 ${item.active
                                    ? "bg-[#5C6B4A] text-[#FDF8F3]"
                                    : "text-[#8B8178] hover:bg-[#E8DED4]/50 hover:text-[#3D3D3D]"
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="text-sm font-medium">{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    <button
                        onClick={() => { logout(); navigate("/"); }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[#8B8178] hover:bg-red-50 hover:text-red-500 transition-all duration-500"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="text-sm font-medium">Sign Out</span>
                    </button>
                </aside>

                {/* Main Content */}
                <main className="flex-1 ml-64 p-8 lg:p-12">
                    <div className="max-w-4xl mx-auto space-y-8">
                        {/* Header */}
                        <motion.header
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <p className="text-sm text-[#8B8178] mb-2">Welcome back to your</p>
                            <h1 className="font-serif text-4xl lg:text-5xl text-[#3D3D3D]">Garden</h1>
                        </motion.header>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-[#5C6B4A] animate-spin" />
                            </div>
                        ) : dashboard ? (
                            <>
                                {/* Understanding Section */}
                                <motion.section
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.1 }}
                                    className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                                >
                                    <div className="flex items-start gap-8">
                                        {/* Growth Velocity Visual */}
                                        <div className="flex-shrink-0">
                                            <div className="w-32 h-48 relative">
                                                <svg viewBox="0 0 100 150" className="w-full h-full">
                                                    <defs>
                                                        <linearGradient id="waveGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                                                            <stop offset="0%" stopColor="#5C6B4A" stopOpacity="0.3" />
                                                            <stop offset="100%" stopColor="#5C6B4A" stopOpacity="0.1" />
                                                        </linearGradient>
                                                    </defs>
                                                    <motion.path
                                                        initial={{ pathLength: 0 }}
                                                        animate={{ pathLength: 1 }}
                                                        transition={{ duration: 2, ease: "easeOut" }}
                                                        d={dashboard.momentum.state === "starting" || dashboard.momentum.state === "struggling"
                                                            ? "M 10 140 Q 30 130 50 135 T 90 120"
                                                            : dashboard.momentum.state === "building"
                                                                ? "M 10 140 Q 30 110 50 115 T 90 90"
                                                                : dashboard.momentum.state === "steady"
                                                                    ? "M 10 140 Q 30 100 50 105 T 90 70"
                                                                    : "M 10 140 Q 30 90 50 80 T 90 40"
                                                        }
                                                        stroke={dashboard.momentum.state === "struggling" ? "#D4A574" : "#5C6B4A"}
                                                        strokeWidth="3"
                                                        fill="none"
                                                        strokeLinecap="round"
                                                    />
                                                    <motion.circle
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ duration: 0.5, delay: 1.5 }}
                                                        cx="90"
                                                        cy={dashboard.momentum.state === "starting" || dashboard.momentum.state === "struggling" ? "120"
                                                            : dashboard.momentum.state === "building" ? "90"
                                                                : dashboard.momentum.state === "steady" ? "70" : "40"}
                                                        r="6"
                                                        fill="#D4A574"
                                                    />
                                                </svg>
                                            </div>
                                        </div>

                                        {/* Understanding Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="text-xs uppercase tracking-wider text-[#8B8178]">Understanding</span>
                                            </div>
                                            <h2 className="font-serif text-3xl text-[#3D3D3D] mb-2">
                                                {getMomentumLabel(dashboard.momentum.state)}
                                            </h2>
                                            <p className="text-[#8B8178] leading-relaxed mb-6">
                                                {dashboard.momentum.insight}
                                            </p>

                                            <div className="flex gap-6">
                                                <div className="flex items-center gap-2">
                                                    <Sun className="w-4 h-4 text-[#D4A574]" />
                                                    <span className="text-sm text-[#8B8178]">
                                                        Clarity: {dashboard.momentum.metrics.clarity_score}%
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Wind className="w-4 h-4 text-[#5C6B4A]" />
                                                    <span className="text-sm text-[#8B8178]">
                                                        Trend: {getTrendDisplay(dashboard.momentum.metrics.understanding_trend)}
                                                    </span>
                                                </div>
                                                {dashboard.momentum.metrics.understanding_delta !== 0 && (
                                                    <div className="flex items-center gap-2">
                                                        <Droplets className="w-4 h-4 text-[#8B8178]" />
                                                        <span className="text-sm text-[#8B8178]">
                                                            Change: {dashboard.momentum.metrics.understanding_delta > 0 ? "+" : ""}{dashboard.momentum.metrics.understanding_delta}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.section>

                                {/* Effort Section - Separate from Understanding */}
                                <motion.section
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.15 }}
                                    className="bg-white/40 backdrop-blur-sm rounded-3xl p-6 border border-[#E8DED4]"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs uppercase tracking-wider text-[#8B8178]">Effort</span>
                                            <span className="text-xs text-[#8B8178]/60">({dashboard.effort.persistence_label})</span>
                                        </div>
                                        <div className="flex gap-6">
                                            <span className="text-sm text-[#8B8178]">
                                                {dashboard.effort.sessions_this_week} sessions this week
                                            </span>
                                            <span className="text-sm text-[#8B8178]">
                                                {dashboard.effort.consistency_streak} day streak
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-[#8B8178]/50 mt-2">
                                        {dashboard.effort.note}
                                    </p>
                                </motion.section>

                                {/* Two Column Layout */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Next Bloom */}
                                    {dashboard.next_bloom && (
                                        <motion.section
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.6, delay: 0.2 }}
                                            className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                                        >
                                            <div className="flex items-center gap-2 mb-6">
                                                <Leaf className="w-5 h-5 text-[#5C6B4A]" />
                                                <h3 className="font-serif text-xl text-[#3D3D3D]">Next Focus</h3>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="p-4 bg-[#5C6B4A]/5 rounded-2xl">
                                                    <p className="font-serif text-lg text-[#3D3D3D] mb-1">
                                                        {dashboard.next_bloom.title}
                                                    </p>
                                                    <p className="text-sm text-[#8B8178]">
                                                        {dashboard.next_bloom.description}
                                                    </p>
                                                    {dashboard.next_bloom.action_hint && (
                                                        <p className="text-xs text-[#5C6B4A] mt-2 font-medium">
                                                            {dashboard.next_bloom.action_hint}
                                                        </p>
                                                    )}
                                                </div>

                                                <p className="text-xs text-[#8B8178]/60">
                                                    Source: {dashboard.next_bloom.source === "roadmap" ? "Your pathway" : "Your goals"}
                                                </p>

                                                <Link
                                                    to="/roadmap"
                                                    className="inline-flex items-center gap-2 text-[#5C6B4A] text-sm font-medium hover:gap-3 transition-all duration-500"
                                                >
                                                    View pathways <ChevronRight className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </motion.section>
                                    )}

                                    {/* Daily Nurture - Only shown when meaningful */}
                                    {dashboard.show_daily_nurture && dashboard.daily_nurture_prompt && (
                                        <motion.section
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.6, delay: 0.3 }}
                                            className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                                        >
                                            <div className="flex items-center gap-2 mb-6">
                                                <Droplets className="w-5 h-5 text-[#5C6B4A]" />
                                                <h3 className="font-serif text-xl text-[#3D3D3D]">Reflect</h3>
                                            </div>

                                            <p className="font-serif text-lg text-[#3D3D3D] mb-6 leading-relaxed">
                                                {dashboard.daily_nurture_prompt}
                                            </p>

                                            <textarea
                                                placeholder="Your thoughts..."
                                                className="w-full bg-[#FDF8F3]/50 border border-[#E8DED4] rounded-2xl p-4 text-[#3D3D3D] placeholder:text-[#8B8178]/50 resize-none h-24 focus:ring-2 focus:ring-[#5C6B4A]/20 focus:border-[#5C6B4A]/30 transition-all duration-500"
                                            />

                                            <button className="mt-4 px-6 py-3 bg-[#5C6B4A] text-[#FDF8F3] rounded-full text-sm font-medium hover:bg-[#4A5A3A] transition-all duration-500">
                                                Save reflection
                                            </button>
                                        </motion.section>
                                    )}

                                    {/* Start Session Card - Show if no daily nurture or no next bloom */}
                                    {(!dashboard.next_bloom || !dashboard.show_daily_nurture) && (
                                        <motion.section
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.6, delay: 0.3 }}
                                            className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                                        >
                                            <div className="flex items-center gap-2 mb-6">
                                                <MessageSquare className="w-5 h-5 text-[#5C6B4A]" />
                                                <h3 className="font-serif text-xl text-[#3D3D3D]">Continue</h3>
                                            </div>

                                            <p className="text-[#8B8178] mb-6">
                                                Pick up where you left off or explore something new.
                                            </p>

                                            <Link
                                                to="/mentor"
                                                className="inline-flex items-center gap-2 px-6 py-3 bg-[#5C6B4A] text-[#FDF8F3] rounded-full text-sm font-medium hover:bg-[#4A5A3A] transition-all duration-500"
                                            >
                                                Start a session <ChevronRight className="w-4 h-4" />
                                            </Link>
                                        </motion.section>
                                    )}
                                </div>

                                {/* Recent Signals */}
                                {dashboard.recent_signals.length > 0 && (
                                    <motion.section
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.6, delay: 0.4 }}
                                        className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                                    >
                                        <div className="flex items-center gap-2 mb-6">
                                            <Sprout className="w-5 h-5 text-[#5C6B4A]" />
                                            <h3 className="font-serif text-xl text-[#3D3D3D]">Recent Signals</h3>
                                        </div>

                                        <div className="space-y-6">
                                            {dashboard.recent_signals.map((signal, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ duration: 0.5, delay: 0.5 + idx * 0.1 }}
                                                    className="flex items-start gap-4 pb-6 border-b border-[#E8DED4] last:border-0 last:pb-0"
                                                >
                                                    <div className={`w-2 h-2 rounded-full mt-2 ${getSignalColor(signal.type)}`} />
                                                    <div className="flex-1">
                                                        <p className="text-[#3D3D3D] leading-relaxed">{signal.observation}</p>
                                                        <span className="text-xs text-[#8B8178]/60 mt-1 block">
                                                            {formatTimestamp(signal.timestamp)}
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.section>
                                )}
                            </>
                        ) : (
                            /* No data state */
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4] text-center"
                            >
                                <Sprout className="w-12 h-12 text-[#5C6B4A] mx-auto mb-4" />
                                <h2 className="font-serif text-xl text-[#3D3D3D] mb-2">Your garden is ready</h2>
                                <p className="text-[#8B8178] mb-6">Start a session to begin tracking your progress.</p>
                                <Link
                                    to="/mentor"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium hover:bg-[#4A5A3A] transition-all duration-500"
                                >
                                    Start your first session <ChevronRight className="w-4 h-4" />
                                </Link>
                            </motion.section>
                        )}

                        {/* Gentle Footer */}
                        <motion.footer
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.6 }}
                            className="text-center py-8"
                        >
                            <p className="text-sm text-[#8B8178]/50">
                                Your progress is tracked, not scripted.
                            </p>
                        </motion.footer>
                    </div>
                </main>
            </div>
        </div>
    );
}
