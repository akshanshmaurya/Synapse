import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Send, Home, MessageSquare, Map, User, BarChart3, LogOut, History, Plus, X, Trash2, Network, Brain } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { sendMessage as restSendMessage, streamAudio, fetchChatSessions, fetchChatMessages, deleteChatSession, ChatSession, ChatMessage } from "@/services/api";
import CognitiveTracePanel from "@/components/CognitiveTracePanel";
import { useSessionContext } from "@/hooks/useSessionContext";
import { useMentorSocket, WsConnectionState } from "@/hooks/use-mentor-socket";
import SessionGoalBanner from "@/components/chat/SessionGoalBanner";
import MomentumIndicator from "@/components/chat/MomentumIndicator";
import ActiveConceptsBar from "@/components/chat/ActiveConceptsBar";
import MessageBubble, { type Reflection } from "@/components/chat/MessageBubble";
import AIInsightsPanel from "@/components/chat/AIInsightsPanel";

/* ──────────────────────────────────────────────
   Animation Presets (Landing Page system)
   ────────────────────────────────────────────── */
const ease = [0.23, 1, 0.32, 1] as const;



export default function MentorPage() {
    const { user, logout } = useAuth();
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

    // AI Insights panel state (persisted in localStorage)
    const [insightsOpen, setInsightsOpen] = useState(() => {
        try {
            const saved = localStorage.getItem("synapse_insights_panel");
            // Default: open on desktop, closed on mobile
            if (saved !== null) return saved === "open";
            return window.innerWidth >= 768;
        } catch {
            return false;
        }
    });

    const toggleInsights = useCallback(() => {
        setInsightsOpen(prev => {
            const next = !prev;
            try { localStorage.setItem("synapse_insights_panel", next ? "open" : "closed"); } catch {}
            return next;
        });
    }, []);

    // Chat history state
    // Initialize chatId from sessionStorage — empty after login, preserved across navigation
    const [chatId, setChatId] = useState<string | null>(() => {
        try { return sessionStorage.getItem("synapse_active_chat_id"); } catch { return null; }
    });
    const [showHistory, setShowHistory] = useState(false);
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const chatCreationRequestRef = useRef(0);
    const hasRestoredSessionRef = useRef(false);

    // ── Persist chatId to sessionStorage on every change ──────────
    useEffect(() => {
        try {
            if (chatId) sessionStorage.setItem("synapse_active_chat_id", chatId);
            else sessionStorage.removeItem("synapse_active_chat_id");
        } catch {}
    }, [chatId]);

    // ── Restore messages on mount if returning to a persisted session
    useEffect(() => {
        if (hasRestoredSessionRef.current) return;
        hasRestoredSessionRef.current = true;
        if (!chatId) return; // No persisted session → stay on Welcome

        (async () => {
            try {
                const messages = await fetchChatMessages(chatId);
                if (messages.length > 0) {
                    setReflections(messages.map((msg: ChatMessage) => ({
                        id: msg._id,
                        type: msg.sender === "user" ? "thought" : "guidance",
                        content: msg.content,
                        timestamp: new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                    })));
                } else {
                    // Session exists but has 0 messages — stale, reset
                    setChatId(null);
                }
            } catch {
                // Session was deleted or invalid — reset to Welcome
                setChatId(null);
            }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── WebSocket streaming state ─────────────────────────────────
    const streamingContentRef = useRef("");
    const streamingBubbleIdRef = useRef<string | null>(null);
    const pendingUserMessageRef = useRef<string>("");

    // Session context (Phase 6.1)
    const {
        context: sessionContext,
        isLoading: sessionContextLoading,
        isLearningSession,
        isCasualSession,
        hasConfirmedGoal,
        hasInferredGoal,
        refreshContext: refreshSessionContext,
        saveGoal,
        clearGoal,
    } = useSessionContext(chatId);

    // ── WebSocket handlers (stable via refs in hook) ──────────────
    const handleWsTyping = useCallback(() => {
        // Typing indicator is already shown via isReflecting
    }, []);

    const handleWsToken = useCallback((token: string) => {
        // First token arrives — replace typing indicator with a streaming bubble
        if (!streamingBubbleIdRef.current) {
            const bubbleId = `ws-stream-${Date.now()}`;
            streamingBubbleIdRef.current = bubbleId;
            streamingContentRef.current = token;
            setIsReflecting(false);
            setReflections(prev => [...prev, {
                id: bubbleId,
                type: "guidance",
                content: token,
                timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            }]);
        } else {
            // Append subsequent tokens
            streamingContentRef.current += token;
            const currentContent = streamingContentRef.current;
            const currentId = streamingBubbleIdRef.current;
            setReflections(prev => prev.map(r =>
                r.id === currentId ? { ...r, content: currentContent } : r
            ));
        }
    }, []);

    const handleWsDone = useCallback((content: string, wsChatId: string) => {
        const currentId = streamingBubbleIdRef.current;
        // Finalize the streaming bubble with authoritative full text
        if (currentId) {
            setReflections(prev => prev.map(r =>
                r.id === currentId ? { ...r, content } : r
            ));
        } else {
            // Edge case: done arrived without any tokens (very fast response)
            setIsReflecting(false);
            setReflections(prev => [...prev, {
                id: `ws-done-${Date.now()}`,
                type: "guidance",
                content,
                timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            }]);
        }

        // Reset streaming state
        streamingBubbleIdRef.current = null;
        streamingContentRef.current = "";
        setIsReflecting(false);

        // Set chatId if this was a new conversation
        if (wsChatId && !chatId) {
            setChatId(wsChatId);
        }

        // TTS for the final response
        streamAudio(content).then(audio => {
            if (audio) audio.play().catch(() => {});
        });

        // Refresh session context in background
        refreshSessionContext().catch(() => {});
    }, [chatId, refreshSessionContext]);

    const handleWsError = useCallback((message: string) => {
        streamingBubbleIdRef.current = null;
        streamingContentRef.current = "";
        setIsReflecting(false);

        const errorId = `ws-err-${Date.now()}`;
        setReflections(prev => [...prev, {
            id: errorId,
            type: "error",
            content: message || "Connection error. Retrying...",
            timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        }]);
    }, []);

    // ── Wire up WebSocket ──────────────────────────────────────────
    const { connectionState: wsState, sendMessage: wsSendMessage } = useMentorSocket({
        sessionId: chatId ?? "new",
        onToken: handleWsToken,
        onDone: handleWsDone,
        onError: handleWsError,
        onTyping: handleWsTyping,
    });

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
        }
    }, [input]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [reflections, isReflecting]);

    useEffect(() => {
        if (showHistory) {
            loadChatSessions();
        }
    }, [showHistory]);

    const loadChatSessions = async () => {
        setLoadingHistory(true);
        setHistoryError(null);
        const sessions = await fetchChatSessions(20, 0);
        setChatSessions(sessions);
        setLoadingHistory(false);
    };

    // ── Local-only reset for "new chat pending" state ──────────────
    // No database write happens here. A session is only created when
    // the user actually sends their first message (lazy init).
    const resetToNewChat = useCallback(() => {
        setChatId(null);
        setReflections([{
            id: "welcome",
            type: "guidance",
            content: "Welcome to this quiet space. I've been reflecting on your journey — the seeds you've planted, the growth you've nurtured.\n\nWhat's stirring in your mind today? There's no rush to answer. Take your time.",
            timestamp: "Just now"
        }]);
        streamingBubbleIdRef.current = null;
        streamingContentRef.current = "";
        setInput("");
        setIsReflecting(false);
        setShowHistory(false);
        setHistoryError(null);
    }, []);

    const handleSelectSession = async (session: ChatSession) => {
        chatCreationRequestRef.current += 1;
        setHistoryError(null);
        setChatId(session._id);
        setShowHistory(false);
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

    const handleNewChat = () => {
        resetToNewChat();
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        setHistoryError(null);
        const result = await deleteChatSession(sessionId);
        if (result.success) {
            setChatSessions(prev => prev.filter(s => s._id !== sessionId));
            if (chatId === sessionId) {
                resetToNewChat();
            }
            return;
        }
        setHistoryError(result.error || "Unable to delete that chat.");
    };

    // ── Submit: WS primary, REST silent fallback ──────────────────
    const handleSubmit = async () => {
        if (!input.trim()) return;
        const userText = input.trim();
        setHistoryError(null);
        const thought: Reflection = {
            id: Date.now().toString(),
            type: "thought",
            content: userText,
            timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        };
        setReflections(prev => [...prev, thought]);
        setInput("");
        setIsReflecting(true);

        // Reset streaming state for this new message
        streamingBubbleIdRef.current = null;
        streamingContentRef.current = "";

        // ── Try WebSocket first (primary transport) ─────────────────
        // The hook connects to "new" when chatId is null — the backend
        // creates a session atomically and returns the real chat_id in
        // the "done" message, so streaming works from the first message.
        if (wsSendMessage(userText)) {
            pendingUserMessageRef.current = userText;
            return;
        }

        // ── REST fallback (WS not connected) ──────────────────────
        // When chatId is null, sendMessage() omits chat_id from the
        // request body — the backend creates a session automatically.
        try {
            const result = await restSendMessage(userText, chatId || undefined);
            if (result.chatId && !chatId) {
                setChatId(result.chatId);
            }
            const guidance: Reflection = {
                id: (Date.now() + 1).toString(),
                type: "guidance",
                content: result.response,
                timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
                evaluation: result.evaluation
            };
            setReflections(prev => [...prev, guidance]);
            const audio = await streamAudio(result.response);
            if (audio) {
                audio.play().catch(() => {});
            }
            refreshSessionContext().catch(() => {});
        } catch (error) {
            console.error("Session error", error);
            const errorId = (Date.now() + 1).toString();
            const errorGuidance: Reflection = {
                id: errorId,
                type: "error",
                content: "Failed to send message.",
                timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
                onRetry: () => {
                    setReflections(prev => prev.filter(r => r.id !== errorId));
                    setInput(userText);
                    // Re-trigger on next tick so input state settles
                    setTimeout(() => handleSubmit(), 0);
                }
            };
            setReflections(prev => [...prev, errorGuidance]);
        } finally {
            setIsReflecting(false);
        }
    };

    const handleLogout = () => {
        try { sessionStorage.removeItem("synapse_active_chat_id"); } catch {}
        logout();
        navigate("/");
    };

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard" },
        { icon: MessageSquare, label: "Session", path: "/mentor", active: true },
        { icon: Map, label: "Pathways", path: "/roadmap" },
        { icon: Network, label: "Concepts", path: "/concept-map" },
        { icon: BarChart3, label: "Analytics", path: "/analytics" },
        { icon: User, label: "Roots", path: "/profile" },
    ];

    return (
        <div className="min-h-screen bg-[#FDF8F3] relative overflow-hidden">
            {/* Grain Texture */}
            <div className="grain-overlay" />

            {/* Ambient Glows */}
            <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="absolute -top-40 right-10 w-[600px] h-[600px] rounded-full bg-[#5C6B4A]/5 blur-[140px]" />
                <div className="absolute bottom-10 -left-20 w-[400px] h-[400px] rounded-full bg-[#D4A574]/8 blur-[110px]" />
            </div>

            <div className="flex min-h-screen relative z-10">

                {/* ═══ SIDEBAR ═══ */}
                <aside className="w-72 flex-col fixed h-screen hidden md:flex bg-white/40 backdrop-blur-xl border-r border-[#E8DED4]/60 z-30">
                    <div className="p-8 pb-0">
                        <Link to="/" className="block mb-1">
                            <span
                                className="text-[#5C6B4A] font-extrabold text-xl tracking-tight uppercase"
                                style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}
                            >
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
                                <span className={`mono-tag text-[8px] ${item.active ? "text-white/30" : "text-[#8B8178]/30"}`}>
                                    0{i + 1}
                                </span>
                                <item.icon className="w-[18px] h-[18px]" />
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.active && (
                                    <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white/60" />
                                )}
                            </Link>
                        ))}
                    </nav>

                    <div className="p-4 space-y-2 mt-auto">
                        {user && (
                            <div className="px-5 py-4 rounded-2xl bg-[#5C6B4A]/5 border border-[#5C6B4A]/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-[#5C6B4A] flex items-center justify-center text-white text-sm font-bold">
                                        {(user.name || user.email)?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-sm text-[#3D3D3D] font-medium block truncate">{user.name || user.email}</span>
                                        <span className="mono-tag text-[7px] text-[#8B8178]/50">Learner</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-5 py-3 rounded-2xl text-[#8B8178] hover:bg-red-50/80 hover:text-red-500 transition-all duration-500 w-full"
                        >
                            <LogOut className="w-[18px] h-[18px]" />
                            <span className="text-sm font-medium">Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* ═══ MAIN CHAT AREA ═══ */}
                <main className="flex-1 ml-0 md:ml-72 flex flex-col h-screen">

                    {/* ──── Top Bar ──── */}
                    <motion.header
                        initial={{ opacity: 0, y: -15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease }}
                        className="px-6 md:px-10 py-5 flex items-center justify-between border-b border-[#E8DED4]/50 bg-white/30 backdrop-blur-xl sticky top-0 z-20"
                    >
                        <div className="flex items-center gap-4">
                            {/* Mentor avatar */}
                            <div className="relative">
                                <div className="w-11 h-11 rounded-full bg-[#5C6B4A] flex items-center justify-center shadow-[0_4px_15px_rgba(92,107,74,0.2)]">
                                    <Leaf className="w-5 h-5 text-white" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#FDF8F3] shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                            </div>
                            <div>
                                <h1
                                    className="text-lg font-bold text-[#3D3D3D] tracking-tight"
                                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}
                                >
                                    Nurturing Session
                                </h1>
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-700 ${
                                        wsState === WsConnectionState.OPEN
                                            ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                                            : wsState === WsConnectionState.RECONNECTING || wsState === WsConnectionState.CONNECTING
                                            ? "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)] animate-pulse"
                                            : "bg-gray-400 shadow-[0_0_6px_rgba(156,163,175,0.3)]"
                                    }`} />
                                    <span className="mono-tag text-[8px] text-[#8B8178]/50">
                                        {wsState === WsConnectionState.OPEN ? "// Live · AI Mentor"
                                         : wsState === WsConnectionState.RECONNECTING ? "// Reconnecting..."
                                         : wsState === WsConnectionState.CONNECTING ? "// Connecting..."
                                         : "// Standby"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleNewChat}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-[#5C6B4A] bg-[#5C6B4A]/8 hover:bg-[#5C6B4A]/15 border border-[#5C6B4A]/15 transition-all duration-500 text-sm font-medium"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">New</span>
                            </button>
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-500 text-sm font-medium border ${
                                    showHistory
                                        ? "bg-[#5C6B4A] text-white border-[#5C6B4A] shadow-[0_8px_20px_rgba(92,107,74,0.2)]"
                                        : "text-[#8B8178] bg-white/50 border-[#E8DED4] hover:border-[#5C6B4A]/30 hover:text-[#5C6B4A]"
                                }`}
                            >
                                <History className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">History</span>
                            </button>
                            <button
                                onClick={toggleInsights}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-500 text-sm font-medium border ${
                                    insightsOpen
                                        ? "bg-[#5C6B4A] text-white border-[#5C6B4A] shadow-[0_8px_20px_rgba(92,107,74,0.2)]"
                                        : "text-[#8B8178] bg-white/50 border-[#E8DED4] hover:border-[#5C6B4A]/30 hover:text-[#5C6B4A]"
                                }`}
                            >
                                <Brain className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Insights</span>
                            </button>
                        </div>
                    </motion.header>

                    {/* ──── History Panel (Slide down) ──── */}
                    <AnimatePresence>
                        {showHistory && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.4, ease }}
                                className="overflow-hidden border-b border-[#E8DED4]/50 bg-white/50 backdrop-blur-xl"
                            >
                                <div className="max-w-3xl mx-auto px-6 md:px-10 py-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="mono-tag text-[9px] text-[#8B8178]">Conversation History</span>
                                        <button
                                            onClick={() => setShowHistory(false)}
                                            className="p-1.5 rounded-full hover:bg-[#E8DED4]/50 text-[#8B8178] transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {historyError ? (
                                        <div className="py-4 px-4 rounded-2xl border border-red-200 bg-red-50/70 text-sm text-red-600">
                                            {historyError}
                                        </div>
                                    ) : loadingHistory ? (
                                        <div className="flex items-center gap-3 py-6 justify-center">
                                            <span className="w-4 h-4 border-2 border-[#5C6B4A]/20 border-t-[#5C6B4A] rounded-full animate-spin" />
                                            <span className="text-sm text-[#8B8178]">Loading...</span>
                                        </div>
                                    ) : chatSessions.length === 0 ? (
                                        <div className="py-8 flex flex-col items-center justify-center opacity-60">
                                            <MessageSquare className="w-5 h-5 text-[#8B8178] mb-2" />
                                            <p className="text-sm text-[#8B8178] text-center">No previous conversations yet.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                                            {chatSessions.map((session) => (
                                                <div
                                                    key={session._id}
                                                    onClick={() => handleSelectSession(session)}
                                                    className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all duration-500 ${
                                                        chatId === session._id
                                                            ? "bg-[#5C6B4A]/8 border border-[#5C6B4A]/20"
                                                            : "hover:bg-[#E8DED4]/30 border border-transparent"
                                                    }`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm text-[#3D3D3D] truncate">{session.title}</p>
                                                        <p className="text-xs text-[#8B8178]/60 truncate">{session.last_message_preview || "No messages"}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-3 shrink-0">
                                                        <span className="mono-tag text-[8px] text-[#8B8178]/40">{session.message_count}</span>
                                                        <button
                                                            onClick={(e) => handleDeleteSession(e, session._id)}
                                                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[#8B8178] hover:text-red-500 transition-all"
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

                    {/* ──── Session Context UI (Phase 6.1) ──── */}
                    <div className="max-w-3xl mx-auto px-6 md:px-10 pt-3 space-y-1.5">
                        {sessionContextLoading && !sessionContext && (
                            <div className="h-8 animate-pulse bg-white/10 rounded-lg" />
                        )}
                        {chatId && sessionContext && (
                            <>
                                <SessionGoalBanner
                                    chatId={chatId}
                                    context={sessionContext}
                                    onGoalSaved={() => {}}
                                    onGoalEditing={() => {}}
                                    saveGoal={saveGoal}
                                    clearGoal={clearGoal}
                                    hasConfirmedGoal={hasConfirmedGoal}
                                    hasInferredGoal={hasInferredGoal}
                                    isCasualSession={isCasualSession}
                                    isLearningSession={isLearningSession}
                                />
                                <div className="flex items-center gap-2 flex-wrap">
                                    <MomentumIndicator
                                        momentum={sessionContext.session_momentum ?? null}
                                        sessionIntent={sessionContext.session_intent ?? null}
                                        messageCount={sessionContext.message_count ?? 0}
                                    />
                                    <ActiveConceptsBar
                                        activeConcepts={sessionContext.active_concepts ?? []}
                                        sessionIntent={sessionContext.session_intent ?? null}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* ──── Chat / Reflections Area ──── */}
                    <div className="flex-1 overflow-y-auto px-6 md:px-10 py-8">
                        <div className="max-w-3xl mx-auto space-y-6">
                            <AnimatePresence>
                                {reflections.map((reflection, idx) => (
                                    <MessageBubble
                                        key={reflection.id}
                                        reflection={reflection}
                                        animationDelay={idx === 0 ? 0.3 : 0}
                                        ease={[...ease]}
                                    />
                                ))}
                            </AnimatePresence>

                            {/* Thinking indicator */}
                            {isReflecting && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, ease }}
                                    className="flex items-start gap-4"
                                >
                                    <div className="w-9 h-9 rounded-full bg-[#5C6B4A] flex items-center justify-center shrink-0 mt-1 shadow-[0_4px_12px_rgba(92,107,74,0.15)]">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                        >
                                            <Leaf className="w-4 h-4 text-white" />
                                        </motion.div>
                                    </div>
                                    <div className="bg-white/50 backdrop-blur-[20px] rounded-[1.5rem] rounded-tl-lg px-6 py-5 border border-white/60 shadow-[inset_0_0_20px_rgba(255,255,255,0.4)]">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-1.5">
                                                {[0, 0.2, 0.4].map((delay) => (
                                                    <motion.div
                                                        key={delay}
                                                        className="w-2 h-2 rounded-full bg-[#5C6B4A]/40"
                                                        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                                                        transition={{ duration: 1, repeat: Infinity, delay }}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-sm text-[#8B8178]/50 ml-2 italic">Reflecting...</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={bottomRef} />
                        </div>
                    </div>

                    {/* ──── Input Area ──── */}
                    <div className="px-6 md:px-10 py-5 border-t border-[#E8DED4]/50 bg-white/30 backdrop-blur-xl">
                        <div className="max-w-3xl mx-auto">
                            <motion.div
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.4, ease }}
                                className="relative bg-white/60 backdrop-blur-[30px] rounded-2xl border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_10px_30px_-5px_rgba(0,0,0,0.04)] transition-shadow duration-500 focus-within:shadow-[inset_0_0_40px_rgba(255,255,255,0.8),0_15px_40px_-10px_rgba(92,107,74,0.1)]"
                            >
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Share what's on your mind..."
                                    className="w-full bg-transparent px-6 pt-5 pb-2 focus:outline-none resize-none text-[15px] text-[#3D3D3D] placeholder:text-[#8B8178]/35 leading-relaxed"
                                    style={{ fontFamily: "'Inter', sans-serif" }}
                                    rows={2}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit();
                                        }
                                    }}
                                />
                                <div className="flex items-center justify-between px-5 pb-4">
                                    <span className="mono-tag text-[8px] text-[#8B8178]/25">
                                        Enter to send · Shift+Enter for new line
                                    </span>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!input.trim() || isReflecting}
                                        className={`group flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-500 ${
                                            input.trim() && !isReflecting
                                                ? "bg-[#5C6B4A] text-white hover:bg-[#4A5A3A] hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(92,107,74,0.2)]"
                                                : "bg-[#E8DED4]/50 text-[#8B8178]/40 cursor-not-allowed"
                                        }`}
                                    >
                                        <span className="text-sm font-semibold">Share</span>
                                        <Send className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </main>

                {/* ═══ AI INSIGHTS PANEL ═══ */}
                <AIInsightsPanel
                    isOpen={insightsOpen}
                    onClose={toggleInsights}
                    sessionContext={sessionContext}
                    sessionContextLoading={sessionContextLoading}
                    reflections={reflections}
                />
            </div>

            {/* Cognitive Trace Panel */}
            <CognitiveTracePanel sessionId={chatId} />

            {/* ═══ MOBILE BOTTOM NAV ═══ */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-2xl border-t border-[#E8DED4]/50 px-2 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <div className="flex justify-around">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 ${
                                item.active ? "text-[#5C6B4A]" : "text-[#8B8178]/50"
                            }`}
                        >
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
