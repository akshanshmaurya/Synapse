import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Leaf, Sprout, Sun, Droplets, Wind, Home, MessageSquare, Map, User, Settings, ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserMemory } from "@/services/api";

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const [userMemory, setUserMemory] = useState<any>(null);

    useEffect(() => {
        const loadState = async () => {
            try {
                const memory = await fetchUserMemory();
                setUserMemory(memory);
            } catch (e) {
                console.error("Failed to load user memory", e);
            }
        };
        loadState();
    }, []);

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard", active: true },
        { icon: MessageSquare, label: "Session", path: "/mentor" },
        { icon: Map, label: "Pathways", path: "/roadmap" },
        { icon: User, label: "Roots", path: "/profile" },
    ];

    const nurturingLog = [
        { time: "This morning", insight: "Recognized a growing confidence in stakeholder communication.", type: "bloom" },
        { time: "Yesterday", insight: "Reflected on the value of patience in complex projects.", type: "water" },
        { time: "3 days ago", insight: "Identified a new branch: exploring system design patterns.", type: "branch" },
    ];

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
                        <div className="w-10 h-10 rounded-full bg-[#5C6B4A] flex items-center justify-center">
                            <Sprout className="w-5 h-5 text-[#FDF8F3]" />
                        </div>
                        <div>
                            <span className="font-serif text-lg text-[#3D3D3D]">Synapse</span>
                            <p className="text-[10px] text-[#8B8178] uppercase tracking-wider">Organic Mode</p>
                        </div>
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

                    <button className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[#8B8178] hover:bg-[#E8DED4]/50 transition-all duration-500">
                        <Settings className="w-5 h-5" />
                        <span className="text-sm font-medium">Settings</span>
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

                        {/* Momentum Section */}
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
                                        {/* Gentle wave background */}
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
                                                d="M 10 140 Q 30 100 50 110 T 90 70"
                                                stroke="#5C6B4A"
                                                strokeWidth="3"
                                                fill="none"
                                                strokeLinecap="round"
                                            />
                                            <motion.circle
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ duration: 0.5, delay: 1.5 }}
                                                cx="90"
                                                cy="70"
                                                r="6"
                                                fill="#D4A574"
                                            />
                                        </svg>
                                    </div>
                                </div>

                                {/* Momentum Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-xs uppercase tracking-wider text-[#8B8178]">Current Momentum</span>
                                    </div>
                                    <h2 className="font-serif text-3xl text-[#3D3D3D] mb-2">Flourishing</h2>
                                    <p className="text-[#8B8178] leading-relaxed mb-6">
                                        Your growth has been steady this season. The seeds of leadership
                                        you planted are beginning to bloom.
                                    </p>

                                    <div className="flex gap-6">
                                        <div className="flex items-center gap-2">
                                            <Sun className="w-4 h-4 text-[#D4A574]" />
                                            <span className="text-sm text-[#8B8178]">Clarity: High</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Droplets className="w-4 h-4 text-[#5C6B4A]" />
                                            <span className="text-sm text-[#8B8178]">Nurturing: Active</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Wind className="w-4 h-4 text-[#8B8178]" />
                                            <span className="text-sm text-[#8B8178]">Change: Gentle</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.section>

                        {/* Two Column Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Next Bloom */}
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                            >
                                <div className="flex items-center gap-2 mb-6">
                                    <Leaf className="w-5 h-5 text-[#5C6B4A]" />
                                    <h3 className="font-serif text-xl text-[#3D3D3D]">Next Bloom</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-4 bg-[#5C6B4A]/5 rounded-2xl">
                                        <p className="font-serif text-lg text-[#3D3D3D] mb-1">Senior Leadership Role</p>
                                        <p className="text-sm text-[#8B8178]">The path is unfolding naturally. No rush.</p>
                                    </div>

                                    <p className="text-sm text-[#8B8178] leading-relaxed">
                                        Continue nurturing your current projects.
                                        The visibility will come when the timing is right.
                                    </p>

                                    <Link
                                        to="/roadmap"
                                        className="inline-flex items-center gap-2 text-[#5C6B4A] text-sm font-medium hover:gap-3 transition-all duration-500"
                                    >
                                        Explore pathways <ChevronRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </motion.section>

                            {/* Daily Nurture */}
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.3 }}
                                className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                            >
                                <div className="flex items-center gap-2 mb-6">
                                    <Droplets className="w-5 h-5 text-[#5C6B4A]" />
                                    <h3 className="font-serif text-xl text-[#3D3D3D]">Daily Nurture</h3>
                                </div>

                                <p className="font-serif text-lg text-[#3D3D3D] mb-6 leading-relaxed">
                                    What small act of growth did you notice today?
                                </p>

                                <textarea
                                    placeholder="A moment of clarity, a new connection, a quiet win..."
                                    className="w-full bg-[#FDF8F3]/50 border border-[#E8DED4] rounded-2xl p-4 text-[#3D3D3D] placeholder:text-[#8B8178]/50 resize-none h-24 focus:ring-2 focus:ring-[#5C6B4A]/20 focus:border-[#5C6B4A]/30 transition-all duration-500"
                                />

                                <button className="mt-4 px-6 py-3 bg-[#5C6B4A] text-[#FDF8F3] rounded-full text-sm font-medium hover:bg-[#4A5A3A] transition-all duration-500">
                                    Plant this thought
                                </button>
                            </motion.section>
                        </div>

                        {/* Nurturing Log */}
                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                        >
                            <div className="flex items-center gap-2 mb-6">
                                <Sprout className="w-5 h-5 text-[#5C6B4A]" />
                                <h3 className="font-serif text-xl text-[#3D3D3D]">Recent Nurturing</h3>
                            </div>

                            <div className="space-y-6">
                                {nurturingLog.map((entry, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.5, delay: 0.5 + idx * 0.1 }}
                                        className="flex items-start gap-4 pb-6 border-b border-[#E8DED4] last:border-0 last:pb-0"
                                    >
                                        <div className={`w-2 h-2 rounded-full mt-2 ${entry.type === "bloom" ? "bg-[#D4A574]" :
                                            entry.type === "water" ? "bg-[#5C6B4A]" :
                                                "bg-[#8B8178]"
                                            }`} />
                                        <div className="flex-1">
                                            <p className="text-[#3D3D3D] leading-relaxed">{entry.insight}</p>
                                            <span className="text-xs text-[#8B8178]/60 mt-1 block">{entry.time}</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.section>

                        {/* Gentle Footer */}
                        <motion.footer
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.6 }}
                            className="text-center py-8"
                        >
                            <p className="text-sm text-[#8B8178]/50">
                                Growth takes time. You're exactly where you need to be.
                            </p>
                        </motion.footer>
                    </div>
                </main>
            </div>
        </div>
    );
}
