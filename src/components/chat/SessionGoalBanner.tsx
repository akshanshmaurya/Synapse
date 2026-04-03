import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Target, Check, Pencil, X, Loader2 } from "lucide-react";
import type { SessionContext } from "@/services/api";

interface SessionGoalBannerProps {
  chatId: string;
  context: SessionContext | null;
  onGoalSaved: (goal: string) => void;
  onGoalEditing: () => void;
  saveGoal: (goal: string, domain?: string) => Promise<void>;
  clearGoal: () => void;
  hasConfirmedGoal: boolean;
  hasInferredGoal: boolean;
  isCasualSession: boolean;
  isLearningSession: boolean;
}

const DOMAIN_LABELS: Record<string, string | null> = {
  dsa: "DSA",
  python: "Python",
  web: "Web Dev",
  ml: "ML / AI",
  career: "Career",
  system_design: "System Design",
  unknown: null,
};

const ease = [0.23, 1, 0.32, 1] as const;

export default function SessionGoalBanner({
  chatId,
  context,
  onGoalSaved,
  onGoalEditing,
  saveGoal,
  clearGoal,
  hasConfirmedGoal,
  hasInferredGoal,
  isCasualSession,
  isLearningSession,
}: SessionGoalBannerProps) {
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check sessionStorage for dismissal
  useEffect(() => {
    if (chatId) {
      setDismissed(sessionStorage.getItem(`goal-dismissed-${chatId}`) === "true");
    }
  }, [chatId]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSubmit = async () => {
    const goal = inputValue.trim();
    if (!goal || isSaving) return;

    setIsSaving(true);
    try {
      await saveGoal(goal);
      onGoalSaved(goal);
      setIsEditing(false);
      setInputValue("");
    } catch {
      // saveGoal handles rollback; we just stop the spinner
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmInferred = async () => {
    if (!context?.session_goal || isSaving) return;
    setIsSaving(true);
    try {
      await saveGoal(context.session_goal);
      onGoalSaved(context.session_goal);
    } catch {
      // rollback handled by hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = () => {
    setInputValue(context?.session_goal || "");
    setIsEditing(true);
    clearGoal();
    onGoalEditing();
  };

  const handleDismiss = () => {
    sessionStorage.setItem(`goal-dismissed-${chatId}`, "true");
    setDismissed(true);
  };

  // ── Visibility Rules ──

  // STATE 4: Casual session → show nothing
  if (isCasualSession) return null;

  // STATE 5: Unknown intent, message_count <= 2 → too early
  if (!context || (context.session_intent === "unknown" && context.message_count <= 2)) {
    return null;
  }

  // Dismissed by user
  if (dismissed && !hasConfirmedGoal && !hasInferredGoal) return null;

  // ── STATE 3: Confirmed Goal ──
  if (hasConfirmedGoal && !isEditing) {
    const domainLabel = context.session_domain
      ? DOMAIN_LABELS[context.session_domain] ?? context.session_domain
      : null;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="confirmed"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease }}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#5C6B4A]/8 border border-[#5C6B4A]/15"
        >
          <Target className="w-3.5 h-3.5 text-[#5C6B4A] shrink-0" />
          <span className="text-sm font-medium text-[#3D3D3D] truncate">
            {context.session_goal}
          </span>
          {domainLabel && (
            <span className="px-2 py-0.5 rounded-full bg-[#5C6B4A]/10 text-[10px] font-semibold text-[#5C6B4A] uppercase tracking-wider shrink-0">
              {domainLabel}
            </span>
          )}
          <button
            onClick={handleEditClick}
            className="ml-auto p-1 rounded-md text-[#8B8178]/40 hover:text-[#5C6B4A] hover:bg-[#5C6B4A]/10 transition-colors shrink-0"
            aria-label="Edit goal"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── STATE 2: Inferred Goal (not confirmed) ──
  if (hasInferredGoal && !isEditing) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="inferred"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease }}
          className="px-4 py-3 rounded-xl bg-amber-50/80 border border-amber-200/60 backdrop-blur-sm"
        >
          <div className="flex items-start gap-2.5">
            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-700/70 mb-1">
                Looks like you&apos;re working on:
              </p>
              <p className="text-sm font-medium text-[#3D3D3D] mb-2.5">
                {context?.session_goal}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleConfirmInferred}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#5C6B4A] text-white hover:bg-[#4A5A3A] transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  That&apos;s right
                </button>
                <button
                  onClick={handleEditClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#8B8178] bg-white/60 border border-[#E8DED4] hover:border-[#5C6B4A]/30 hover:text-[#5C6B4A] transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── STATE 1: No goal, learning session, OR editing mode ──
  if (isEditing || (isLearningSession && !context?.session_goal)) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="input"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease }}
          className="px-4 py-3 rounded-xl bg-white/40 backdrop-blur-sm border border-[#E8DED4]/60"
        >
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#8B8178]/50 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="What do you want to learn in this session? (optional)"
              maxLength={100}
              className="flex-1 bg-transparent text-sm text-[#3D3D3D] placeholder:text-[#8B8178]/35 focus:outline-none"
              style={{ fontFamily: "'Inter', sans-serif" }}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || isSaving}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                  inputValue.trim() && !isSaving
                    ? "bg-[#5C6B4A] text-white hover:bg-[#4A5A3A]"
                    : "bg-[#E8DED4]/50 text-[#8B8178]/40 cursor-not-allowed"
                }`}
              >
                {isSaving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Set Goal"
                )}
              </button>
              {!isEditing && (
                <button
                  onClick={handleDismiss}
                  className="p-1 rounded-md text-[#8B8178]/30 hover:text-[#8B8178] transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {isEditing && (
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setInputValue("");
                  }}
                  className="p-1 rounded-md text-[#8B8178]/30 hover:text-[#8B8178] transition-colors"
                  aria-label="Cancel editing"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
