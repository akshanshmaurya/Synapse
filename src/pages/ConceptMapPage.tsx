import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
    Home, MessageSquare, Map as MapIcon, User, BarChart3, LogOut,
    Network, X, ArrowRight, AlertTriangle, Lightbulb,
    Zap, BookOpen, ChevronRight, RefreshCw, Layers
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
    fetchConceptMap, fetchRecommendations,
    type ConceptMapNode, type ConceptMapEdge, type ZPDRecommendation,
} from "@/services/api";

/* ──────────────────────────────────────────────
   Animation Presets
   ────────────────────────────────────────────── */
const ease = [0.23, 1, 0.32, 1] as const;

/* ──────────────────────────────────────────────
   Color helpers
   ────────────────────────────────────────────── */
const MASTERY_COLORS = {
    novice:     { fill: "#EF4444", bg: "rgba(239,68,68,0.12)", ring: "rgba(239,68,68,0.25)", text: "#DC2626" },
    developing: { fill: "#F59E0B", bg: "rgba(245,158,11,0.12)", ring: "rgba(245,158,11,0.25)", text: "#D97706" },
    proficient: { fill: "#3B82F6", bg: "rgba(59,130,246,0.12)", ring: "rgba(59,130,246,0.25)", text: "#2563EB" },
    mastered:   { fill: "#5C6B4A", bg: "rgba(92,107,74,0.12)",  ring: "rgba(92,107,74,0.25)",  text: "#5C6B4A" },
};

const DOMAIN_COLORS: Record<string, string> = {
    dsa: "#5C6B4A",
    python: "#3B82F6",
    web: "#F59E0B",
    ml: "#8B5CF6",
    system_design: "#EC4899",
    professional_skills: "#D97706",
    career: "#D4A574",
};

const DOMAIN_LABELS: Record<string, string> = {
    dsa: "DSA",
    python: "Python",
    web: "Web Dev",
    ml: "ML / AI",
    system_design: "System Design",
    professional_skills: "Professional Skills",
    career: "Career",
    unknown: "General",
};

/* ──────────────────────────────────────────────
   Simple force simulation
   ────────────────────────────────────────────── */
interface SimNode extends ConceptMapNode {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
}

function runForceSimulation(
    nodes: SimNode[],
    edges: ConceptMapEdge[],
    width: number,
    height: number,
    iterations: number = 120,
): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const edgeMap: Record<string, string[]> = {};
    edges.forEach(e => {
        if (!edgeMap[e.from]) edgeMap[e.from] = [];
        edgeMap[e.from].push(e.to);
    });

    for (let iter = 0; iter < iterations; iter++) {
        const alpha = 1 - iter / iterations;
        const strength = 0.3 * alpha;

        // Center gravity
        for (const n of nodes) {
            n.vx += (centerX - n.x) * 0.01 * alpha;
            n.vy += (centerY - n.y) * 0.01 * alpha;
        }

        // Node repulsion
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const a = nodes[i], b = nodes[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const minDist = a.radius + b.radius + 45;
                if (dist < minDist) {
                    const force = (minDist - dist) * strength * 0.5;
                    dx /= dist; dy /= dist;
                    a.vx -= dx * force;
                    a.vy -= dy * force;
                    b.vx += dx * force;
                    b.vy += dy * force;
                }
            }
        }

        // Edge attraction
        const simNodeMap: Record<string, SimNode> = {};
        nodes.forEach(n => { simNodeMap[n.concept_id] = n; });
        for (const edge of edges) {
            const a = simNodeMap[edge.from];
            const b = simNodeMap[edge.to];
            if (!a || !b) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const idealDist = 140;
            const force = (dist - idealDist) * strength * 0.05;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx += fx; a.vy += fy;
            b.vx -= fx; b.vy -= fy;
        }

        // Apply velocity with damping
        for (const n of nodes) {
            n.vx *= 0.85;
            n.vy *= 0.85;
            n.x += n.vx;
            n.y += n.vy;
            // Keep within bounds
            n.x = Math.max(n.radius + 30, Math.min(width - n.radius - 30, n.x));
            n.y = Math.max(n.radius + 30, Math.min(height - n.radius - 30, n.y));
        }
    }
}

/* ──────────────────────────────────────────────
   Mastery Sparkline
   ────────────────────────────────────────────── */
function MasterySparkline({ history, color }: { history: { date: string; score: number }[]; color: string }) {
    if (history.length < 2) return null;
    const w = 120, h = 32;
    const maxScore = Math.max(...history.map(p => p.score), 0.01);

    const pathPoints = history.map((pt, i) => {
        const x = (i / (history.length - 1)) * w;
        const y = h - (pt.score / maxScore) * (h - 4) - 2;
        return `${x},${y}`;
    });

    return (
        <svg width={w} height={h} className="overflow-visible">
            <polyline
                points={pathPoints.join(" ")}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Last point dot */}
            {(() => {
                const last = history[history.length - 1];
                const x = w;
                const y = h - (last.score / maxScore) * (h - 4) - 2;
                return <circle cx={x} cy={y} r="2.5" fill={color} />;
            })()}
        </svg>
    );
}


/* ══════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ══════════════════════════════════════════════ */
export default function ConceptMapPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [nodes, setNodes] = useState<ConceptMapNode[]>([]);
    const [edges, setEdges] = useState<ConceptMapEdge[]>([]);
    const [recommendations, setRecommendations] = useState<ZPDRecommendation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<ConceptMapNode | null>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<string>("all");

    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const navItems = [
        { icon: Home, label: "Garden", path: "/dashboard" },
        { icon: MessageSquare, label: "Session", path: "/mentor" },
        { icon: MapIcon, label: "Pathways", path: "/roadmap" },
        { icon: Network, label: "Concepts", path: "/concept-map", active: true },
        { icon: BarChart3, label: "Analytics", path: "/analytics" },
        { icon: User, label: "Roots", path: "/profile" },
    ];

    // Fetch data
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [mapData, recs] = await Promise.all([
                fetchConceptMap(),
                fetchRecommendations(),
            ]);
            if (!mapData) throw new Error("No data");
            setNodes(mapData.nodes);
            setEdges(mapData.edges);
            setRecommendations(recs);
        } catch {
            setError("Unable to load your concept map.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Derive domains for filter tabs
    const domains = useMemo(() => {
        const domainSet = new Set(nodes.map(n => n.domain));
        return ["all", ...Array.from(domainSet).sort()];
    }, [nodes]);

    // Filtered nodes
    const filteredNodes = useMemo(() =>
        activeFilter === "all" ? nodes : nodes.filter(n => n.domain === activeFilter),
    [nodes, activeFilter]);

    const filteredEdges = useMemo(() => {
        const nodeIds = new Set(filteredNodes.map(n => n.concept_id));
        return edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
    }, [edges, filteredNodes]);

    // Compute simulation positions
    const simNodes: SimNode[] = useMemo(() => {
        if (filteredNodes.length === 0) return [];
        const w = 800, h = 500;

        const sNodes: SimNode[] = filteredNodes.map((n, i) => ({
            ...n,
            x: w / 2 + (Math.random() - 0.5) * 400,
            y: h / 2 + (Math.random() - 0.5) * 300,
            vx: 0,
            vy: 0,
            radius: Math.max(18, Math.min(35, 15 + n.exposure_count * 3)),
        }));

        runForceSimulation(sNodes, filteredEdges, w, h);
        return sNodes;
    }, [filteredNodes, filteredEdges]);

    const nodeMap = useMemo(() => {
        const m = new Map<string, SimNode>();
        simNodes.forEach(n => m.set(n.concept_id, n));
        return m;
    }, [simNodes]);

    // Get dependents for a concept
    const getDependents = useCallback((conceptId: string) => {
        return edges
            .filter(e => e.from === conceptId)
            .map(e => nodes.find(n => n.concept_id === e.to))
            .filter(Boolean) as ConceptMapNode[];
    }, [edges, nodes]);

    // Get prerequisites for a concept
    const getPrerequisites = useCallback((conceptId: string) => {
        return edges
            .filter(e => e.to === conceptId)
            .map(e => nodes.find(n => n.concept_id === e.from))
            .filter(Boolean) as ConceptMapNode[];
    }, [edges, nodes]);

    // Stats
    const stats = useMemo(() => {
        if (nodes.length === 0) return null;
        const avgMastery = nodes.reduce((s, n) => s + n.mastery_level, 0) / nodes.length;
        const mastered = nodes.filter(n => n.status === "mastered").length;
        const novice = nodes.filter(n => n.status === "novice").length;
        return { total: nodes.length, avgMastery, mastered, novice };
    }, [nodes]);

    return (
        <div className="min-h-screen bg-[#FDF8F3] relative overflow-hidden">
            <div className="grain-overlay" />

            {/* Ambient Glows */}
            <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
                <div className="absolute -top-40 right-20 w-[600px] h-[600px] rounded-full bg-[#5C6B4A]/6 blur-[140px]" />
                <div className="absolute bottom-20 -left-32 w-[500px] h-[500px] rounded-full bg-[#D4A574]/8 blur-[120px]" />
                <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] rounded-full bg-[#E8DED4]/25 blur-[90px]" />
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
                                <span className={`mono-tag text-[8px] ${item.active ? "text-white/30" : "text-[#8B8178]/30"}`}>
                                    0{i + 1}
                                </span>
                                <item.icon className="w-[18px] h-[18px]" />
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.active && (
                                    <motion.div layoutId="nav-indicator" className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white/60" />
                                )}
                            </Link>
                        ))}
                    </nav>

                    {/* Bottom: User Card */}
                    <div className="p-4 space-y-2 mt-auto">
                        {user && (
                            <div className="px-5 py-4 rounded-2xl bg-[#5C6B4A]/5 border border-[#5C6B4A]/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-[#5C6B4A] flex items-center justify-center text-white text-sm font-bold">
                                        {(user.name || user.email)?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-sm text-[#3D3D3D] font-medium block truncate">
                                            {user.name || user.email}
                                        </span>
                                        <span className="mono-tag text-[7px] text-[#8B8178]/50">Learner</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <button
                            onClick={() => { logout(); navigate("/"); }}
                            className="flex items-center gap-3 px-5 py-3 rounded-2xl text-[#8B8178] hover:bg-red-50/80 hover:text-red-500 transition-all duration-500 w-full"
                        >
                            <LogOut className="w-[18px] h-[18px]" />
                            <span className="text-sm font-medium">Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* ═══ MAIN CONTENT ═══ */}
                <main className="flex-1 ml-0 md:ml-72 pb-24 md:pb-0">
                    <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-14 py-10 md:py-14 space-y-8">

                        {/* ──── HEADER ──── */}
                        <motion.header
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.9, ease }}
                            className="flex flex-col md:flex-row md:items-end md:justify-between gap-6"
                        >
                            <div>
                                <span className="mono-tag text-[10px] text-[#8B8178] mb-3 block">
                                    // Concept Map
                                </span>
                                <h1
                                    className="text-[clamp(2.5rem,5vw,4rem)] font-black leading-[0.9] tracking-tight text-[#5C6B4A] uppercase"
                                    style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "-0.04em" }}
                                >
                                    Knowledge<br />Map.
                                </h1>
                            </div>

                            {stats && (
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/60 backdrop-blur-sm border border-[#E8DED4]/60">
                                        <Layers className="w-3.5 h-3.5 text-[#5C6B4A]" />
                                        <span className="text-[13px] text-[#8B8178]">{stats.total} concepts</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/60 backdrop-blur-sm border border-[#E8DED4]/60">
                                        <Zap className="w-3.5 h-3.5 text-[#D4A574]" />
                                        <span className="text-[13px] text-[#8B8178]">{Math.round(stats.avgMastery * 100)}% avg mastery</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#5C6B4A]/8 border border-[#5C6B4A]/15">
                                        <span className="text-[13px] font-semibold text-[#5C6B4A]">{stats.mastered} mastered</span>
                                    </div>
                                </div>
                            )}
                        </motion.header>

                        {/* Loading / Error / Empty states */}
                        {isLoading ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-40 gap-4">
                                <div className="w-14 h-14 rounded-full bg-[#5C6B4A] flex items-center justify-center shadow-[0_10px_30px_rgba(92,107,74,0.2)]">
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                </div>
                                <span className="mono-tag text-[10px] text-[#8B8178]">Mapping your knowledge...</span>
                            </motion.div>
                        ) : error ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 gap-5 text-center px-4">
                                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-[#3D3D3D] font-bold text-lg">{error}</h3>
                                    <p className="text-[#8B8178] text-sm mt-1">Connection lost.</p>
                                </div>
                                <button onClick={loadData} className="mt-2 px-6 py-2.5 rounded-full bg-[#5C6B4A] text-white text-sm font-semibold hover:bg-[#4A5A3A] transition-colors shadow-md flex items-center gap-2">
                                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                                </button>
                            </motion.div>
                        ) : nodes.length === 0 ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-32 gap-5 text-center px-4 bg-white/40 backdrop-blur-md rounded-3xl border border-[#E8DED4] shadow-sm">
                                <div className="w-16 h-16 rounded-full bg-[#5C6B4A]/10 flex items-center justify-center">
                                    <Network className="w-6 h-6 text-[#5C6B4A]" />
                                </div>
                                <div>
                                    <h3 className="text-[#3D3D3D] font-bold text-lg">Your concept map is empty.</h3>
                                    <p className="text-[#8B8178] text-sm mt-1 max-w-sm">Start chatting with your mentor to build your knowledge map. Each concept you discuss will appear here.</p>
                                </div>
                                <button onClick={() => navigate("/mentor")} className="mt-3 px-6 py-2.5 rounded-full bg-[#5C6B4A] text-white text-sm font-semibold hover:bg-[#4A5A3A] transition-colors shadow-md flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" /> Start Session
                                </button>
                            </motion.div>
                        ) : (
                            <>
                                {/* ──── DOMAIN FILTER TABS ──── */}
                                <motion.div
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.6, delay: 0.1, ease }}
                                    className="flex items-center gap-2 flex-wrap"
                                >
                                    {domains.map(d => (
                                        <button
                                            key={d}
                                            onClick={() => setActiveFilter(d)}
                                            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                                                activeFilter === d
                                                    ? "bg-[#5C6B4A] text-white shadow-[0_4px_15px_rgba(92,107,74,0.2)]"
                                                    : "bg-white/50 text-[#8B8178] border border-[#E8DED4] hover:border-[#5C6B4A]/30 hover:text-[#5C6B4A]"
                                            }`}
                                        >
                                            {d === "all" ? "All Domains" : DOMAIN_LABELS[d] || d}
                                        </button>
                                    ))}
                                </motion.div>

                                {/* ──── GRAPH VISUALIZATION ──── */}
                                <motion.section
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.9, delay: 0.2, ease }}
                                    className="relative rounded-[2.5rem] overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]"
                                    ref={containerRef}
                                >
                                    {/* Legend */}
                                    <div className="absolute top-5 left-6 z-20 flex items-center gap-3">
                                        {(["novice", "developing", "proficient", "mastered"] as const).map(status => (
                                            <div key={status} className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MASTERY_COLORS[status].fill }} />
                                                <span className="mono-tag text-[7px] text-[#8B8178]/60 capitalize">{status}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* SVG Graph — Desktop */}
                                    <div className="hidden md:block">
                                        <svg
                                            ref={svgRef}
                                            viewBox="0 0 800 500"
                                            className="w-full"
                                            style={{ minHeight: "420px" }}
                                        >
                                            {/* Background grid */}
                                            <defs>
                                                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(232,222,212,0.25)" strokeWidth="0.5" />
                                                </pattern>
                                            </defs>
                                            <rect width="800" height="500" fill="url(#grid)" />

                                            {/* Edges */}
                                            {filteredEdges.map((edge, idx) => {
                                                const from = nodeMap.get(edge.from);
                                                const to = nodeMap.get(edge.to);
                                                if (!from || !to) return null;
                                                const isHighlighted = hoveredNode === edge.from || hoveredNode === edge.to;
                                                return (
                                                    <line
                                                        key={`edge-${idx}`}
                                                        x1={from.x} y1={from.y}
                                                        x2={to.x} y2={to.y}
                                                        stroke={isHighlighted ? "#5C6B4A" : "rgba(139,129,120,0.15)"}
                                                        strokeWidth={isHighlighted ? 2 : 1}
                                                        strokeDasharray={isHighlighted ? "none" : "4 4"}
                                                    />
                                                );
                                            })}

                                            {/* Edge arrows */}
                                            <defs>
                                                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                                    <polygon points="0 0, 6 2, 0 4" fill="rgba(139,129,120,0.3)" />
                                                </marker>
                                            </defs>

                                            {/* Nodes */}
                                            {simNodes.map(node => {
                                                const colors = MASTERY_COLORS[node.status];
                                                const isHovered = hoveredNode === node.concept_id;
                                                const isSelected = selectedNode?.concept_id === node.concept_id;

                                                return (
                                                    <g
                                                        key={node.concept_id}
                                                        transform={`translate(${node.x}, ${node.y})`}
                                                        className="cursor-pointer"
                                                        onMouseEnter={() => setHoveredNode(node.concept_id)}
                                                        onMouseLeave={() => setHoveredNode(null)}
                                                        onClick={() => setSelectedNode(node)}
                                                    >
                                                        {/* Glow ring */}
                                                        {(isHovered || isSelected) && (
                                                            <circle r={node.radius + 6} fill="none" stroke={colors.ring} strokeWidth="2" opacity="0.6" />
                                                        )}

                                                        {/* Main circle */}
                                                        <circle
                                                            r={node.radius}
                                                            fill={colors.bg}
                                                            stroke={colors.fill}
                                                            strokeWidth={isHovered || isSelected ? 2.5 : 1.5}
                                                        />

                                                        {/* Mastery percentage */}
                                                        <text
                                                            textAnchor="middle"
                                                            dy="0.35em"
                                                            fontSize="10"
                                                            fontWeight="700"
                                                            fontFamily="'Inter', sans-serif"
                                                            fill={colors.text}
                                                        >
                                                            {Math.round(node.mastery_level * 100)}%
                                                        </text>

                                                        {/* Label below */}
                                                        <text
                                                            textAnchor="middle"
                                                            y={node.radius + 14}
                                                            fontSize="9"
                                                            fontWeight="500"
                                                            fontFamily="'Inter', sans-serif"
                                                            fill="#3D3D3D"
                                                        >
                                                            {node.concept_name.length > 14
                                                                ? node.concept_name.slice(0, 12) + "…"
                                                                : node.concept_name}
                                                        </text>

                                                        {/* Hover tooltip */}
                                                        {isHovered && !isSelected && (
                                                            <foreignObject x={node.radius + 10} y={-40} width="180" height="90">
                                                                <div className="p-2.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#E8DED4] shadow-lg text-[10px]">
                                                                    <p className="font-semibold text-[#3D3D3D] mb-0.5">{node.concept_name}</p>
                                                                    <p className="text-[#8B8178]">Mastery: {Math.round(node.mastery_level * 100)}%</p>
                                                                    <p className="text-[#8B8178]">Seen: {node.exposure_count}x</p>
                                                                    {node.last_seen && (
                                                                        <p className="text-[#8B8178]/60">Last: {new Date(node.last_seen).toLocaleDateString()}</p>
                                                                    )}
                                                                    {node.misconceptions.length > 0 && (
                                                                        <p className="text-amber-600 mt-0.5">⚠ {node.misconceptions.length} misconception{node.misconceptions.length > 1 ? "s" : ""}</p>
                                                                    )}
                                                                </div>
                                                            </foreignObject>
                                                        )}
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    </div>

                                    {/* Mobile: Sortable list view */}
                                    <div className="md:hidden p-5 space-y-2">
                                        <p className="mono-tag text-[9px] text-[#8B8178] mb-3">{filteredNodes.length} concepts</p>
                                        {filteredNodes
                                            .sort((a, b) => b.mastery_level - a.mastery_level)
                                            .map(node => {
                                                const colors = MASTERY_COLORS[node.status];
                                                return (
                                                    <button
                                                        key={node.concept_id}
                                                        onClick={() => setSelectedNode(node)}
                                                        className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/60 border border-[#E8DED4]/50 hover:border-[#5C6B4A]/20 transition-all text-left"
                                                    >
                                                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: colors.bg, border: `2px solid ${colors.fill}` }}>
                                                            <span className="text-[10px] font-bold" style={{ color: colors.text }}>
                                                                {Math.round(node.mastery_level * 100)}%
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-[#3D3D3D] truncate">{node.concept_name}</p>
                                                            <p className="text-[10px] text-[#8B8178]">{DOMAIN_LABELS[node.domain] || node.domain} · {node.exposure_count}x seen</p>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-[#8B8178]/30 shrink-0" />
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </motion.section>

                                {/* ──── ZPD RECOMMENDATIONS ──── */}
                                {recommendations.length > 0 && (
                                    <motion.section
                                        initial={{ opacity: 0, y: 25 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.8, delay: 0.35, ease }}
                                        className="relative rounded-[2rem] p-8 md:p-10 overflow-hidden bg-white/45 backdrop-blur-[30px] border border-white/70 shadow-[inset_0_0_30px_rgba(255,255,255,0.5),0_15px_35px_-5px_rgba(0,0,0,0.04)]"
                                    >
                                        <div className="flex items-center gap-2.5 mb-6">
                                            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                                                <Lightbulb className="w-4 h-4 text-amber-500" />
                                            </div>
                                            <span className="mono-tag text-[9px] text-[#8B8178]">Ready to Learn</span>
                                            <span className="mono-tag text-[8px] text-[#8B8178]/25 ml-auto">Zone of Proximal Development</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {recommendations.map(rec => (
                                                <motion.div
                                                    key={rec.concept_id}
                                                    whileHover={{ y: -4 }}
                                                    className="group relative rounded-2xl p-5 bg-white/60 border border-[#E8DED4]/50 hover:border-amber-200/60 hover:shadow-[0_10px_30px_rgba(245,158,11,0.08)] transition-all duration-500 cursor-pointer"
                                                    onClick={() => navigate(`/mentor?goal=${encodeURIComponent(`Learn: ${rec.concept_name}`)}`)}
                                                >
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div
                                                            className="w-2.5 h-2.5 rounded-full"
                                                            style={{ backgroundColor: DOMAIN_COLORS[rec.domain] || "#8B8178" }}
                                                        />
                                                        <span className="mono-tag text-[8px] text-[#8B8178]">{DOMAIN_LABELS[rec.domain] || rec.domain}</span>
                                                    </div>

                                                    <h4 className="text-sm font-bold text-[#3D3D3D] mb-1">{rec.concept_name}</h4>

                                                    {/* Readiness bar */}
                                                    <div className="mb-3">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[10px] text-[#8B8178]">Readiness</span>
                                                            <span className="text-[10px] font-semibold text-amber-600">{Math.round(rec.readiness * 100)}%</span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full bg-[#E8DED4]/50 overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${rec.readiness * 100}%` }}
                                                                transition={{ duration: 1, delay: 0.5, ease }}
                                                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    <p className="text-[11px] text-[#8B8178] mb-3 leading-relaxed">{rec.reason}</p>

                                                    <div className="flex items-center gap-1.5 text-[#5C6B4A] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                        <BookOpen className="w-3 h-3" />
                                                        <span className="text-[11px] font-semibold">Start Learning</span>
                                                        <ArrowRight className="w-3 h-3" />
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.section>
                                )}
                            </>
                        )}

                        {/* Footer */}
                        <motion.footer
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.7, ease }}
                            className="py-6 flex items-center gap-3"
                        >
                            <div className="w-8 h-px bg-[#E8DED4]" />
                            <span className="mono-tag text-[9px] text-[#8B8178]/30">Knowledge is a living graph</span>
                        </motion.footer>
                    </div>
                </main>
            </div>

            {/* ═══ CONCEPT DETAIL PANEL (Right Drawer) ═══ */}
            <AnimatePresence>
                {selectedNode && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/10 z-40"
                            onClick={() => setSelectedNode(null)}
                        />

                        {/* Drawer */}
                        <motion.aside
                            initial={{ x: 420 }}
                            animate={{ x: 0 }}
                            exit={{ x: 420 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                            className="fixed right-0 top-0 h-full w-full max-w-[400px] bg-[#FDF8F3] border-l border-[#E8DED4] z-50 overflow-y-auto shadow-[-20px_0_60px_rgba(0,0,0,0.06)]"
                        >
                            {/* Header */}
                            <div className="sticky top-0 bg-[#FDF8F3]/90 backdrop-blur-md z-10 p-6 pb-4 border-b border-[#E8DED4]/40">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="mono-tag text-[9px] text-[#8B8178]">Concept Detail</span>
                                    <button
                                        onClick={() => setSelectedNode(null)}
                                        className="p-2 rounded-xl text-[#8B8178] hover:bg-[#E8DED4]/50 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                        style={{
                                            backgroundColor: MASTERY_COLORS[selectedNode.status].bg,
                                            border: `2px solid ${MASTERY_COLORS[selectedNode.status].fill}`
                                        }}
                                    >
                                        <span className="text-base font-bold" style={{ color: MASTERY_COLORS[selectedNode.status].text }}>
                                            {Math.round(selectedNode.mastery_level * 100)}%
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-[#3D3D3D]">{selectedNode.concept_name}</h3>
                                        <span
                                            className="px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
                                            style={{
                                                color: DOMAIN_COLORS[selectedNode.domain] || "#8B8178",
                                                backgroundColor: `${DOMAIN_COLORS[selectedNode.domain] || "#8B8178"}15`,
                                            }}
                                        >
                                            {DOMAIN_LABELS[selectedNode.domain] || selectedNode.domain}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Mastery Progress */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-[#3D3D3D]">Mastery Progress</span>
                                        <span className="mono-tag text-[8px] text-[#8B8178]">{selectedNode.exposure_count}x practiced</span>
                                    </div>
                                    <div className="h-3 rounded-full bg-[#E8DED4]/50 overflow-hidden mb-3">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${selectedNode.mastery_level * 100}%` }}
                                            transition={{ duration: 0.8, ease }}
                                            className="h-full rounded-full"
                                            style={{ backgroundColor: MASTERY_COLORS[selectedNode.status].fill }}
                                        />
                                    </div>

                                    {/* Sparkline */}
                                    {selectedNode.mastery_history.length >= 2 && (
                                        <div className="p-3 rounded-xl bg-white/60 border border-[#E8DED4]/40">
                                            <span className="mono-tag text-[7px] text-[#8B8178]/50 mb-2 block">Last {selectedNode.mastery_history.length} sessions</span>
                                            <MasterySparkline
                                                history={selectedNode.mastery_history}
                                                color={MASTERY_COLORS[selectedNode.status].fill}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Stats grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-xl bg-white/60 border border-[#E8DED4]/40">
                                        <span className="mono-tag text-[7px] text-[#8B8178]/50 block mb-1">Clarity</span>
                                        <span className="text-lg font-bold text-[#3D3D3D]">{Math.round(selectedNode.last_clarity_score)}%</span>
                                    </div>
                                    <div className="p-3 rounded-xl bg-white/60 border border-[#E8DED4]/40">
                                        <span className="mono-tag text-[7px] text-[#8B8178]/50 block mb-1">Status</span>
                                        <span className="text-sm font-semibold capitalize" style={{ color: MASTERY_COLORS[selectedNode.status].text }}>
                                            {selectedNode.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Prerequisites */}
                                {(() => {
                                    const prereqs = getPrerequisites(selectedNode.concept_id);
                                    if (prereqs.length === 0) return null;
                                    return (
                                        <div>
                                            <h4 className="text-xs font-semibold text-[#3D3D3D] mb-2">Prerequisites</h4>
                                            <div className="space-y-1.5">
                                                {prereqs.map(p => (
                                                    <button
                                                        key={p.concept_id}
                                                        onClick={() => setSelectedNode(p)}
                                                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white/50 border border-[#E8DED4]/40 hover:border-[#5C6B4A]/20 transition-colors text-left"
                                                    >
                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                                                            style={{ backgroundColor: MASTERY_COLORS[p.status].bg, color: MASTERY_COLORS[p.status].text }}>
                                                            {Math.round(p.mastery_level * 100)}
                                                        </div>
                                                        <span className="text-xs text-[#3D3D3D]">{p.concept_name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Dependents */}
                                {(() => {
                                    const deps = getDependents(selectedNode.concept_id);
                                    if (deps.length === 0) return null;
                                    return (
                                        <div>
                                            <h4 className="text-xs font-semibold text-[#3D3D3D] mb-2">Unlocks</h4>
                                            <div className="space-y-1.5">
                                                {deps.map(d => (
                                                    <button
                                                        key={d.concept_id}
                                                        onClick={() => setSelectedNode(d)}
                                                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white/50 border border-[#E8DED4]/40 hover:border-[#5C6B4A]/20 transition-colors text-left"
                                                    >
                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                                                            style={{ backgroundColor: MASTERY_COLORS[d.status].bg, color: MASTERY_COLORS[d.status].text }}>
                                                            {Math.round(d.mastery_level * 100)}
                                                        </div>
                                                        <span className="text-xs text-[#3D3D3D]">{d.concept_name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Misconceptions */}
                                {selectedNode.misconceptions.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3 h-3" /> Misconceptions
                                        </h4>
                                        <div className="space-y-1.5">
                                            {selectedNode.misconceptions.map((m, i) => (
                                                <div key={i} className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/40 text-xs text-amber-800">
                                                    {m}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Practice Button */}
                                <button
                                    onClick={() => navigate(`/mentor?goal=${encodeURIComponent(`Practice: ${selectedNode.concept_name}`)}`)}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#5C6B4A] text-white text-sm font-semibold hover:bg-[#4A5A3A] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(92,107,74,0.2)] transition-all duration-500"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    Practice this concept
                                </button>

                                {/* Metadata */}
                                <div className="pt-4 border-t border-[#E8DED4]/40 flex items-center justify-between">
                                    {selectedNode.first_seen && (
                                        <span className="mono-tag text-[7px] text-[#8B8178]/40">
                                            First seen {new Date(selectedNode.first_seen).toLocaleDateString()}
                                        </span>
                                    )}
                                    {selectedNode.last_seen && (
                                        <span className="mono-tag text-[7px] text-[#8B8178]/40">
                                            Last seen {new Date(selectedNode.last_seen).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ═══ MOBILE BOTTOM NAV ═══ */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-2xl border-t border-[#E8DED4]/50 px-2 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <div className="flex justify-around">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 ${
                                item.active ? "text-[#5C6B4A]" : "text-[#8B8178]/50"
                            }`}
                        >
                            <item.icon className={`w-5 h-5 ${item.active ? "drop-shadow-sm" : ""}`} />
                            <span className="text-[9px] font-medium">{item.label}</span>
                            {item.active && <div className="w-1 h-1 rounded-full bg-[#5C6B4A]" />}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
