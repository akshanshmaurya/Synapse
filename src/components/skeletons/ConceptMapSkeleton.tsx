export default function ConceptMapSkeleton() {
    // Generates pseudo-random positions for skeleton nodes
    const nodes = [
        { cx: 200, cy: 150, r: 28 }, { cx: 420, cy: 120, r: 22 },
        { cx: 320, cy: 280, r: 32 }, { cx: 550, cy: 220, r: 20 },
        { cx: 150, cy: 350, r: 24 }, { cx: 480, cy: 380, r: 26 },
        { cx: 350, cy: 430, r: 18 }, { cx: 100, cy: 220, r: 20 },
        { cx: 600, cy: 340, r: 22 }, { cx: 280, cy: 160, r: 16 },
    ];

    const edges = [
        [0, 1], [0, 2], [1, 3], [2, 4], [2, 6],
        [3, 5], [4, 7], [5, 8], [6, 5], [9, 2],
    ];

    return (
        <div className="space-y-6 animate-pulse">
            {/* Header */}
            <div className="flex items-end justify-between gap-6">
                <div>
                    <div className="h-3 w-24 bg-[#E8DED4]/60 rounded mb-4" />
                    <div className="h-12 w-56 bg-[#E8DED4]/40 rounded-xl" />
                </div>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 w-20 rounded-full bg-[#E8DED4]/20" />
                ))}
            </div>

            {/* Graph area */}
            <div className="relative rounded-[2rem] bg-[#E8DED4]/10 border border-[#E8DED4]/20 overflow-hidden" style={{ height: 520 }}>
                <svg viewBox="0 0 700 520" className="w-full h-full">
                    {/* Edges (lines between nodes) */}
                    {edges.map(([from, to], i) => (
                        <line
                            key={`edge-${i}`}
                            x1={nodes[from].cx} y1={nodes[from].cy}
                            x2={nodes[to].cx} y2={nodes[to].cy}
                            stroke="#E8DED4" strokeWidth="1.5" strokeOpacity="0.3"
                        />
                    ))}

                    {/* Nodes (grey circles) */}
                    {nodes.map((node, i) => (
                        <g key={`node-${i}`}>
                            <circle cx={node.cx} cy={node.cy} r={node.r} fill="#E8DED4" fillOpacity="0.2" stroke="#E8DED4" strokeOpacity="0.3" strokeWidth="1.5" />
                            <rect x={node.cx - 12} y={node.cy - 3} width={24} height={6} rx={3} fill="#E8DED4" fillOpacity="0.3" />
                        </g>
                    ))}
                </svg>
            </div>

            {/* ZPD strip */}
            <div className="flex gap-3">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex-1 rounded-2xl bg-[#E8DED4]/15 border border-[#E8DED4]/20 p-5 space-y-3">
                        <div className="h-3 w-20 bg-[#E8DED4]/30 rounded" />
                        <div className="h-2 w-full bg-[#E8DED4]/20 rounded-full" />
                        <div className="h-3 w-full bg-[#E8DED4]/15 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}
