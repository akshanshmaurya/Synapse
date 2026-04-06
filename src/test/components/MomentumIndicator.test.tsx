import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MomentumIndicator from "@/components/chat/MomentumIndicator";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
    motion: {
        div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
            <div className={className} {...props}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock tooltip components
vi.mock("@/components/ui/tooltip", () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipContent: ({ children }: { children: React.ReactNode }) => <span data-testid="tooltip">{children}</span>,
    TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("MomentumIndicator", () => {
    it("renders nothing when momentum is null", () => {
        const { container } = render(
            <MomentumIndicator momentum={null} sessionIntent="learning" messageCount={5} />
        );
        expect(container.innerHTML).toBe("");
    });

    it("renders nothing for casual sessions", () => {
        const { container } = render(
            <MomentumIndicator momentum="flowing" sessionIntent="casual" messageCount={10} />
        );
        expect(container.innerHTML).toBe("");
    });

    it("renders nothing when messageCount < 3", () => {
        const { container } = render(
            <MomentumIndicator momentum="flowing" sessionIntent="learning" messageCount={2} />
        );
        expect(container.innerHTML).toBe("");
    });

    it("renders cold_start state correctly (when messageCount >= 5)", () => {
        render(
            <MomentumIndicator momentum="cold_start" sessionIntent="learning" messageCount={6} />
        );
        expect(screen.getByText("Just Starting")).toBeInTheDocument();
        expect(screen.getByText("❄️")).toBeInTheDocument();
    });

    it("hides cold_start when messageCount < 5", () => {
        const { container } = render(
            <MomentumIndicator momentum="cold_start" sessionIntent="learning" messageCount={4} />
        );
        expect(container.innerHTML).toBe("");
    });

    it("renders warming_up state correctly", () => {
        render(
            <MomentumIndicator momentum="warming_up" sessionIntent="learning" messageCount={5} />
        );
        expect(screen.getByText("Warming Up")).toBeInTheDocument();
        expect(screen.getByText("🌡️")).toBeInTheDocument();
    });

    it("renders flowing state correctly", () => {
        render(
            <MomentumIndicator momentum="flowing" sessionIntent="learning" messageCount={5} />
        );
        expect(screen.getByText("In the Flow")).toBeInTheDocument();
        expect(screen.getByText("✨")).toBeInTheDocument();
    });

    it("renders stuck state correctly", () => {
        render(
            <MomentumIndicator momentum="stuck" sessionIntent="learning" messageCount={5} />
        );
        expect(screen.getByText("Working Through It")).toBeInTheDocument();
        expect(screen.getByText("⚠️")).toBeInTheDocument();
    });

    it("renders wrapping_up state correctly", () => {
        render(
            <MomentumIndicator momentum="wrapping_up" sessionIntent="learning" messageCount={5} />
        );
        expect(screen.getByText("Wrapping Up")).toBeInTheDocument();
        expect(screen.getByText("🎯")).toBeInTheDocument();
    });
});
