import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
    Home, MessageSquare, Map, User, BarChart3, ChevronRight,
    Loader2, LogOut, TrendingUp, TrendingDown, Minus, Activity,
    AlertTriangle, Zap, Brain
} from "lucide-react";
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAnalyticsData, AnalyticsData } from "@/services/api";
import Logo from "@/components/Logo";

export default function AnalyticsPage() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const analytics = await fetchAnalyticsData();
                setData(analytics);
            } catch (e) {
                console.error("Failed to load analytics", e);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard" },
        { icon: MessageSquare, label: "Session", path: "/mentor" },
        { icon: Map, label: "Pathways", path: "/roadmap" },
        { icon: BarChart3, label: "Analytics", path: "/analytics", active: true },
        { icon: User, label: "Roots", path: "/profile" },
    ];

    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case "improving": return <TrendingUp className="w-4 h-4 text-emerald-600" />;
            case "worsening": return <TrendingDown className="w-4 h-4 text-amber-600" />;
            default: return <Minus className="w-4 h-4 text-[#8B8178]" />;
        }
    };

    const getPaceColor = (pace: string) => {
        switch (pace) {
            case "fast": return "text-emerald-600 bg-emerald-50";
            case "slow": return "text-amber-600 bg-amber-50";
            default: return "text-[#5C6B4A] bg-[#5C6B4A]/10";
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "significant": return "bg-red-100 text-red-700";
            case "moderate": return "bg-amber-100 text-amber-700";
            default: return "bg-[#E8DED4] text-[#8B8178]";
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4]">
            {/* Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 right-20 w-[400px] h-[400px] rounded-full bg-[#D4A574]/10 blur-3xl" />
                <div className="absolute bottom-20 left-20 w-[300px] h-[300px] rounded-full bg-[#5C6B4A]/5 blur-3xl" />
            </div>

            <div className="flex min-h-screen relative z-10">
                {/* Sidebar */}
                <aside className="w-64 p-6 flex flex-col fixed h-screen hidden md:flex">
                    <div className="flex items-center gap-3 mb-12">
                        <Logo size="md" />
                    </div>

                    <nav className="space-y-2 flex-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-500 ${
                                    item.active
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
                <main className="flex-1 ml-0 md:ml-64 p-6 md:p-8 lg:p-12">
                    <div className="max-w-5xl mx-auto space-y-8">
                        {/* Header */}
                        <motion.header
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <p className="text-sm text-[#8B8178] mb-2">Your learning</p>
                            <h1 className="font-serif text-4xl lg:text-5xl text-[#3D3D3D]">Analytics</h1>
                        </motion.header>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-[#5C6B4A] animate-spin" />
                            </div>
                        ) : data ? (
                            <>
                                {/* Summary Cards */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.1 }}
                                    className="grid grid-cols-2 lg:grid-cols-4 gap-4"
                                >
                                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-[#E8DED4]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Brain className="w-4 h-4 text-[#5C6B4A]" />
                                            <span className="text-xs uppercase tracking-wider text-[#8B8178]">Clarity</span>
                                        </div>
                                        <p className="font-serif text-3xl text-[#3D3D3D]">{data.summary.current_clarity}%</p>
                                        <div className="flex items-center gap-1 mt-1">
                                            {getTrendIcon(data.summary.current_trend)}
                                            <span className="text-xs text-[#8B8178] capitalize">{data.summary.current_trend}</span>
                                        </div>
                                    </div>

                                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-[#E8DED4]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Zap className="w-4 h-4 text-[#D4A574]" />
                                            <span className="text-xs uppercase tracking-wider text-[#8B8178]">Pace</span>
                                        </div>
                                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium capitalize ${getPaceColor(data.summary.learning_pace)}`}>
                                            {data.summary.learning_pace}
                                        </span>
                                        <p className="text-xs text-[#8B8178] mt-2 capitalize">{data.summary.stage} stage</p>
                                    </div>

                                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-[#E8DED4]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Activity className="w-4 h-4 text-[#5C6B4A]" />
                                            <span className="text-xs uppercase tracking-wider text-[#8B8178]">Sessions</span>
                                        </div>
                                        <p className="font-serif text-3xl text-[#3D3D3D]">{data.summary.total_sessions}</p>
                                        <p className="text-xs text-[#8B8178] mt-1">{data.summary.total_evaluations} evaluations</p>
                                    </div>

                                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-[#E8DED4]">
                                        <div className="flex items-center gap-2 mb-3">
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            <span className="text-xs uppercase tracking-wider text-[#8B8178]">Struggles</span>
                                        </div>
                                        <p className="font-serif text-3xl text-[#3D3D3D]">{data.struggles.length}</p>
                                        <p className="text-xs text-[#8B8178] mt-1">areas of difficulty</p>
                                    </div>
                                </motion.div>

                                {/* Clarity Trend Chart */}
                                {data.clarity_trend.length > 0 && (
                                    <motion.section
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.6, delay: 0.2 }}
                                        className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                                    >
                                        <h2 className="font-serif text-xl text-[#3D3D3D] mb-6">Clarity Over Time</h2>
                                        <ResponsiveContainer width="100%" height={280}>
                                            <AreaChart data={data.clarity_trend}>
                                                <defs>
                                                    <linearGradient id="clarityGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#5C6B4A" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#5C6B4A" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#E8DED4" />
                                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8B8178" }} />
                                                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#8B8178" }} />
                                                <Tooltip
                                                    contentStyle={{
                                                        background: "#FDF8F3",
                                                        border: "1px solid #E8DED4",
                                                        borderRadius: "12px",
                                                        fontSize: "13px",
                                                    }}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="score"
                                                    stroke="#5C6B4A"
                                                    strokeWidth={2}
                                                    fill="url(#clarityGradient)"
                                                    dot={{ fill: "#5C6B4A", r: 4 }}
                                                    activeDot={{ r: 6, fill: "#D4A574" }}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </motion.section>
                                )}

                                {/* Session Activity Chart */}
                                <motion.section
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.3 }}
                                    className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                                >
                                    <h2 className="font-serif text-xl text-[#3D3D3D] mb-6">Session Activity (30 Days)</h2>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={data.session_activity}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#E8DED4" />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fontSize: 10, fill: "#8B8178" }}
                                                tickFormatter={(val: string) => val.slice(5)}
                                            />
                                            <YAxis tick={{ fontSize: 11, fill: "#8B8178" }} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={{
                                                    background: "#FDF8F3",
                                                    border: "1px solid #E8DED4",
                                                    borderRadius: "12px",
                                                    fontSize: "13px",
                                                }}
                                            />
                                            <Bar dataKey="sessions" fill="#D4A574" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </motion.section>

                                {/* Struggles Table */}
                                {data.struggles.length > 0 && (
                                    <motion.section
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.6, delay: 0.4 }}
                                        className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                                    >
                                        <h2 className="font-serif text-xl text-[#3D3D3D] mb-6">Areas of Difficulty</h2>
                                        <div className="space-y-3">
                                            {data.struggles.map((s, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-4 rounded-2xl bg-[#FDF8F3]/50 border border-[#E8DED4]"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-[#D4A574]" />
                                                        <span className="text-[#3D3D3D] font-medium">{s.topic}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-[#8B8178]">{s.count}x encountered</span>
                                                        <span className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(s.severity)}`}>
                                                            {s.severity}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.section>
                                )}
                            </>
                        ) : (
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4] text-center"
                            >
                                <BarChart3 className="w-12 h-12 text-[#5C6B4A] mx-auto mb-4" />
                                <h2 className="font-serif text-xl text-[#3D3D3D] mb-2">No data yet</h2>
                                <p className="text-[#8B8178] mb-6">Start a mentoring session to begin building your analytics.</p>
                                <Link
                                    to="/mentor"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium hover:bg-[#4A5A3A] transition-all duration-500"
                                >
                                    Start a session <ChevronRight className="w-4 h-4" />
                                </Link>
                            </motion.section>
                        )}

                        <motion.footer
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.5 }}
                            className="text-center py-8"
                        >
                            <p className="text-sm text-[#8B8178]/50">
                                Learning is not linear. These metrics guide, not define.
                            </p>
                        </motion.footer>
                    </div>
                </main>
            </div>
        </div>
    );
}
