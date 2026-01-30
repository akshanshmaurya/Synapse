import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Leaf, Sprout, Home, MessageSquare, Map, User, LogOut, ChevronRight, Compass, HelpCircle, AlertCircle, RefreshCw, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";

interface RoadmapStep {
    id: string;
    title: string;
    description?: string;
    status: string;
}

interface RoadmapStage {
    id: string;
    name: string;
    description?: string;
    steps: RoadmapStep[];
}

interface Roadmap {
    _id: string;
    title: string;
    goal: string;
    stages: RoadmapStage[];
    version: number;
}

export default function RoadmapPage() {
    const { token, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [goal, setGoal] = useState("");
    const [message, setMessage] = useState("");
    const [showFeedbackFor, setShowFeedbackFor] = useState<string | null>(null);

    const API_URL = "http://localhost:8000";

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard" },
        { icon: MessageSquare, label: "Session", path: "/mentor" },
        { icon: Map, label: "Pathways", path: "/roadmap", active: true },
        { icon: User, label: "Roots", path: "/profile" },
    ];

    useEffect(() => {
        if (isAuthenticated) {
            fetchRoadmap();
        } else {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    const fetchRoadmap = async () => {
        try {
            const response = await fetch(`${API_URL}/api/roadmap/current`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setRoadmap(data.roadmap);
            if (data.message) setMessage(data.message);
        } catch (error) {
            console.error("Failed to fetch roadmap:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const generateRoadmap = async () => {
        if (!goal.trim()) return;
        setIsGenerating(true);
        setMessage("");

        try {
            const response = await fetch(`${API_URL}/api/roadmap/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ goal }),
            });
            const data = await response.json();
            setRoadmap(data.roadmap);
            setGoal("");
        } catch (error) {
            console.error("Failed to generate roadmap:", error);
            setMessage("Something went wrong. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const submitFeedback = async (stepId: string, feedbackType: string) => {
        if (!roadmap) return;

        try {
            await fetch(`${API_URL}/api/roadmap/feedback?roadmap_id=${roadmap._id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ step_id: stepId, feedback_type: feedbackType }),
            });

            // Update local state
            setRoadmap(prev => {
                if (!prev) return prev;
                const updated = { ...prev };
                updated.stages = updated.stages.map(stage => ({
                    ...stage,
                    steps: stage.steps.map(step =>
                        step.id === stepId ? { ...step, status: feedbackType } : step
                    ),
                }));
                return updated;
            });

            setShowFeedbackFor(null);
            setMessage("Your feedback has been noted. The pathway may adapt to support you better.");
        } catch (error) {
            console.error("Failed to submit feedback:", error);
        }
    };

    const regenerateRoadmap = async () => {
        if (!roadmap) return;
        setIsRegenerating(true);

        try {
            const response = await fetch(`${API_URL}/api/roadmap/regenerate?roadmap_id=${roadmap._id}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setRoadmap(data.roadmap);
            setMessage(data.message);
        } catch (error) {
            console.error("Failed to regenerate roadmap:", error);
        } finally {
            setIsRegenerating(false);
        }
    };

    const markStepDone = async (stepId: string) => {
        await submitFeedback(stepId, "done");
    };

    const getStepStatusColor = (status: string) => {
        switch (status) {
            case "done": return "bg-[#5C6B4A] text-[#FDF8F3]";
            case "stuck": return "bg-[#D4A574]/20 border-[#D4A574]";
            case "needs_help": return "bg-[#E8C4A0]/20 border-[#E8C4A0]";
            case "not_clear": return "bg-[#8B8178]/20 border-[#8B8178]";
            default: return "bg-white/60 border-[#E8DED4]";
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4]">
            {/* Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-40 w-[300px] h-[300px] rounded-full bg-[#D4A574]/10 blur-3xl" />
                <div className="absolute bottom-20 right-20 w-[400px] h-[400px] rounded-full bg-[#5C6B4A]/5 blur-3xl" />
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
                    <div className="max-w-3xl mx-auto space-y-8">
                        {/* Header */}
                        <motion.header
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <h1 className="font-serif text-4xl lg:text-5xl text-[#3D3D3D] mb-4">Pathways</h1>
                            <p className="text-lg text-[#8B8178] leading-relaxed max-w-xl">
                                Your growth journey, mapped step by step. Mark anything that feels unclear or challenging — the path will adapt to support you.
                            </p>
                        </motion.header>

                        {/* Message */}
                        <AnimatePresence>
                            {message && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="bg-[#5C6B4A]/10 border border-[#5C6B4A]/20 rounded-2xl p-4"
                                >
                                    <p className="text-[#5C6B4A] text-sm">{message}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Loading */}
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-[#5C6B4A] animate-spin" />
                            </div>
                        ) : !isAuthenticated ? (
                            /* Not logged in */
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4] text-center"
                            >
                                <Compass className="w-12 h-12 text-[#5C6B4A] mx-auto mb-4" />
                                <h2 className="font-serif text-xl text-[#3D3D3D] mb-2">Sign in to see your pathways</h2>
                                <p className="text-[#8B8178] mb-6">Your personalized growth journey awaits.</p>
                                <Link
                                    to="/signin"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium hover:bg-[#4A5A3A] transition-all duration-500"
                                >
                                    Sign in <ChevronRight className="w-4 h-4" />
                                </Link>
                            </motion.div>
                        ) : !roadmap ? (
                            /* No roadmap yet */
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                        <Compass className="w-5 h-5 text-[#5C6B4A]" />
                                    </div>
                                    <h2 className="font-serif text-xl text-[#3D3D3D]">Plant your first pathway</h2>
                                </div>
                                <p className="text-[#8B8178] mb-6">Share a goal, and we'll create a personalized growth journey for you.</p>
                                <textarea
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    placeholder="What would you like to grow towards? e.g., 'Become a senior engineer' or 'Improve my communication skills'"
                                    className="w-full p-4 bg-[#FDF8F3]/50 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] placeholder:text-[#8B8178]/50 resize-none h-24 focus:ring-2 focus:ring-[#5C6B4A]/20 focus:border-[#5C6B4A]/30 transition-all duration-300 mb-4"
                                />
                                <button
                                    onClick={generateRoadmap}
                                    disabled={!goal.trim() || isGenerating}
                                    className="px-6 py-3 bg-[#5C6B4A] text-[#FDF8F3] rounded-full font-medium hover:bg-[#4A5A3A] transition-all duration-500 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Creating your pathway...
                                        </>
                                    ) : (
                                        <>Create my pathway</>
                                    )}
                                </button>
                            </motion.div>
                        ) : (
                            /* Roadmap display */
                            <>
                                {/* Roadmap header */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/60 backdrop-blur-sm rounded-3xl p-6 border border-[#E8DED4]"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h2 className="font-serif text-2xl text-[#3D3D3D] mb-2">{roadmap.title}</h2>
                                            <p className="text-[#8B8178]">Goal: {roadmap.goal}</p>
                                            <p className="text-xs text-[#8B8178]/60 mt-1">Version {roadmap.version}</p>
                                        </div>
                                        <button
                                            onClick={regenerateRoadmap}
                                            disabled={isRegenerating}
                                            className="flex items-center gap-2 px-4 py-2 rounded-full text-[#5C6B4A] hover:bg-[#5C6B4A]/10 transition-all duration-500"
                                        >
                                            <RefreshCw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
                                            <span className="text-sm">Adapt pathway</span>
                                        </button>
                                    </div>
                                </motion.div>

                                {/* Stages */}
                                <div className="space-y-6">
                                    {roadmap.stages.map((stage, stageIdx) => (
                                        <motion.div
                                            key={stage.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.5, delay: stageIdx * 0.1 }}
                                            className="space-y-4"
                                        >
                                            {/* Stage header */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#5C6B4A] flex items-center justify-center text-[#FDF8F3] text-sm font-medium">
                                                    {stageIdx + 1}
                                                </div>
                                                <div>
                                                    <h3 className="font-serif text-lg text-[#3D3D3D]">{stage.name}</h3>
                                                    {stage.description && (
                                                        <p className="text-sm text-[#8B8178]">{stage.description}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Steps */}
                                            <div className="pl-10 space-y-3">
                                                {stage.steps.map((step) => (
                                                    <div
                                                        key={step.id}
                                                        className={`rounded-2xl p-4 border transition-all duration-500 ${getStepStatusColor(step.status)}`}
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1">
                                                                <h4 className="font-medium text-[#3D3D3D] mb-1">{step.title}</h4>
                                                                {step.description && (
                                                                    <p className="text-sm text-[#8B8178]">{step.description}</p>
                                                                )}
                                                                {step.status !== "pending" && step.status !== "done" && (
                                                                    <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-[#8B8178]/10 text-[#8B8178]">
                                                                        {step.status === "stuck" && "Needs nurturing"}
                                                                        {step.status === "needs_help" && "Awaiting guidance"}
                                                                        {step.status === "not_clear" && "Being clarified"}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {step.status === "done" ? (
                                                                    <div className="w-8 h-8 rounded-full bg-[#5C6B4A] flex items-center justify-center">
                                                                        <Check className="w-4 h-4 text-[#FDF8F3]" />
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={() => markStepDone(step.id)}
                                                                            className="p-2 rounded-full hover:bg-[#5C6B4A]/10 text-[#5C6B4A] transition-colors"
                                                                            title="Mark as done"
                                                                        >
                                                                            <Check className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setShowFeedbackFor(showFeedbackFor === step.id ? null : step.id)}
                                                                            className="p-2 rounded-full hover:bg-[#D4A574]/10 text-[#D4A574] transition-colors"
                                                                            title="Need help with this"
                                                                        >
                                                                            <HelpCircle className="w-4 h-4" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Feedback options */}
                                                        <AnimatePresence>
                                                            {showFeedbackFor === step.id && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, height: 0 }}
                                                                    animate={{ opacity: 1, height: "auto" }}
                                                                    exit={{ opacity: 0, height: 0 }}
                                                                    className="mt-4 pt-4 border-t border-[#E8DED4]"
                                                                >
                                                                    <p className="text-sm text-[#8B8178] mb-3">How can we help?</p>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        <button
                                                                            onClick={() => submitFeedback(step.id, "stuck")}
                                                                            className="px-3 py-1.5 rounded-full text-sm border border-[#D4A574] text-[#D4A574] hover:bg-[#D4A574]/10 transition-colors"
                                                                        >
                                                                            I'm stuck
                                                                        </button>
                                                                        <button
                                                                            onClick={() => submitFeedback(step.id, "not_clear")}
                                                                            className="px-3 py-1.5 rounded-full text-sm border border-[#8B8178] text-[#8B8178] hover:bg-[#8B8178]/10 transition-colors"
                                                                        >
                                                                            Not clear
                                                                        </button>
                                                                        <button
                                                                            onClick={() => submitFeedback(step.id, "needs_help")}
                                                                            className="px-3 py-1.5 rounded-full text-sm border border-[#5C6B4A] text-[#5C6B4A] hover:bg-[#5C6B4A]/10 transition-colors"
                                                                        >
                                                                            Need guidance
                                                                        </button>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Footer note */}
                                <motion.footer
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.6, delay: 0.5 }}
                                    className="text-center py-8"
                                >
                                    <p className="text-sm text-[#8B8178]/60">
                                        This pathway adapts to you. Mark what feels challenging, and it will adjust.
                                    </p>
                                </motion.footer>
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
