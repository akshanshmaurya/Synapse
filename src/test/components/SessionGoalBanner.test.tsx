import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SessionGoalBanner from "@/components/chat/SessionGoalBanner";
import type { SessionContext } from "@/services/api";

// Mock framer-motion
vi.mock("framer-motion", () => ({
    motion: {
        div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
            <div className={className} {...props}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const baseProps = {
    chatId: "test-123",
    onGoalSaved: vi.fn(),
    onGoalEditing: vi.fn(),
    saveGoal: vi.fn().mockResolvedValue(undefined),
    clearGoal: vi.fn(),
};

const makeContext = (overrides: Partial<SessionContext> = {}): SessionContext => ({
    session_id: "s1",
    user_id: "u1",
    session_goal: null,
    session_domain: null,
    session_intent: "learning",
    momentum: null,
    message_count: 5,
    ...overrides,
});

describe("SessionGoalBanner", () => {
    it("renders input when no goal is set and session is learning", () => {
        render(
            <SessionGoalBanner
                {...baseProps}
                context={makeContext({ session_goal: null })}
                hasConfirmedGoal={false}
                hasInferredGoal={false}
                isCasualSession={false}
                isLearningSession={true}
            />
        );
        expect(screen.getByPlaceholderText(/what do you want to learn/i)).toBeInTheDocument();
    });

    it("shows confirmed goal text when hasConfirmedGoal=true", () => {
        render(
            <SessionGoalBanner
                {...baseProps}
                context={makeContext({ session_goal: "Learn binary trees" })}
                hasConfirmedGoal={true}
                hasInferredGoal={false}
                isCasualSession={false}
                isLearningSession={true}
            />
        );
        expect(screen.getByText("Learn binary trees")).toBeInTheDocument();
        expect(screen.getByLabelText("Edit goal")).toBeInTheDocument();
    });

    it("shows inferred goal with confirm/edit buttons when hasInferredGoal=true", () => {
        render(
            <SessionGoalBanner
                {...baseProps}
                context={makeContext({ session_goal: "Understanding recursion" })}
                hasConfirmedGoal={false}
                hasInferredGoal={true}
                isCasualSession={false}
                isLearningSession={true}
            />
        );
        expect(screen.getByText("Understanding recursion")).toBeInTheDocument();
        expect(screen.getByText(/that's right/i)).toBeInTheDocument();
        expect(screen.getByText("Edit")).toBeInTheDocument();
    });

    it("renders nothing for casual sessions", () => {
        const { container } = render(
            <SessionGoalBanner
                {...baseProps}
                context={makeContext({ session_intent: "casual" })}
                hasConfirmedGoal={false}
                hasInferredGoal={false}
                isCasualSession={true}
                isLearningSession={false}
            />
        );
        expect(container.innerHTML).toBe("");
    });

    it("renders nothing when intent is unknown and message_count <= 2", () => {
        const { container } = render(
            <SessionGoalBanner
                {...baseProps}
                context={makeContext({ session_intent: "unknown", message_count: 1 })}
                hasConfirmedGoal={false}
                hasInferredGoal={false}
                isCasualSession={false}
                isLearningSession={false}
            />
        );
        expect(container.innerHTML).toBe("");
    });

    it("shows domain badge when confirmed goal has a domain", () => {
        render(
            <SessionGoalBanner
                {...baseProps}
                context={makeContext({ session_goal: "Learn sorting", session_domain: "dsa" })}
                hasConfirmedGoal={true}
                hasInferredGoal={false}
                isCasualSession={false}
                isLearningSession={true}
            />
        );
        expect(screen.getByText("DSA")).toBeInTheDocument();
    });
});
