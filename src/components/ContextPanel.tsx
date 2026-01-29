import { motion } from "framer-motion";


interface ContextPanelProps {
    userState: any; // Type strictly later
    loading: boolean;
}

export function ContextPanel({ userState, loading }: ContextPanelProps) {
    if (loading) return <div className="hidden lg:block w-80 p-6 border-l border-border/40 animate-pulse bg-muted/10 h-screen fixed right-0 top-0" />;

    const goals = userState?.goals || ["Master System Design", "Stakeholder Communication"];
    const interests = userState?.interests || ["LLMs", "Productivity"];

    return (
        <aside className="hidden lg:flex flex-col w-96 border-l border-border/40 bg-background/30 backdrop-blur-sm h-screen fixed right-0 top-0 pt-8 pb-6 px-6 overflow-y-auto z-20">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-6">Persistent Memory</h3>

            {/* Current Goals Card */}
            <div className="bg-white/50 border border-white/60 p-5 rounded-2xl shadow-sm mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-blue-100 rounded-md text-blue-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <span className="font-serif text-lg text-foreground">Current Goals</span>
                </div>

                <div className="space-y-4">
                    {goals.slice(0, 2).map((goal: string, idx: number) => (
                        <div key={idx} className="space-y-2">
                            <div className="flex justify-between text-xs font-medium text-foreground/80">
                                <span>{goal}</span>
                                <span className="text-primary">{70 + (idx * 15)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${70 + (idx * 15)}%` }}
                                    transition={{ duration: 1, delay: 0.5 }}
                                    className="h-full bg-primary rounded-full"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <button className="w-full mt-4 py-2 border border-dashed border-border rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                    + Add New Objective
                </button>
            </div>

            {/* Sentiment Trends (Mock) */}
            <div className="bg-white/50 border border-white/60 p-5 rounded-2xl shadow-sm mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                        <span className="font-serif text-lg text-foreground">Sentiment</span>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">+12%</span>
                </div>
                <div className="flex items-end justify-between h-24 gap-1">
                    {[40, 60, 45, 70, 50, 80, 65].map((h, i) => (
                        <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ delay: i * 0.1 }}
                            className={`w-full rounded-t-sm ${i === 6 ? 'bg-rose-400' : 'bg-blue-200/50'}`}
                        />
                    ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4 italic">
                    "Motivation levels peaked during discussions of Impact, but dipped when mentioning Hierarchy."
                </p>
            </div>

            {/* Mentor's Insights */}
            <div className="bg-amber-50/80 border border-amber-100 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-amber-100 rounded-md text-amber-700">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M3.343 15.657l-.707.707m12.728 0l-.707-.707M6.343 4.636l-.707.707M15.27 21h-6.54" /></svg>
                    </div>
                    <span className="font-serif text-lg text-amber-900">Mentor's Insights</span>
                </div>
                <p className="text-sm text-amber-900/80 font-serif leading-relaxed">
                    User exhibits a strong "Craftsman" identity. Future guidance should frame leadership not as "management" but as "scaling technical excellence through others."
                </p>
                <div className="flex gap-2 mt-4">
                    <span className="text-[10px] uppercase font-bold text-amber-700 border border-amber-200 px-2 py-1 rounded-md">Identity: Craftsman</span>
                    <span className="text-[10px] uppercase font-bold text-amber-700 border border-amber-200 px-2 py-1 rounded-md">Growth: Scaling</span>
                </div>
            </div>
        </aside>
    );
}
