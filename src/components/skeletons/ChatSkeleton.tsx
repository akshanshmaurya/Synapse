export default function ChatSkeleton() {
    return (
        <div className="flex flex-col gap-4 p-6 animate-pulse">
            {/* AI message */}
            <div className="flex items-start gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/20 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                    <div className="h-3 w-full bg-[#E8DED4]/30 rounded" />
                    <div className="h-3 w-3/4 bg-[#E8DED4]/25 rounded" />
                    <div className="h-3 w-1/2 bg-[#E8DED4]/20 rounded" />
                </div>
            </div>

            {/* User message */}
            <div className="flex items-start gap-3 max-w-[60%] self-end">
                <div className="space-y-2 flex-1">
                    <div className="h-3 w-full bg-[#5C6B4A]/15 rounded" />
                    <div className="h-3 w-2/3 bg-[#5C6B4A]/10 rounded" />
                </div>
            </div>

            {/* AI message */}
            <div className="flex items-start gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-[#5C6B4A]/20 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                    <div className="h-3 w-full bg-[#E8DED4]/30 rounded" />
                    <div className="h-3 w-5/6 bg-[#E8DED4]/25 rounded" />
                    <div className="h-3 w-2/3 bg-[#E8DED4]/20 rounded" />
                    <div className="h-3 w-1/3 bg-[#E8DED4]/15 rounded" />
                </div>
            </div>

            {/* User message */}
            <div className="flex items-start gap-3 max-w-[50%] self-end">
                <div className="space-y-2 flex-1">
                    <div className="h-3 w-full bg-[#5C6B4A]/15 rounded" />
                </div>
            </div>

            {/* Input area */}
            <div className="mt-auto pt-4 border-t border-[#E8DED4]/30">
                <div className="h-12 w-full bg-[#E8DED4]/20 rounded-2xl" />
            </div>
        </div>
    );
}
