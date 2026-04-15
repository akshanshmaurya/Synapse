import { useState, useEffect, useCallback } from "react";
import {
  fetchChatContext,
  setSessionGoal,
  type SessionContext,
} from "@/services/api";

/**
 * Return shape of the {@link useSessionContext} hook.
 *
 * Provides both the raw session context from the backend and convenience
 * derived booleans for common UI branching (learning vs casual, goal state).
 */
interface UseSessionContextReturn {
  /** Full session context from the backend, null if not yet loaded or chat is new. */
  context: SessionContext | null;
  /** True while the context is being fetched from the server. */
  isLoading: boolean;
  /** Human-readable error message if the context fetch failed, null otherwise. */
  error: string | null;

  // Derived state (computed from context)
  /** True when session_intent is "learning" or "problem_solving". */
  isLearningSession: boolean;
  /** True when session_intent is "casual". */
  isCasualSession: boolean;
  /** True when the user has explicitly confirmed a session goal. */
  hasConfirmedGoal: boolean;
  /** True when the AI inferred a goal but the user has not yet confirmed it. */
  hasInferredGoal: boolean;

  // Actions
  /** Re-fetch the session context from the backend. */
  refreshContext: () => Promise<void>;
  /**
   * Persist a session goal to the backend with optimistic local update.
   * @param goal - The goal text to save.
   * @param domain - Optional learning domain (e.g. "dsa", "python").
   */
  saveGoal: (goal: string, domain?: string) => Promise<void>;
  /** Clear the local goal state (does not persist; used for inline editing). */
  clearGoal: () => void;
}

/**
 * Manages session context state for a given chat session.
 *
 * Automatically fetches context when the chatId changes and provides
 * methods to save/clear goals with optimistic updates. All fetch errors
 * are caught internally — the chat remains functional even if context
 * loading fails.
 *
 * @param chatId - The active chat session ID, or null if no chat is selected.
 * @returns Session context state, derived booleans, and action methods.
 *
 * @example
 * ```tsx
 * const { context, isLearningSession, saveGoal } = useSessionContext(chatId);
 * ```
 */
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
