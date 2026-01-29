import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Leaf, Sprout, Home, MessageSquare, Map, User, Settings, Shield, Edit3, X, Plus, Check, LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserMemory, updateUserProfile } from "@/services/api";

export default function ProfilePage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [userMemory, setUserMemory] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Editable fields
    const [interests, setInterests] = useState<string[]>([]);
    const [goals, setGoals] = useState<string[]>([]);
    const [newInterest, setNewInterest] = useState("");
    const [newGoal, setNewGoal] = useState("");

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const memory = await fetchUserMemory();
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

    const removeInterest = (interest: string) => {
        setInterests(interests.filter(i => i !== interest));
    };

    const addGoal = () => {
        if (newGoal.trim() && !goals.includes(newGoal.trim())) {
            setGoals([...goals, newGoal.trim()]);
            setNewGoal("");
        }
    };

    const removeGoal = (goal: string) => {
        setGoals(goals.filter(g => g !== goal));
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard" },
        { icon: MessageSquare, label: "Session", path: "/mentor" },
        { icon: Map, label: "Pathways", path: "/roadmap" },
        { icon: User, label: "Roots", path: "/profile", active: true },
    ];

    const stage = userMemory?.profile?.stage || "seedling";
    const learningPace = userMemory?.profile?.learning_pace || "moderate";
    const onboarding = userMemory?.onboarding || {};

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#5C6B4A] animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4]">
            {/* Subtle background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-40 right-20 w-[350px] h-[350px] rounded-full bg-[#D4A574]/10 blur-3xl" />
                <div className="absolute bottom-40 left-10 w-[250px] h-[250px] rounded-full bg-[#5C6B4A]/5 blur-3xl" />
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

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[#8B8178] hover:bg-[#E8DED4]/50 transition-all duration-500"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="text-sm font-medium">Sign Out</span>
                    </button>
                </aside>

                {/* Main Content */}
                <main className="flex-1 ml-64 p-8 lg:p-12">
                    <div className="max-w-3xl mx-auto space-y-12">
                        {/* Header */}
                        <motion.header
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <h1 className="font-serif text-4xl lg:text-5xl text-[#3D3D3D] mb-4">Your Roots</h1>
                            <p className="text-lg text-[#8B8178] leading-relaxed max-w-xl">
                                The foundations of who you are becoming.
                                These are not fixed — they deepen and branch as you grow.
                            </p>
                        </motion.header>

                        {/* Identity Card */}
                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                        >
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D4A574] to-[#5C6B4A] flex items-center justify-center text-white text-2xl font-serif">
                                        {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "G"}
                                    </div>
                                    <div>
                                        <h2 className="font-serif text-2xl text-[#3D3D3D]">{user?.name || "Growing Soul"}</h2>
                                        <p className="text-[#8B8178]">{user?.email}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full text-[#8B8178] hover:bg-[#E8DED4]/50 transition-all duration-500"
                                >
                                    {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                                    <span className="text-sm">{isEditing ? "Cancel" : "Edit"}</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-4 border-t border-[#E8DED4] pt-6">
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-[#8B8178] mb-1">Stage</p>
                                    <p className="font-medium text-[#3D3D3D] capitalize">{stage}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-[#8B8178] mb-1">Pace</p>
                                    <p className="font-medium text-[#3D3D3D] capitalize">{learningPace}</p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-wider text-[#8B8178] mb-1">Style</p>
                                    <p className="font-medium text-[#3D3D3D] capitalize">{onboarding.mentoring_style || "supportive"}</p>
                                </div>
                            </div>
                        </motion.section>

                        {/* Interests Section */}
                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                        >
                            <div className="flex items-center gap-2 mb-6">
                                <Leaf className="w-5 h-5 text-[#5C6B4A]" />
                                <h3 className="font-serif text-xl text-[#3D3D3D]">Interests</h3>
                            </div>

                            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 border border-[#E8DED4]">
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {interests.length === 0 ? (
                                        <p className="text-[#8B8178]">No interests yet. Add some!</p>
                                    ) : (
                                        interests.map((interest, idx) => (
                                            <span
                                                key={idx}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5C6B4A]/10 text-[#5C6B4A]"
                                            >
                                                {interest}
                                                {isEditing && (
                                                    <button onClick={() => removeInterest(interest)}>
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </span>
                                        ))
                                    )}
                                </div>

                                <AnimatePresence>
                                    {isEditing && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="flex gap-2"
                                        >
                                            <input
                                                type="text"
                                                value={newInterest}
                                                onChange={(e) => setNewInterest(e.target.value)}
                                                onKeyPress={(e) => e.key === "Enter" && addInterest()}
                                                placeholder="Add an interest..."
                                                className="flex-1 px-4 py-2 bg-[#FDF8F3] border border-[#E8DED4] rounded-full text-[#3D3D3D] placeholder:text-[#8B8178]/50 focus:ring-2 focus:ring-[#5C6B4A]/20"
                                            />
                                            <button
                                                onClick={addInterest}
                                                className="p-2 rounded-full bg-[#5C6B4A] text-[#FDF8F3]"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.section>

                        {/* Goals Section */}
                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                        >
                            <div className="flex items-center gap-2 mb-6">
                                <Sprout className="w-5 h-5 text-[#5C6B4A]" />
                                <h3 className="font-serif text-xl text-[#3D3D3D]">Aspirations</h3>
                            </div>

                            <div className="bg-[#5C6B4A]/5 rounded-3xl p-8 border border-[#5C6B4A]/10">
                                <p className="text-[#8B8178] mb-6">Where you hope your growth will lead:</p>
                                <div className="space-y-4">
                                    {goals.length === 0 ? (
                                        <p className="text-[#8B8178]">No goals yet. Add your aspirations!</p>
                                    ) : (
                                        goals.map((goal, idx) => (
                                            <div key={idx} className="flex items-center gap-3 justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-[#D4A574]" />
                                                    <span className="font-serif text-lg text-[#3D3D3D]">{goal}</span>
                                                </div>
                                                {isEditing && (
                                                    <button
                                                        onClick={() => removeGoal(goal)}
                                                        className="p-1 text-[#8B8178] hover:text-[#3D3D3D]"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>

                                <AnimatePresence>
                                    {isEditing && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="flex gap-2 mt-4"
                                        >
                                            <input
                                                type="text"
                                                value={newGoal}
                                                onChange={(e) => setNewGoal(e.target.value)}
                                                onKeyPress={(e) => e.key === "Enter" && addGoal()}
                                                placeholder="Add an aspiration..."
                                                className="flex-1 px-4 py-2 bg-white border border-[#E8DED4] rounded-full text-[#3D3D3D] placeholder:text-[#8B8178]/50 focus:ring-2 focus:ring-[#5C6B4A]/20"
                                            />
                                            <button
                                                onClick={addGoal}
                                                className="p-2 rounded-full bg-[#5C6B4A] text-[#FDF8F3]"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.section>

                        {/* Save Button */}
                        <AnimatePresence>
                            {isEditing && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="flex justify-center"
                                >
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex items-center gap-2 px-8 py-3 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium hover:bg-[#4A5A3A] transition-all duration-500 disabled:opacity-50"
                                    >
                                        {isSaving ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Save Changes
                                            </>
                                        )}
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Transparency Note */}
                        <motion.section
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="bg-white/40 backdrop-blur-sm rounded-3xl p-6 border border-[#E8DED4]"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center flex-shrink-0">
                                    <Shield className="w-5 h-5 text-[#5C6B4A]" />
                                </div>
                                <div>
                                    <h4 className="font-serif text-lg text-[#3D3D3D] mb-2">You control what grows here</h4>
                                    <p className="text-[#8B8178] leading-relaxed">
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
                            transition={{ duration: 0.6, delay: 0.5 }}
                            className="text-center py-8"
                        >
                            <p className="text-sm text-[#8B8178]/50">
                                Identity is not a destination. It's a garden you tend.
                            </p>
                        </motion.footer>
                    </div>
                </main>
            </div>
        </div>
    );
}
