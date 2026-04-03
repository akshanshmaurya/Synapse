import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SessionMomentum, SessionIntent } from "@/services/api";

interface MomentumIndicatorProps {
  momentum: SessionMomentum | null;
  sessionIntent: SessionIntent | null;
  messageCount: number;
}

const MOMENTUM_CONFIG: Record<
  SessionMomentum,
  {
    label: string;
    emoji: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    tooltip: string;
  }
> = {
  cold_start: {
    label: "Just Starting",
    emoji: "❄️",
    textColor: "text-[#8B8178]",
    bgColor: "bg-[#E8DED4]/30",
    borderColor: "border-[#E8DED4]",
    tooltip: "The session is just getting started. Keep going!",
  },
  warming_up: {
    label: "Warming Up",
    emoji: "🌡️",
    textColor: "text-blue-600/80",
    bgColor: "bg-blue-50/60",
    borderColor: "border-blue-200/40",
    tooltip:
      "You're getting into the flow. A few more messages and you'll be flowing.",
  },
  flowing: {
    label: "In the Flow",
    emoji: "✨",
    textColor: "text-[#5C6B4A]",
    bgColor: "bg-[#5C6B4A]/8",
    borderColor: "border-[#5C6B4A]/15",
    tooltip: "You're understanding well and making great progress!",
  },
  stuck: {
    label: "Working Through It",
    emoji: "⚠️",
    textColor: "text-amber-600",
    bgColor: "bg-amber-50/60",
    borderColor: "border-amber-200/40",
    tooltip:
      "This is a tough spot — but working through difficulty is how you grow.",
  },
  wrapping_up: {
    label: "Wrapping Up",
    emoji: "🎯",
    textColor: "text-purple-600/80",
    bgColor: "bg-purple-50/60",
    borderColor: "border-purple-200/40",
    tooltip: "Great session! You've covered a lot of ground.",
  },
};

export default function MomentumIndicator({
  momentum,
  sessionIntent,
  messageCount,
}: MomentumIndicatorProps) {
  const prevMomentumRef = useRef<SessionMomentum | null>(null);
  const [isInitialRender, setIsInitialRender] = useState(true);

  useEffect(() => {
    // After first render, mark future renders as non-initial
    if (momentum !== null) {
      const timer = setTimeout(() => setIsInitialRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [momentum]);

  useEffect(() => {
    if (momentum !== null) {
      prevMomentumRef.current = momentum;
    }
  }, [momentum]);

  // ── Visibility rules ──
  if (sessionIntent === "casual") return null;
  if (messageCount < 3) return null;
  if (!momentum) return null;
  if (momentum === "cold_start" && messageCount < 5) return null;

  const config = MOMENTUM_CONFIG[momentum];
  if (!config) return null;

  const shouldAnimate = !isInitialRender && prevMomentumRef.current !== momentum;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex">
            <AnimatePresence mode="wait">
              <motion.div
                key={momentum}
                initial={shouldAnimate ? { opacity: 0, x: 12, scale: 0.95 } : false}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -12, scale: 0.95 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${config.textColor} ${config.bgColor} ${config.borderColor}`}
              >
                <span className="text-xs leading-none">{config.emoji}</span>
                <span>{config.label}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-[220px] text-xs bg-white/90 backdrop-blur-md border-[#E8DED4] text-[#3D3D3D]"
        >
          {config.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
