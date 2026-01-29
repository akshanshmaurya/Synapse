import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Volume2, Send, Home, MessageSquare, Map, User, Settings, Sprout, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { sendMessage, streamAudio } from "@/services/api";

interface Reflection {
    id: string;
    type: "guidance" | "thought";
    content: string;
    timestamp?: string;
}

export default function MentorPage() {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const [input, setInput] = useState("");
    const [reflections, setReflections] = useState<Reflection[]>([
        {
            id: "welcome",
            type: "guidance",
            content: "Welcome to this quiet space. I've been reflecting on your journey — the seeds you've planted, the growth you've nurtured.\n\nWhat's stirring in your mind today? There's no rush to answer. Take your time.",
            timestamp: "Just now"
        }
    ]);
    const [isReflecting, setIsReflecting] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
        }
    }, [input]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [reflections, isReflecting]);

    const handleSubmit = async () => {
        if (!input.trim()) return;

        const thought: Reflection = {
            id: Date.now().toString(),
            type: "thought",
            content: input,
            timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        };

        setReflections(prev => [...prev, thought]);
        setInput("");
        setIsReflecting(true);

        try {
            const responseText = await sendMessage(thought.content);

            const guidance: Reflection = {
                id: (Date.now() + 1).toString(),
                type: "guidance",
                content: responseText,
                timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            };
            setReflections(prev => [...prev, guidance]);

            // Optional: play audio
            const audio = await streamAudio(responseText);
            if (audio) {
                audio.play().catch(e => console.log("Auto-play prevented:", e));
            }

        } catch (error) {
            console.error("Session error", error);
            const errorGuidance: Reflection = {
                id: (Date.now() + 1).toString(),
                type: "guidance",
                content: "I sense a moment of stillness in our connection. Please share your thought again, and we'll find our way together.",
                timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            };
            setReflections(prev => [...prev, errorGuidance]);
        } finally {
            setIsReflecting(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard" },
        { icon: MessageSquare, label: "Session", path: "/mentor", active: true },
        { icon: Map, label: "Pathways", path: "/roadmap" },
        { icon: User, label: "Roots", path: "/profile" },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FDF8F3] via-[#F5EDE4] to-[#E8DED4]">
            {/* Subtle background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#D4A574]/10 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[#5C6B4A]/5 blur-3xl" />
            </div>

            <div className="flex min-h-screen relative z-10">
                {/* Sidebar */}
                <aside className="w-64 p-6 flex flex-col fixed h-screen">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-10 h-10 rounded-full bg-[#5C6B4A] flex items-center justify-center">
                            <Sprout className="w-5 h-5 text-[#FDF8F3]" />
                        </div>
                        <div>
                            <span className="font-serif text-lg text-[#3D3D3D]">Synapse</span>
                            <p className="text-[10px] text-[#8B8178] uppercase tracking-wider">
                                {isAuthenticated ? user?.name || "Growing" : "Guest Mode"}
                            </p>
                        </div>
                    </div>

                    {/* Nav */}
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

                    {/* Bottom */}
                    <div className="space-y-2">
                        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-[#8B8178] hover:bg-[#E8DED4]/50 transition-all duration-500">
                            <Settings className="w-5 h-5" />
                            <span className="text-sm font-medium">Settings</span>
                        </button>
                        {isAuthenticated ? (
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-[#8B8178] hover:bg-red-50 hover:text-red-500 transition-all duration-500"
                            >
                                <LogOut className="w-5 h-5" />
                                <span className="text-sm font-medium">Sign out</span>
                            </button>
                        ) : (
                            <Link
                                to="/signin"
                                className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-[#5C6B4A] bg-[#5C6B4A]/10 hover:bg-[#5C6B4A]/20 transition-all duration-500"
                            >
                                <User className="w-5 h-5" />
                                <span className="text-sm font-medium">Sign in</span>
                            </Link>
                        )}
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 ml-64 flex flex-col">
                    {/* Header */}
                    <header className="p-8 pb-4">
                        <div className="max-w-3xl mx-auto">
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6 }}
                                className="flex items-center gap-3"
                            >
                                <div className="w-12 h-12 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                    <Leaf className="w-6 h-6 text-[#5C6B4A]" />
                                </div>
                                <div>
                                    <h1 className="font-serif text-2xl text-[#3D3D3D]">Nurturing Session</h1>
                                    <p className="text-sm text-[#8B8178]">A space for reflection and growth</p>
                                </div>
                            </motion.div>
                        </div>
                    </header>

                    {/* Reflections Area */}
                    <div className="flex-1 overflow-y-auto px-8 py-4">
                        <div className="max-w-3xl mx-auto space-y-8">
                            <AnimatePresence>
                                {reflections.map((reflection, idx) => (
                                    <motion.div
                                        key={reflection.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.6, delay: idx === 0 ? 0.3 : 0 }}
                                        className={reflection.type === "guidance" ? "" : "pl-12"}
                                    >
                                        {reflection.type === "guidance" ? (
                                            /* Guidance - Mentor's words */
                                            <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4] shadow-sm">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-[#5C6B4A]/10 flex-shrink-0 flex items-center justify-center">
                                                        <Leaf className="w-5 h-5 text-[#5C6B4A]" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-serif text-lg text-[#3D3D3D] leading-relaxed whitespace-pre-wrap">
                                                            {reflection.content}
                                                        </p>
                                                        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-[#E8DED4]">
                                                            <button className="flex items-center gap-2 text-sm text-[#8B8178] hover:text-[#5C6B4A] transition-colors duration-500">
                                                                <Volume2 className="w-4 h-4" />
                                                                <span>Listen to this guidance</span>
                                                            </button>
                                                            <span className="text-xs text-[#8B8178]/50">{reflection.timestamp}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Thought - User's words */
                                            <div className="py-4">
                                                <p className="text-[#3D3D3D]/80 leading-relaxed whitespace-pre-wrap">
                                                    {reflection.content}
                                                </p>
                                                <span className="text-xs text-[#8B8178]/50 mt-2 block">{reflection.timestamp}</span>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {isReflecting && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.5 }}
                                    className="bg-white/40 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                            <motion.div
                                                animate={{ scale: [1, 1.2, 1] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                            >
                                                <Leaf className="w-5 h-5 text-[#5C6B4A]" />
                                            </motion.div>
                                        </div>
                                        <span className="text-[#8B8178] font-serif italic">Reflecting on your thoughts...</span>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={bottomRef} />
                        </div>
                    </div>

                    {/* Journal Input Area */}
                    <div className="p-8 pt-4">
                        <div className="max-w-3xl mx-auto">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.5 }}
                                className="bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-[#E8DED4] shadow-sm"
                            >
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Share what's on your mind..."
                                    className="w-full bg-transparent border-none focus:ring-0 resize-none text-lg text-[#3D3D3D] placeholder:text-[#8B8178]/50 font-light leading-relaxed"
                                    rows={3}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit();
                                        }
                                    }}
                                />
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#E8DED4]">
                                    <p className="text-xs text-[#8B8178]/50">Press Enter to share, Shift+Enter for new line</p>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!input.trim() || isReflecting}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all duration-500 ${input.trim() && !isReflecting
                                            ? "bg-[#5C6B4A] text-[#FDF8F3] hover:bg-[#4A5A3A]"
                                            : "bg-[#E8DED4] text-[#8B8178]"
                                            }`}
                                    >
                                        <span className="text-sm font-medium">Share</span>
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
