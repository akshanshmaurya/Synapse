import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { API_URL } from "@/config/env";

// Helper component to access auth context in tests
function AuthConsumer({ onRender }: { onRender: (auth: ReturnType<typeof useAuth>) => void }) {
    const auth = useAuth();
    onRender(auth);
    return (
        <div>
            <span data-testid="auth-status">{auth.isAuthenticated ? "authenticated" : "unauthenticated"}</span>
            <span data-testid="loading">{auth.isLoading ? "loading" : "ready"}</span>
            <span data-testid="onboarding">{auth.onboardingComplete ? "complete" : "incomplete"}</span>
        </div>
    );
}

function renderWithAuth(onRender: (auth: ReturnType<typeof useAuth>) => void) {
    return render(
        <AuthProvider>
            <AuthConsumer onRender={onRender} />
        </AuthProvider>
    );
}

describe("AuthContext", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
    });

    it("starts unauthenticated when no stored user", async () => {
        let authState: ReturnType<typeof useAuth> | null = null;
        renderWithAuth((auth) => { authState = auth; });

        await waitFor(() => {
            expect(screen.getByTestId("loading").textContent).toBe("ready");
        });

        expect(authState!.isAuthenticated).toBe(false);
        expect(authState!.user).toBeNull();
    });

    it("login calls API with credentials:include and stores user", async () => {
        const mockUser = { id: "1", email: "test@test.com", name: "Test", created_at: "2026-01-01" };

        // Mock login fetch — the first call is login, second is onboarding check
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(new Response(JSON.stringify({ user: mockUser }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ is_complete: true }), { status: 200 }));

        let authState: ReturnType<typeof useAuth> | null = null;
        renderWithAuth((auth) => { authState = auth; });

        await waitFor(() => {
            expect(screen.getByTestId("loading").textContent).toBe("ready");
        });

        await act(async () => {
            await authState!.login("test@test.com", "password123");
        });

        // Verify login was called with credentials
        expect(globalThis.fetch).toHaveBeenCalledWith(
            `${API_URL}/api/auth/login`,
            expect.objectContaining({ credentials: "include" })
        );

        expect(authState!.isAuthenticated).toBe(true);
        expect(authState!.user?.email).toBe("test@test.com");
    });

    it("logout clears user and localStorage", async () => {
        const mockUser = { id: "1", email: "test@test.com", name: "Test", created_at: "2026-01-01" };
        localStorage.setItem("auth_user", JSON.stringify(mockUser));

        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(new Response(JSON.stringify({ is_complete: true }), { status: 200 }))
            .mockResolvedValueOnce(new Response(null, { status: 200 }));

        let authState: ReturnType<typeof useAuth> | null = null;
        renderWithAuth((auth) => { authState = auth; });

        await waitFor(() => {
            expect(authState!.isAuthenticated).toBe(true);
        });

        await act(async () => {
            await authState!.logout();
        });

        expect(authState!.isAuthenticated).toBe(false);
        expect(authState!.user).toBeNull();
        expect(localStorage.getItem("auth_user")).toBeNull();
    });

    it("checkOnboarding returns boolean from API", async () => {
        const mockUser = { id: "1", email: "test@test.com", name: "Test", created_at: "2026-01-01" };
        localStorage.setItem("auth_user", JSON.stringify(mockUser));

        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(new Response(JSON.stringify({ is_complete: false }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ is_complete: true }), { status: 200 }));

        let authState: ReturnType<typeof useAuth> | null = null;
        renderWithAuth((auth) => { authState = auth; });

        await waitFor(() => {
            expect(screen.getByTestId("loading").textContent).toBe("ready");
        });

        let result: boolean = false;
        await act(async () => {
            result = await authState!.checkOnboarding();
        });

        expect(result).toBe(true);
    });
});
