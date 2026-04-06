export default function DashboardSkeleton() {
    return (
        <div className="space-y-10 animate-pulse">
            {/* Header skeleton */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                <div>
                    <div className="h-3 w-20 bg-[#E8DED4]/60 rounded mb-4" />
                    <div className="h-14 w-64 bg-[#E8DED4]/40 rounded-xl" />
                </div>
                <div className="h-12 w-40 bg-[#5C6B4A]/20 rounded-full" />
            </div>

            {/* Hero momentum card */}
            <div className="rounded-[2.5rem] bg-[#4A5A3A]/30 h-72" />

            {/* Bento grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 rounded-[2rem] bg-[#E8DED4]/20 h-52" />
                <div className="rounded-[2rem] bg-[#5C6B4A]/15 h-52" />
                <div className="lg:col-span-2 rounded-[2rem] bg-[#E8DED4]/20 h-56" />
                <div className="rounded-[2rem] bg-[#E8DED4]/20 h-48" />
            </div>

            {/* Timeline skeleton */}
            <div className="rounded-[2rem] bg-[#E8DED4]/20 p-8">
                <div className="h-4 w-32 bg-[#E8DED4]/40 rounded mb-6" />
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-start gap-5 py-4">
                        <div className="w-3 h-3 rounded-full bg-[#E8DED4]/40 mt-1" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 w-48 bg-[#E8DED4]/30 rounded" />
                            <div className="h-2 w-24 bg-[#E8DED4]/20 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
