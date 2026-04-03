import { useState, useEffect, useCallback } from "react";
import {
  fetchChatContext,
  setSessionGoal,
  type SessionContext,
} from "@/services/api";

interface UseSessionContextReturn {
  /** Full session context from the backend, null if not yet loaded or chat is new. */
  context: SessionContext | null;
  isLoading: boolean;
  error: string | null;

  // Derived state (computed from context)
  isLearningSession: boolean;
  isCasualSession: boolean;
  hasConfirmedGoal: boolean;
  hasInferredGoal: boolean;

  // Actions
  refreshContext: () => Promise<void>;
  saveGoal: (goal: string, domain?: string) => Promise<void>;
  clearGoal: () => void;
}

export function useSessionContext(chatId: string | null): UseSessionContextReturn {
  const [context, setContext] = useState<SessionContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshContext = useCallback(async () => {
    if (!chatId) return;
    try {
      setIsLoading(true);
      setError(null);
      const ctx = await fetchChatContext(chatId);
      setContext(ctx);
    } catch {
      setError("Failed to load session context");
      // Don't rethrow — this is non-critical, chat must still work
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  // Auto-fetch when chatId changes
  useEffect(() => {
    if (!chatId) {
      setContext(null);
      setError(null);
      return;
    }
    refreshContext();
  }, [chatId, refreshContext]);

  const saveGoal = useCallback(
    async (goal: string, domain?: string) => {
      if (!chatId) return;

      // Optimistic update
      setContext((prev) =>
        prev
          ? { ...prev, session_goal: goal, goal_confirmed: true, goal_inferred: false }
          : prev,
      );

      try {
        await setSessionGoal(chatId, { goal, confirmed: true, domain });
        // Server confirmed — local state is already correct
      } catch (err) {
        // Rollback on failure
        await refreshContext();
        throw err;
      }
    },
    [chatId, refreshContext],
  );

  const clearGoal = useCallback(() => {
    // When user clicks "Edit" — clear locally so the input shows again.
    // We don't persist the clear; the new goal replaces it on next saveGoal.
    setContext((prev) =>
      prev
        ? { ...prev, session_goal: null, goal_confirmed: false, goal_inferred: false }
        : prev,
    );
  }, []);

  // Derived state
  const isLearningSession =
    context?.session_intent === "learning" || context?.session_intent === "problem_solving";
  const isCasualSession = context?.session_intent === "casual";
  const hasConfirmedGoal = context?.goal_confirmed === true && !!context?.session_goal;
  const hasInferredGoal =
    context?.goal_inferred === true && !context?.goal_confirmed && !!context?.session_goal;

  return {
    context,
    isLoading,
    error,
    isLearningSession,
    isCasualSession,
    hasConfirmedGoal,
    hasInferredGoal,
    refreshContext,
    saveGoal,
    clearGoal,
  };
}
