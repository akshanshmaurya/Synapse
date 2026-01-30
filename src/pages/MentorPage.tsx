import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Volume2, Send, Home, MessageSquare, Map, User, LogOut, History, Plus, X, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { sendMessage, streamAudio, fetchChatSessions, fetchChatMessages, createChatSession, deleteChatSession, ChatSession, ChatMessage } from "@/services/api";
import Logo from "@/components/Logo";

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

    // Chat history state
    const [chatId, setChatId] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
        }
    }, [input]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [reflections, isReflecting]);

    // Load chat sessions when history panel opens
    useEffect(() => {
        if (showHistory) {
            loadChatSessions();
        }
    }, [showHistory]);

    const loadChatSessions = async () => {
        setLoadingHistory(true);
        const sessions = await fetchChatSessions(20, 0);
        setChatSessions(sessions);
        setLoadingHistory(false);
    };

    const handleSelectSession = async (session: ChatSession) => {
        setChatId(session._id);
        setShowHistory(false);

        // Load messages from this session
        const messages = await fetchChatMessages(session._id);
        const loadedReflections: Reflection[] = messages.map((msg: ChatMessage) => ({
            id: msg._id,
            type: msg.sender === "user" ? "thought" : "guidance",
            content: msg.content,
            timestamp: new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        }));

        if (loadedReflections.length > 0) {
            setReflections(loadedReflections);
        }
    };

    const handleNewChat = async () => {
        const newChatId = await createChatSession();
        if (newChatId) {
            setChatId(newChatId);
            setReflections([{
                id: "welcome",
                type: "guidance",
                content: "A fresh beginning. What would you like to explore today?",
                timestamp: "Just now"
            }]);
            setShowHistory(false);
        }
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        const success = await deleteChatSession(sessionId);
        if (success) {
            setChatSessions(prev => prev.filter(s => s._id !== sessionId));
            if (chatId === sessionId) {
                setChatId(null);
            }
        }
    };

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
            const result = await sendMessage(thought.content, chatId || undefined);

            // Track the chat_id from response
            if (result.chatId && !chatId) {
                setChatId(result.chatId);
            }

            const guidance: Reflection = {
                id: (Date.now() + 1).toString(),
                type: "guidance",
                content: result.response,
                timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
            };
            setReflections(prev => [...prev, guidance]);

            // Optional: play audio
            const audio = await streamAudio(result.response);
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
                        <Logo size="md" />
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

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-2xl text-[#8B8178] hover:bg-red-50 hover:text-red-500 transition-all duration-500"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="text-sm font-medium">Sign Out</span>
                    </button>
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
                                className="flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                        <Leaf className="w-6 h-6 text-[#5C6B4A]" />
                                    </div>
                                    <div>
                                        <h1 className="font-serif text-2xl text-[#3D3D3D]">Nurturing Session</h1>
                                        <p className="text-sm text-[#8B8178]">A space for reflection and growth</p>
                                    </div>
                                </div>

                                {/* History Button */}
                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-[#E8DED4] text-[#8B8178] hover:bg-[#5C6B4A] hover:text-white transition-all duration-300"
                                >
                                    <History className="w-4 h-4" />
                                    <span className="text-sm font-medium">History</span>
                                </button>
                            </motion.div>
                        </div>
                    </header>

                    {/* History Panel */}
                    <AnimatePresence>
                        {showHistory && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="px-8"
                            >
                                <div className="max-w-3xl mx-auto bg-white/80 backdrop-blur-sm rounded-2xl border border-[#E8DED4] p-4 mb-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-serif text-lg text-[#3D3D3D]">Conversation History</h3>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleNewChat}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#5C6B4A] text-white text-sm hover:bg-[#4A5A3A] transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                New Chat
                                            </button>
                                            <button
                                                onClick={() => setShowHistory(false)}
                                                className="p-1.5 rounded-full hover:bg-[#E8DED4] transition-colors"
                                            >
                                                <X className="w-4 h-4 text-[#8B8178]" />
                                            </button>
                                        </div>
                                    </div>

                                    {loadingHistory ? (
                                        <p className="text-sm text-[#8B8178] text-center py-4">Loading...</p>
                                    ) : chatSessions.length === 0 ? (
                                        <p className="text-sm text-[#8B8178] text-center py-4">No previous conversations</p>
                                    ) : (
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {chatSessions.map((session) => (
                                                <div
                                                    key={session._id}
                                                    onClick={() => handleSelectSession(session)}
                                                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${chatId === session._id
                                                            ? "bg-[#5C6B4A]/10 border border-[#5C6B4A]/30"
                                                            : "hover:bg-[#E8DED4]/50"
                                                        }`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm text-[#3D3D3D] truncate">{session.title}</p>
                                                        <p className="text-xs text-[#8B8178] truncate">{session.last_message_preview || "No messages"}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-2">
                                                        <span className="text-xs text-[#8B8178]">{session.message_count} msgs</span>
                                                        <button
                                                            onClick={(e) => handleDeleteSession(e, session._id)}
                                                            className="p-1 rounded hover:bg-red-100 text-[#8B8178] hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

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

