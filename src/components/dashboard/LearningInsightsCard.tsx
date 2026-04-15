import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Sparkles, TrendingUp, BookOpen } from "lucide-react";
import { fetchConceptMap, fetchRecommendations } from "@/services/api";
import type { ConceptMapNode, ZPDRecommendation } from "@/services/api";

const ease = [0.23, 1, 0.32, 1] as const;

interface LearningInsightsCardProps {
    delay?: number;
}

function masteryLabel(level: number): string {
    if (level >= 0.8) return "Mastered";
    if (level >= 0.6) return "Proficient";
    if (level >= 0.3) return "Developing";
    return "Novice";
}

function masteryColor(level: number): string {
    if (level >= 0.8) return "text-emerald-600 bg-emerald-500/10";
    if (level >= 0.6) return "text-[#5C6B4A] bg-[#5C6B4A]/10";
    if (level >= 0.3) return "text-amber-600 bg-amber-500/10";
    return "text-[#8B8178] bg-[#E8DED4]/30";
}

export default function LearningInsightsCard({ delay = 0 }: LearningInsightsCardProps) {
    const [topConcepts, setTopConcepts] = useState<ConceptMapNode[]>([]);
    const [zpdRec, setZpdRec] = useState<ZPDRecommendation | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [mapResult, recsResult] = await Promise.allSettled([
                    fetchConceptMap(),
                    fetchRecommendations(),
                ]);

                if (cancelled) return;

                // Top 3 strongest concepts
                if (mapResult.status === "fulfilled" && mapResult.value?.nodes) {
                    const sorted = [...mapResult.value.nodes]
                        .sort((a, b) => b.mastery_level - a.mastery_level)
                        .slice(0, 3);
                    setTopConcepts(sorted);
                }

                // ZPD recommendation
                if (recsResult.status === "fulfilled" && recsResult.value?.length > 0) {
                    setZpdRec(recsResult.value[0]);
                }
            } catch {
                // Non-critical — card just stays empty
            } finally {
                if (!cancelled) setLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Don't render if we have no data at all after loading
    if (loaded && topConcepts.length === 0 && !zpdRec) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay, ease }}
            className="bg-white/50 backdrop-blur-md rounded-3xl border border-[#E8DED4] shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6 col-span-1 md:col-span-2"
        >
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-xl bg-[#5C6B4A]/10 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-[#5C6B4A]" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-[#3D3D3D] tracking-tight"
                        style={{ fontFamily: "'Inter', sans-serif" }}>
                        Learning Insights
                    </h3>
                    <span className="mono-tag text-[8px] text-[#8B8178]/50">// AI Intelligence Summary</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Top Concepts */}
                <div>
                    <div className="flex items-center gap-1.5 mb-3">
                        <Sparkles className="w-3 h-3 text-[#D4A574]" />
                        <span className="text-[10px] font-semibold text-[#8B8178] uppercase tracking-wider">Strongest Concepts</span>
                    </div>
                    {!loaded ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-9 animate-pulse bg-[#E8DED4]/30 rounded-xl" />
                            ))}
                        </div>
                    ) : topConcepts.length > 0 ? (
                        <div className="space-y-2">
                            {topConcepts.map((c) => (
                                <div
                                    key={c.concept_id}
                                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/60 border border-[#E8DED4]/40"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <BookOpen className="w-3 h-3 text-[#5C6B4A] shrink-0" />
                                        <span className="text-xs font-medium text-[#3D3D3D] truncate">
                                            {c.concept_name}
                                        </span>
                                    </div>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${masteryColor(c.mastery_level)}`}>
                                        {masteryLabel(c.mastery_level)} · {Math.round(c.mastery_level * 100)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-[#8B8178]/50 italic">No concepts tracked yet.</p>
                    )}
                </div>

                {/* ZPD Recommendation */}
                <div>
                    <div className="flex items-center gap-1.5 mb-3">
                        <TrendingUp className="w-3 h-3 text-[#5C6B4A]" />
                        <span className="text-[10px] font-semibold text-[#8B8178] uppercase tracking-wider">Ready to Learn</span>
                    </div>
                    {!loaded ? (
                        <div className="h-20 animate-pulse bg-[#E8DED4]/30 rounded-xl" />
                    ) : zpdRec ? (
                        <div className="px-4 py-3 rounded-xl bg-[#5C6B4A]/5 border border-[#5C6B4A]/15">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                                <span className="text-xs font-bold text-[#3D3D3D]">{zpdRec.concept_name}</span>
                            </div>
                            <p className="text-[11px] text-[#8B8178] leading-relaxed">{zpdRec.reason}</p>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-[9px] text-[#8B8178]/50">
                                    Readiness: {Math.round((zpdRec.readiness ?? 0) * 100)}%
                                </span>
                                <span className="text-[9px] text-[#8B8178]/50">
                                    Domain: {zpdRec.domain}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-[#8B8178]/50 italic">Complete a few sessions to get recommendations.</p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
