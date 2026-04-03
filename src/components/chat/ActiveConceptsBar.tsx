import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SessionIntent } from "@/services/api";

interface ActiveConceptsBarProps {
  activeConcepts: string[];
  sessionIntent: SessionIntent | null;
}

/** Convert a concept_id slug to a readable label: "binary-search" → "Binary Search" */
function conceptIdToLabel(conceptId: string): string {
  return conceptId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function ActiveConceptsBar({
  activeConcepts,
  sessionIntent,
}: ActiveConceptsBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to end when new concepts arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [activeConcepts]);

  // ── Visibility rules ──
  if (sessionIntent === "casual") return null;
  if (sessionIntent === "unknown") return null;
  if (activeConcepts.length === 0) return null;

  return (
    <div className="relative flex-1 min-w-0">
      {/* Left fade gradient */}
      <div className="absolute left-0 top-0 bottom-0 w-4 z-10 pointer-events-none bg-gradient-to-r from-[#FDF8F3] to-transparent" />

      {/* Scrollable concept strip */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide px-4"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <AnimatePresence mode="popLayout">
          {activeConcepts.map((conceptId) => (
            <motion.span
              key={conceptId}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#E8DED4]/40 border border-[#E8DED4]/60 text-[10px] font-medium text-[#8B8178] whitespace-nowrap shrink-0"
            >
              {conceptIdToLabel(conceptId)}
            </motion.span>
          ))}
        </AnimatePresence>
        {/* TODO Phase 6.2: add mastery arc when concept map endpoint available */}
      </div>

      {/* Right fade gradient */}
      <div className="absolute right-0 top-0 bottom-0 w-4 z-10 pointer-events-none bg-gradient-to-l from-[#FDF8F3] to-transparent" />
    </div>
  );
}
