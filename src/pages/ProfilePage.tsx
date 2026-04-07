import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Leaf, Sprout, Home, MessageSquare, Map, User, BarChart3, Shield, Edit3, X, Plus, Check, LogOut, ArrowRight, Network } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserMemory, updateUserProfile } from "@/services/api";

/* ──────────────────────────────────────────────
   Animation Presets (Landing Page system)
   ────────────────────────────────────────────── */
const ease = [0.23, 1, 0.32, 1] as const;

interface UserMemoryProfile {
    interests?: string[];
    goals?: string[];
    stage?: string;
    learning_pace?: string;
}

interface UserMemory {
    profile?: UserMemoryProfile;
    onboarding?: { mentoring_style?: string };
}

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [userMemory, setUserMemory] = useState<UserMemory | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [interests, setInterests] = useState<string[]>([]);
    const [goals, setGoals] = useState<string[]>([]);
    const [newInterest, setNewInterest] = useState("");
    const [newGoal, setNewGoal] = useState("");

    useEffect(() => { loadProfile(); }, []);

    const loadProfile = async () => {
        try {
            const memory = await fetchUserMemory() as UserMemory | null;
            setUserMemory(memory);
            setInterests(memory?.profile?.interests || []);
            setGoals(memory?.profile?.goals || []);
        } catch (e) {
            console.error("Failed to load profile", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const success = await updateUserProfile(interests, goals);
            if (success) {
                setIsEditing(false);
                await loadProfile();
            }
        } catch (e) {
            console.error("Failed to save profile", e);
        } finally {
            setIsSaving(false);
        }
    };

    const addInterest = () => {
        if (newInterest.trim() && !interests.includes(newInterest.trim())) {
            setInterests([...interests, newInterest.trim()]);
            setNewInterest("");
        }
    };
    const removeInterest = (interest: string) => setInterests(interests.filter(i => i !== interest));
    const addGoal = () => {
        if (newGoal.trim() && !goals.includes(newGoal.trim())) {
            setGoals([...goals, newGoal.trim()]);
            setNewGoal("");
        }
    };
    const removeGoal = (goal: string) => setGoals(goals.filter(g => g !== goal));
    const handleLogout = () => { logout(); navigate("/"); };

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard" },
        { icon: MessageSquare, label: "Session", path: "/mentor" },
        { icon: Map, label: "Pathways", path: "/roadmap" },
        { icon: Network, label: "Concepts", path: "/concept-map" },
        { icon: BarChart3, label: "Analytics", path: "/analytics" },
        { icon: User, label: "Roots", path: "/profile", active: true },
    ];

    const stage = userMemory?.profile?.stage || "seedling";
    const learningPace = userMemory?.profile?.learning_pace || "moderate";
    const onboarding = userMemory?.onboarding || {};

    /* ─── Loading ─── */
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#FDF8F3] flex items-center justify-center relative">
                <div className="grain-overlay" />
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-[#5C6B4A] flex items-center justify-center shadow-[0_10px_30px_rgba(92,107,74,0.2)]">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                    <span className="mono-tag text-[10px] text-[#8B8178]">Loading your roots...</span>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDF8F3] relative overflow-hidden">
            {/* Grain */}
            <div className="grain-overlay" />

            {/* Ambient Glows */}
            <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="absolute -top-32 right-10 w-[600px] h-[600px] rounded-full bg-[#5C6B4A]/6 blur-[140px]" />
                <div className="absolute bottom-20 -left-32 w-[500px] h-[500px] rounded-full bg-[#D4A574]/8 blur-[120px]" />
            </div>

            <div className="flex min-h-screen relative z-10">

                {/* ═══ SIDEBAR ═══ */}
                <aside className="w-72 flex-col fixed h-screen hidden md:flex bg-white/40 backdrop-blur-xl border-r border-[#E8DED4]/60">
                    <div className="p-8 pb-0">
                        <Link to="/" className="block mb-1">
                            <span className="text-[#5C6B4A] font-extrabold text-xl tracking-tight uppercase" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}>
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
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`group flex items-center gap-3.5 px-5 py-3.5 rounded-2xl transition-all duration-500 relative ${
                                    item.active
                                        ? "bg-[#5C6B4A] text-white shadow-[0_10px_30px_rgba(92,107,74,0.25)]"
                                        : "text-[#8B8178] hover:bg-[#5C6B4A]/5 hover:text-[#3D3D3D]"
                                }`}
                            >
                                <span className={`mono-tag text-[8px] ${item.active ? "text-white/30" : "text-[#8B8178]/30"}`}>0{i + 1}</span>
                                <item.icon className="w-[18px] h-[18px]" />
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.active && <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white/60" />}
                            </Link>
                        ))}
                    </nav>

                    <div className="p-4 space-y-2 mt-auto">
                        {user && (
                            <div className="px-5 py-4 rounded-2xl bg-[#5C6B4A]/5 border border-[#5C6B4A]/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-[#5C6B4A] flex items-center justify-center text-white text-sm font-bold">{(user.name || user.email)?.[0]?.toUpperCase()}</div>
                                    <div className="min-w-0">
                                        <span className="text-sm text-[#3D3D3D] font-medium block truncate">{user.name || user.email}</span>
                                        <span className="mono-tag text-[7px] text-[#8B8178]/50">Learner</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <button onClick={handleLogout} className="flex items-center gap-3 px-5 py-3 rounded-2xl text-[#8B8178] hover:bg-red-50/80 hover:text-red-500 transition-all duration-500 w-full">
                            <LogOut className="w-[18px] h-[18px]" />
                            <span className="text-sm font-medium">Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* ═══ MAIN CONTENT ═══ */}
                <main className="flex-1 ml-0 md:ml-72 pb-24 md:pb-0">
                    <div className="max-w-4xl mx-auto px-6 md:px-10 lg:px-14 py-10 md:py-14 space-y-10">

                        {/* Header */}
                        <motion.header
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.9, ease }}
                            className="flex flex-col md:flex-row md:items-end md:justify-between gap-6"
                        >
                            <div>
                                <span className="mono-tag text-[10px] text-[#8B8178] mb-3 block">// Your Roots</span>
                                <h1
                                    className="text-[clamp(2.2rem,5vw,3.5rem)] font-black leading-[0.9] tracking-tight text-[#5C6B4A] uppercase"
                                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}
                                >
                                    Profile.
                                </h1>
                                <p className="text-[#8B8178] text-base mt-3 max-w-md leading-relaxed">
                                    The foundations of who you are becoming. These are not fixed — they deepen and branch as you grow.
                                </p>
                            </div>

                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className={`group flex items-center gap-2.5 px-6 py-3 rounded-full font-semibold text-sm transition-all duration-500 w-fit ${
                                    isEditing
                                        ? "bg-[#E8DED4]/50 text-[#8B8178] hover:bg-[#E8DED4]"
                                        : "bg-[#5C6B4A] text-white hover:bg-[#4A5A3A] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(92,107,74,0.2)]"
                                }`}
                            >
                                {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                                {isEditing ? "Cancel" : "Edit Profile"}
                            </button>
                        </motion.header>

                        {/* ──── Hero Identity Card (Dark Green) ──── */}
                        <motion.section
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.9, delay: 0.1, ease }}
                            className="relative rounded-[2.5rem] overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-[#4A5A3A]" />
                            <div
                                className="absolute inset-0 opacity-[0.04] pointer-events-none"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                                    mixBlendMode: "multiply",
                                }}
                            />
                            <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-white/5 blur-[80px]" />

                            <div className="relative z-10 p-8 md:p-12">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                                    {/* Avatar */}
                                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-[#D4A574] to-[#8B8178] flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-[0_10px_30px_rgba(0,0,0,0.15)] ring-4 ring-white/10"
                                         style={{ fontFamily: "'Inter', sans-serif" }}>
                                        {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "G"}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
                                            {user?.name || "Growing Soul"}
                                        </h2>
                                        <span className="text-white/40 text-sm">{user?.email}</span>
                                    </div>
                                </div>

                                {/* Stats Row */}
                                <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-white/8">
                                    {[
                                        { label: "Stage", value: stage },
                                        { label: "Pace", value: learningPace },
                                        { label: "Style", value: onboarding.mentoring_style || "supportive" },
                                    ].map((stat) => (
                                        <div key={stat.label} className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/8 border border-white/10 backdrop-blur-sm">
                                            <span className="mono-tag text-[9px] text-white/35">{stat.label}</span>
                                            <span className="text-[13px] text-white font-semibold capitalize">{stat.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.section>

                        {/* ──── Interests ──── */}
                        <motion.section
                            initial={{ opacity: 0, y: 25 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2, ease }}
                            className="relative group rounded-[2rem] p-7 md:p-8 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]"
                        >
                            <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-[#5C6B4A]/20" />

                            <div className="flex items-center gap-2.5 mb-6">
                                <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                    <Leaf className="w-4 h-4 text-[#5C6B4A]" />
                                </div>
                                <span className="mono-tag text-[9px] text-[#8B8178]">Interests</span>
                                <span className="mono-tag text-[8px] text-[#8B8178]/25 ml-auto">{interests.length} items</span>
                            </div>

                            <div className="flex flex-wrap gap-2.5 mb-5">
                                {interests.length === 0 ? (
                                    <p className="text-[#8B8178]/60 text-sm italic">No interests yet. Click edit to add some!</p>
                                ) : (
                                    interests.map((interest, idx) => (
                                        <motion.span
                                            key={idx}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.4, delay: idx * 0.04, ease }}
                                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                                                isEditing
                                                    ? "bg-[#5C6B4A]/10 text-[#5C6B4A] border border-[#5C6B4A]/15 pr-3"
                                                    : "bg-[#5C6B4A]/8 text-[#5C6B4A]"
                                            }`}
                                        >
                                            {interest}
                                            {isEditing && (
                                                <button onClick={() => removeInterest(interest)} className="ml-1 p-0.5 rounded-full hover:bg-[#5C6B4A]/15 transition-colors">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </motion.span>
                                    ))
                                )}
                            </div>

                            <AnimatePresence>
                                {isEditing && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3, ease }}
                                        className="flex gap-2 pt-4 border-t border-[#E8DED4]/50"
                                    >
                                        <input
                                            type="text"
                                            value={newInterest}
                                            onChange={(e) => setNewInterest(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && addInterest()}
                                            placeholder="Add an interest..."
                                            className="flex-1 px-5 py-3 bg-white/60 border border-[#E8DED4] rounded-full text-[#3D3D3D] text-sm placeholder:text-[#8B8178]/40 focus:outline-none focus:ring-2 focus:ring-[#5C6B4A]/15 focus:border-[#5C6B4A]/25 transition-all duration-500 backdrop-blur-sm"
                                            style={{ fontFamily: "'Inter', sans-serif" }}
                                        />
                                        <button
                                            onClick={addInterest}
                                            className="w-11 h-11 rounded-full bg-[#5C6B4A] text-white flex items-center justify-center hover:bg-[#4A5A3A] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(92,107,74,0.2)] transition-all duration-500 shrink-0"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.section>

                        {/* ──── Aspirations / Goals ──── */}
                        <motion.section
                            initial={{ opacity: 0, y: 25 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.3, ease }}
                            className="relative group rounded-[2rem] overflow-hidden"
                        >
                            {/* Green tint bg */}
                            <div className="absolute inset-0 bg-[#5C6B4A]/[0.04] rounded-[2rem]" />
                            <div className="absolute inset-0 border border-[#5C6B4A]/10 rounded-[2rem]" />

                            <div className="relative z-10 p-7 md:p-8">
                                <div className="flex items-center gap-2.5 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-[#D4A574]/15 flex items-center justify-center">
                                        <Sprout className="w-4 h-4 text-[#D4A574]" />
                                    </div>
                                    <span className="mono-tag text-[9px] text-[#8B8178]">Aspirations</span>
                                </div>
                                <p className="text-[#8B8178]/60 text-sm mb-6 ml-[42px]">Where you hope your growth will lead.</p>

                                <div className="space-y-3">
                                    {goals.length === 0 ? (
                                        <p className="text-[#8B8178]/60 text-sm italic ml-[42px]">No goals yet. Click edit to add your aspirations!</p>
                                    ) : (
                                        goals.map((goal, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -15 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.5, delay: 0.1 + idx * 0.06, ease }}
                                                className="flex items-center gap-4 group/goal py-3 px-4 rounded-xl hover:bg-white/40 transition-all duration-300"
                                            >
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <span className="mono-tag text-[8px] text-[#8B8178]/30 shrink-0">0{idx + 1}</span>
                                                    <div className="w-2 h-2 rounded-full bg-[#D4A574] shrink-0" />
                                                    <span className="text-[#3D3D3D] text-base font-medium">{goal}</span>
                                                </div>
                                                {isEditing && (
                                                    <button onClick={() => removeGoal(goal)} className="p-1.5 rounded-lg text-[#8B8178] hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover/goal:opacity-100">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </motion.div>
                                        ))
                                    )}
                                </div>

                                <AnimatePresence>
                                    {isEditing && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3, ease }}
                                            className="flex gap-2 mt-4 pt-4 border-t border-[#5C6B4A]/10"
                                        >
                                            <input
                                                type="text"
                                                value={newGoal}
                                                onChange={(e) => setNewGoal(e.target.value)}
                                                onKeyDown={(e) => e.key === "Enter" && addGoal()}
                                                placeholder="Add an aspiration..."
                                                className="flex-1 px-5 py-3 bg-white/60 border border-[#E8DED4] rounded-full text-[#3D3D3D] text-sm placeholder:text-[#8B8178]/40 focus:outline-none focus:ring-2 focus:ring-[#5C6B4A]/15 focus:border-[#5C6B4A]/25 transition-all duration-500 backdrop-blur-sm"
                                                style={{ fontFamily: "'Inter', sans-serif" }}
                                            />
                                            <button
                                                onClick={addGoal}
                                                className="w-11 h-11 rounded-full bg-[#5C6B4A] text-white flex items-center justify-center hover:bg-[#4A5A3A] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(92,107,74,0.2)] transition-all duration-500 shrink-0"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.section>

                        {/* ──── Save Button ──── */}
                        <AnimatePresence>
                            {isEditing && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    transition={{ duration: 0.4, ease }}
                                    className="flex justify-center"
                                >
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="group flex items-center gap-3 px-10 py-4 bg-[#5C6B4A] text-white rounded-full font-bold text-base hover:bg-[#4A5A3A] hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(92,107,74,0.25)] transition-all duration-500 disabled:opacity-50 disabled:hover:translate-y-0"
                                    >
                                        {isSaving ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Saving changes...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Save Changes
                                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                            </>
                                        )}
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ──── Transparency Note ──── */}
                        <motion.section
                            initial={{ opacity: 0, y: 25 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.4, ease }}
                            className="relative rounded-[2rem] p-7 md:p-8 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center shrink-0">
                                    <Shield className="w-5 h-5 text-[#5C6B4A]" />
                                </div>
                                <div>
                                    <h4 className="text-[#3D3D3D] font-bold text-base mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>You control what grows here</h4>
                                    <p className="text-[#8B8178] text-sm leading-relaxed">
                                        Your roots, aspirations, and growth journey are yours alone.
                                        You can tend to them, prune what no longer serves you,
                                        or let them evolve naturally. Nothing is permanent unless you want it to be.
                                    </p>
                                </div>
                            </div>
                        </motion.section>

                        {/* Footer */}
                        <motion.footer
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.6, ease }}
                            className="py-6 flex items-center gap-3"
                        >
                            <div className="w-8 h-px bg-[#E8DED4]" />
                            <span className="mono-tag text-[9px] text-[#8B8178]/30">Identity is not a destination — it's a garden you tend</span>
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
