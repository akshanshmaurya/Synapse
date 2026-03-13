import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Home, MessageSquare, Map, User, BarChart3, LogOut, ChevronRight, Compass, HelpCircle, RefreshCw, Check, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL } from "@/config/env";

/* ──────────────────────────────────────────────
   Animation Presets (Landing Page system)
   ────────────────────────────────────────────── */
const ease = [0.23, 1, 0.32, 1];

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
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [goal, setGoal] = useState("");
    const [message, setMessage] = useState("");
    const [showFeedbackFor, setShowFeedbackFor] = useState<string | null>(null);


    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard" },
        { icon: MessageSquare, label: "Session", path: "/mentor" },
        { icon: Map, label: "Pathways", path: "/roadmap", active: true },
        { icon: BarChart3, label: "Analytics", path: "/analytics" },
        { icon: User, label: "Roots", path: "/profile" },
    ];

    useEffect(() => {
        if (isAuthenticated) { fetchRoadmap(); }
        else { setIsLoading(false); }
    }, [isAuthenticated]);

    const fetchRoadmap = async () => {
        try {
            const response = await fetch(`${API_URL}/api/roadmap/current`, { credentials: 'include' });
            const data = await response.json();
            setRoadmap(data.roadmap);
            if (data.message) setMessage(data.message);
        } catch (error) { console.error("Failed to fetch roadmap:", error); }
        finally { setIsLoading(false); }
    };

    const generateRoadmap = async () => {
        if (!goal.trim()) return;
        setIsGenerating(true);
        setMessage("");
        try {
            const response = await fetch(`${API_URL}/api/roadmap/generate`, {
                method: "POST", headers: { "Content-Type": "application/json" }, credentials: 'include', body: JSON.stringify({ goal }),
            });
            const data = await response.json();
            setRoadmap(data.roadmap);
            setGoal("");
        } catch (error) { console.error("Failed to generate roadmap:", error); setMessage("Something went wrong. Please try again."); }
        finally { setIsGenerating(false); }
    };

    const submitFeedback = async (stepId: string, feedbackType: string) => {
        if (!roadmap) return;
        try {
            await fetch(`${API_URL}/api/roadmap/feedback?roadmap_id=${roadmap._id}`, {
                method: "POST", headers: { "Content-Type": "application/json" }, credentials: 'include',
                body: JSON.stringify({ step_id: stepId, feedback_type: feedbackType }),
            });
            setRoadmap(prev => {
                if (!prev) return prev;
                const updated = { ...prev };
                updated.stages = updated.stages.map(stage => ({
                    ...stage, steps: stage.steps.map(step => step.id === stepId ? { ...step, status: feedbackType } : step),
                }));
                return updated;
            });
            setShowFeedbackFor(null);
            setMessage("Your feedback has been noted. The pathway may adapt to support you better.");
        } catch (error) { console.error("Failed to submit feedback:", error); }
    };

    const regenerateRoadmap = async () => {
        if (!roadmap) return;
        setIsRegenerating(true);
        try {
            const response = await fetch(`${API_URL}/api/roadmap/regenerate?roadmap_id=${roadmap._id}`, { method: "POST", credentials: 'include' });
            const data = await response.json();
            setRoadmap(data.roadmap);
            setMessage(data.message);
        } catch (error) { console.error("Failed to regenerate roadmap:", error); }
        finally { setIsRegenerating(false); }
    };

    const markStepDone = async (stepId: string) => await submitFeedback(stepId, "done");

    const getStepStatusInfo = (status: string) => {
        switch (status) {
            case "done": return { label: "Completed", color: "text-[#5C6B4A]", bg: "bg-[#5C6B4A]/8", border: "border-[#5C6B4A]/15" };
            case "stuck": return { label: "Needs nurturing", color: "text-[#D4A574]", bg: "bg-[#D4A574]/8", border: "border-[#D4A574]/15" };
            case "needs_help": return { label: "Awaiting guidance", color: "text-[#D4A574]", bg: "bg-[#D4A574]/5", border: "border-[#D4A574]/10" };
            case "not_clear": return { label: "Being clarified", color: "text-[#8B8178]", bg: "bg-[#8B8178]/8", border: "border-[#8B8178]/15" };
            default: return { label: "Pending", color: "text-[#8B8178]", bg: "bg-transparent", border: "border-[#E8DED4]" };
        }
    };

    const completedCount = roadmap?.stages.reduce((sum, s) => sum + s.steps.filter(st => st.status === "done").length, 0) || 0;
    const totalCount = roadmap?.stages.reduce((sum, s) => sum + s.steps.length, 0) || 0;

    return (
        <div className="min-h-screen bg-[#FDF8F3] relative overflow-hidden">
            <div className="grain-overlay" />

            <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="absolute -top-40 left-20 w-[600px] h-[600px] rounded-full bg-[#5C6B4A]/5 blur-[140px]" />
                <div className="absolute bottom-10 right-0 w-[500px] h-[500px] rounded-full bg-[#D4A574]/8 blur-[120px]" />
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
                        {user && (
                            <div className="px-5 py-4 rounded-2xl bg-[#5C6B4A]/5 border border-[#5C6B4A]/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-[#5C6B4A] flex items-center justify-center text-white text-sm font-bold">{(user.name || user.email)?.[0]?.toUpperCase()}</div>
                                    <div className="min-w-0"><span className="text-sm text-[#3D3D3D] font-medium block truncate">{user.name || user.email}</span><span className="mono-tag text-[7px] text-[#8B8178]/50">Learner</span></div>
                                </div>
                            </div>
                        )}
                        <button onClick={() => { logout(); navigate("/"); }} className="flex items-center gap-3 px-5 py-3 rounded-2xl text-[#8B8178] hover:bg-red-50/80 hover:text-red-500 transition-all duration-500 w-full">
                            <LogOut className="w-[18px] h-[18px]" /><span className="text-sm font-medium">Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* ═══ MAIN ═══ */}
                <main className="flex-1 ml-0 md:ml-72 pb-24 md:pb-0">
                    <div className="max-w-4xl mx-auto px-6 md:px-10 lg:px-14 py-10 md:py-14 space-y-10">

                        {/* Header */}
                        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease }}>
                            <span className="mono-tag text-[10px] text-[#8B8178] mb-3 block">// Pathways</span>
                            <h1 className="text-[clamp(2.2rem,5vw,3.5rem)] font-black leading-[0.9] tracking-tight text-[#5C6B4A] uppercase" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}>
                                Growth<br />Roadmap.
                            </h1>
                            <p className="text-[#8B8178] text-base mt-3 max-w-md leading-relaxed">
                                Your journey, mapped step by step. Mark anything unclear or challenging — the path adapts to you.
                            </p>
                        </motion.header>

                        {/* Message Toast */}
                        <AnimatePresence>
                            {message && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease }}
                                    className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-[#5C6B4A]/8 border border-[#5C6B4A]/15">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#5C6B4A] shrink-0" />
                                    <p className="text-[#5C6B4A] text-sm">{message}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {isLoading ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 gap-4">
                                <div className="w-14 h-14 rounded-full bg-[#5C6B4A] flex items-center justify-center shadow-[0_10px_30px_rgba(92,107,74,0.2)]">
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                </div>
                                <span className="mono-tag text-[10px] text-[#8B8178]">Loading your pathways...</span>
                            </motion.div>

                        ) : !isAuthenticated ? (
                            /* Not logged in */
                            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}
                                className="relative rounded-[2.5rem] p-14 text-center overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]">
                                <div className="w-16 h-16 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center mx-auto mb-6">
                                    <Compass className="w-8 h-8 text-[#5C6B4A]" />
                                </div>
                                <h2 className="text-2xl font-bold text-[#3D3D3D] mb-3 tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>Sign in to see your pathways</h2>
                                <p className="text-[#8B8178] mb-8 max-w-sm mx-auto">Your personalized growth journey awaits.</p>
                                <Link to="/signin" className="group inline-flex items-center gap-2 px-8 py-4 bg-[#5C6B4A] text-white rounded-full font-bold hover:bg-[#4A5A3A] hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(92,107,74,0.25)] transition-all duration-500">
                                    Sign in <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </Link>
                            </motion.div>

                        ) : !roadmap ? (
                            /* No roadmap — Generation form */
                            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}
                                className="relative rounded-[2rem] p-8 md:p-10 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]">
                                <div className="absolute top-6 right-6 w-2 h-2 rounded-full bg-[#5C6B4A]/20" />

                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                        <Compass className="w-5 h-5 text-[#5C6B4A]" />
                                    </div>
                                    <span className="mono-tag text-[9px] text-[#8B8178]">Plant Your First Pathway</span>
                                </div>
                                <p className="text-[#8B8178] text-sm mb-6 ml-[52px]">Share a goal, and we'll create a personalized growth journey for you.</p>

                                <textarea
                                    value={goal}
                                    onChange={(e) => setGoal(e.target.value)}
                                    placeholder="What would you like to grow towards? e.g., 'Become a senior engineer' or 'Improve my communication skills'"
                                    className="w-full p-5 bg-white/60 border border-[#E8DED4] rounded-2xl text-[#3D3D3D] text-sm placeholder:text-[#8B8178]/40 resize-none h-28 focus:outline-none focus:ring-2 focus:ring-[#5C6B4A]/15 focus:border-[#5C6B4A]/25 transition-all duration-500 backdrop-blur-sm leading-relaxed mb-5"
                                    style={{ fontFamily: "'Inter', sans-serif" }}
                                />
                                <button
                                    onClick={generateRoadmap}
                                    disabled={!goal.trim() || isGenerating}
                                    className="group flex items-center gap-3 px-7 py-3.5 bg-[#5C6B4A] text-white rounded-full font-semibold text-sm hover:bg-[#4A5A3A] hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(92,107,74,0.2)] transition-all duration-500 disabled:opacity-50 disabled:hover:translate-y-0"
                                >
                                    {isGenerating ? (
                                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating your pathway...</>
                                    ) : (
                                        <>Create my pathway <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></>
                                    )}
                                </button>
                            </motion.div>

                        ) : (
                            /* ──── Roadmap Display ──── */
                            <>
                                {/* Roadmap Hero Header (Dark Green) */}
                                <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1, ease }}
                                    className="relative rounded-[2.5rem] overflow-hidden">
                                    <div className="absolute inset-0 bg-[#4A5A3A]" />
                                    <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`, mixBlendMode: "multiply" }} />
                                    <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-white/5 blur-[80px]" />

                                    <div className="relative z-10 p-8 md:p-10">
                                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                                            <div className="flex-1">
                                                <span className="mono-tag text-[9px] text-white/25 mb-3 block">Active Pathway · v{roadmap.version}</span>
                                                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>
                                                    {roadmap.title}
                                                </h2>
                                                <p className="text-white/40 text-sm max-w-md">{roadmap.goal}</p>
                                            </div>
                                            <button
                                                onClick={regenerateRoadmap}
                                                disabled={isRegenerating}
                                                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 border border-white/15 text-white/70 hover:bg-white/15 hover:text-white transition-all duration-500 text-sm font-medium"
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                                                Adapt pathway
                                            </button>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mt-8 pt-6 border-t border-white/8">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="mono-tag text-[8px] text-white/25">Progress</span>
                                                <span className="mono-tag text-[8px] text-white/25">{completedCount} / {totalCount} steps</span>
                                            </div>
                                            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-[#D4A574] rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
                                                    transition={{ duration: 1.5, delay: 0.5, ease }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* ──── Stages Timeline ──── */}
                                <div className="space-y-8">
                                    {roadmap.stages.map((stage, stageIdx) => (
                                        <motion.div
                                            key={stage.id}
                                            initial={{ opacity: 0, y: 25 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.7, delay: 0.2 + stageIdx * 0.1, ease }}
                                        >
                                            {/* Stage Header */}
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-10 h-10 rounded-full bg-[#5C6B4A] flex items-center justify-center text-white text-sm font-bold shadow-[0_6px_20px_rgba(92,107,74,0.2)]">
                                                    {stageIdx + 1}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-[#3D3D3D] tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>{stage.name}</h3>
                                                    {stage.description && <p className="text-sm text-[#8B8178]/60">{stage.description}</p>}
                                                </div>
                                            </div>

                                            {/* Steps */}
                                            <div className="ml-5 pl-9 border-l-2 border-[#E8DED4]/60 space-y-3">
                                                {stage.steps.map((step) => {
                                                    const statusInfo = getStepStatusInfo(step.status);
                                                    return (
                                                        <div key={step.id} className={`group relative rounded-2xl p-5 border transition-all duration-500 bg-white/45 backdrop-blur-[20px] ${statusInfo.border} hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-5px_rgba(0,0,0,0.06)]`}>
                                                            {/* Timeline dot */}
                                                            <div className={`absolute -left-[25px] top-6 w-3 h-3 rounded-full border-2 border-[#FDF8F3] ${step.status === "done" ? "bg-[#5C6B4A]" : "bg-[#E8DED4]"}`} />

                                                            <div className="flex items-start justify-between gap-4">
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="font-medium text-[#3D3D3D] text-base mb-1">{step.title}</h4>
                                                                    {step.description && <p className="text-sm text-[#8B8178]/70 leading-relaxed">{step.description}</p>}
                                                                    {step.status !== "pending" && step.status !== "done" && (
                                                                        <span className={`inline-flex items-center gap-1.5 mt-2.5 mono-tag text-[8px] px-2.5 py-1 rounded-full ${statusInfo.bg} ${statusInfo.color}`}>
                                                                            {statusInfo.label}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    {step.status === "done" ? (
                                                                        <div className="w-8 h-8 rounded-full bg-[#5C6B4A] flex items-center justify-center shadow-[0_4px_12px_rgba(92,107,74,0.2)]">
                                                                            <Check className="w-4 h-4 text-white" />
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <button onClick={() => markStepDone(step.id)} className="p-2 rounded-full text-[#5C6B4A]/50 hover:bg-[#5C6B4A]/10 hover:text-[#5C6B4A] transition-all opacity-0 group-hover:opacity-100" title="Mark as done">
                                                                                <Check className="w-4 h-4" />
                                                                            </button>
                                                                            <button onClick={() => setShowFeedbackFor(showFeedbackFor === step.id ? null : step.id)} className="p-2 rounded-full text-[#D4A574]/50 hover:bg-[#D4A574]/10 hover:text-[#D4A574] transition-all opacity-0 group-hover:opacity-100" title="Need help">
                                                                                <HelpCircle className="w-4 h-4" />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Feedback options */}
                                                            <AnimatePresence>
                                                                {showFeedbackFor === step.id && (
                                                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease }}
                                                                        className="mt-4 pt-4 border-t border-[#E8DED4]/50">
                                                                        <span className="mono-tag text-[8px] text-[#8B8178] mb-3 block">How can we help?</span>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {[
                                                                                { type: "stuck", label: "I'm stuck", borderColor: "border-[#D4A574]", textColor: "text-[#D4A574]", hoverBg: "hover:bg-[#D4A574]/8" },
                                                                                { type: "not_clear", label: "Not clear", borderColor: "border-[#8B8178]", textColor: "text-[#8B8178]", hoverBg: "hover:bg-[#8B8178]/8" },
                                                                                { type: "needs_help", label: "Need guidance", borderColor: "border-[#5C6B4A]", textColor: "text-[#5C6B4A]", hoverBg: "hover:bg-[#5C6B4A]/8" },
                                                                            ].map((fb) => (
                                                                                <button key={fb.type} onClick={() => submitFeedback(step.id, fb.type)}
                                                                                    className={`px-4 py-2 rounded-full text-xs font-medium border ${fb.borderColor} ${fb.textColor} ${fb.hoverBg} transition-all duration-300`}>
                                                                                    {fb.label}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.6, ease }} className="py-6 flex items-center gap-3">
                                    <div className="w-8 h-px bg-[#E8DED4]" />
                                    <span className="mono-tag text-[9px] text-[#8B8178]/30">This pathway adapts to you — mark what feels challenging</span>
                                </motion.footer>
                            </>
                        )}
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
