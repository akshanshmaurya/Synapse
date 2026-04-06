export default function RoadmapSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header */}
            <div className="flex items-end justify-between gap-6">
                <div>
                    <div className="h-3 w-20 bg-[#E8DED4]/60 rounded mb-4" />
                    <div className="h-12 w-48 bg-[#E8DED4]/40 rounded-xl" />
                </div>
            </div>

            {/* Steps */}
            <div className="space-y-4 relative pl-8">
                {/* Timeline line */}
                <div className="absolute left-3 top-3 bottom-3 w-px bg-[#E8DED4]/30" />

                {[...Array(5)].map((_, i) => (
                    <div key={i} className="relative flex items-start gap-5">
                        <div className="absolute left-[-20px] w-6 h-6 rounded-full bg-[#E8DED4]/30" />
                        <div className="flex-1 rounded-2xl bg-[#E8DED4]/15 border border-[#E8DED4]/20 p-6 space-y-3">
                            <div className="h-4 w-40 bg-[#E8DED4]/30 rounded" />
                            <div className="h-3 w-full bg-[#E8DED4]/20 rounded" />
                            <div className="h-3 w-2/3 bg-[#E8DED4]/15 rounded" />
                            <div className="flex gap-2 mt-3">
                                <div className="h-5 w-16 bg-[#5C6B4A]/10 rounded-full" />
                                <div className="h-5 w-20 bg-[#5C6B4A]/10 rounded-full" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
