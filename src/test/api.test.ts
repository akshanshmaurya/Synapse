import { describe, it, expect, vi, beforeEach } from "vitest";
import { API_URL } from "@/config/env";
import {
    fetchDashboardData,
    fetchDashboardRecommendations,
    fetchConceptMap,
    fetchRecommendations,
} from "@/services/api";

describe("API service functions", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("fetchDashboardData includes credentials:include", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ momentum: {}, effort: { total_sessions: 1 } }), { status: 200 })
        );

        await fetchDashboardData();

        expect(spy).toHaveBeenCalledWith(
            `${API_URL}/api/user/dashboard`,
            expect.objectContaining({ credentials: "include" })
        );
    });

    it("fetchDashboardData returns null on failure", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(null, { status: 500 })
        );

        const result = await fetchDashboardData();
        expect(result).toBeNull();
    });

    it("fetchDashboardRecommendations includes credentials:include", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({
                velocity: { label: "steady", trend: "stable", insight: "", mastered_count: 0, in_progress_count: 0, mastery_sparkline: [] },
                next_steps: [],
                recent_sessions: [],
            }), { status: 200 })
        );

        await fetchDashboardRecommendations();

        expect(spy).toHaveBeenCalledWith(
            `${API_URL}/api/user/recommendations`,
            expect.objectContaining({ credentials: "include" })
        );
    });

    it("fetchDashboardRecommendations returns null on failure", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(null, { status: 500 })
        );

        const result = await fetchDashboardRecommendations();
        expect(result).toBeNull();
    });

    it("fetchConceptMap includes credentials:include", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ nodes: [], edges: [] }), { status: 200 })
        );

        await fetchConceptMap();

        expect(spy).toHaveBeenCalledWith(
            `${API_URL}/api/user/concept-map`,
            expect.objectContaining({ credentials: "include" })
        );
    });

    it("fetchRecommendations falls back to next_steps field", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({
                next_steps: [{ concept_id: "1", concept_name: "Test", domain: "d", mastery_level: 0.3, readiness: 0.5, reason: "r" }],
            }), { status: 200 })
        );

        const result = await fetchRecommendations();
        expect(result).toHaveLength(1);
        expect(result[0].concept_name).toBe("Test");
    });

    it("fetchRecommendations returns empty array on network error", async () => {
        vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

        const result = await fetchRecommendations();
        expect(result).toEqual([]);
    });
});
