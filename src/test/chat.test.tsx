import { describe, it, expect, vi, beforeEach } from "vitest";
import { API_URL } from "@/config/env";
import { sendMessage, createChatSession, fetchChatMessages, fetchChatSessions, deleteChatSession } from "@/services/api";

describe("Chat API functions", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe("sendMessage", () => {
        it("sends message with credentials:include and returns response", async () => {
            const mockResponse = { response: "Here is an explanation of binary trees...", chat_id: "chat-1" };
            const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(JSON.stringify(mockResponse), { status: 200 })
            );

            const result = await sendMessage("Explain binary trees");

            expect(spy).toHaveBeenCalledWith(
                `${API_URL}/api/chat`,
                expect.objectContaining({
                    method: "POST",
                    credentials: "include",
                    body: JSON.stringify({ message: "Explain binary trees" }),
                })
            );
            expect(result.response).toBe("Here is an explanation of binary trees...");
            expect(result.chatId).toBe("chat-1");
        });

        it("includes chatId in body when provided", async () => {
            const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(JSON.stringify({ response: "ok", chat_id: "chat-1" }), { status: 200 })
            );

            await sendMessage("follow up question", "chat-1");

            expect(spy).toHaveBeenCalledWith(
                `${API_URL}/api/chat`,
                expect.objectContaining({
                    body: JSON.stringify({ message: "follow up question", chat_id: "chat-1" }),
                })
            );
        });

        it("throws on non-ok response", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(null, { status: 500 })
            );

            await expect(sendMessage("fail")).rejects.toThrow("Chat failed: 500");
        });
    });

    describe("createChatSession", () => {
        it("creates session with credentials:include and returns chat_id", async () => {
            const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(JSON.stringify({ chat_id: "new-chat-id" }), { status: 200 })
            );

            const result = await createChatSession();

            expect(spy).toHaveBeenCalledWith(
                `${API_URL}/api/chats`,
                expect.objectContaining({
                    credentials: "include",
                    method: "POST",
                })
            );
            expect(result).toBe("new-chat-id");
        });

        it("returns null on failure", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(null, { status: 500 })
            );

            const result = await createChatSession();
            expect(result).toBeNull();
        });
    });

    describe("fetchChatSessions", () => {
        it("fetches sessions with credentials:include", async () => {
            const mockSessions = [{ _id: "s1", user_id: "u1", title: "Chat 1", created_at: "2026-01-01", updated_at: "2026-01-01", message_count: 3, last_message_preview: "hi" }];
            const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(JSON.stringify({ chats: mockSessions }), { status: 200 })
            );

            const result = await fetchChatSessions();

            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining("/api/chats"),
                expect.objectContaining({ credentials: "include" })
            );
            expect(result).toHaveLength(1);
        });

        it("returns empty array on failure", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(null, { status: 500 })
            );

            const result = await fetchChatSessions();
            expect(result).toEqual([]);
        });
    });

    describe("fetchChatMessages", () => {
        it("fetches messages for a session with credentials:include", async () => {
            const mockMessages = [
                { _id: "m1", chat_id: "c1", sender: "user", content: "Hello", timestamp: "2026-01-01T00:00:00Z" },
                { _id: "m2", chat_id: "c1", sender: "mentor", content: "Hi!", timestamp: "2026-01-01T00:00:01Z" },
            ];
            const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(JSON.stringify({ messages: mockMessages }), { status: 200 })
            );

            const result = await fetchChatMessages("session-1");

            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining("/api/chats/session-1/messages"),
                expect.objectContaining({ credentials: "include" })
            );
            expect(result).toHaveLength(2);
        });

        it("returns empty array on failure", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(null, { status: 500 })
            );

            const result = await fetchChatMessages("bad-id");
            expect(result).toEqual([]);
        });
    });

    describe("deleteChatSession", () => {
        it("returns success when deletion succeeds", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(JSON.stringify({ success: true }), { status: 200 })
            );

            const result = await deleteChatSession("chat-1");
            expect(result).toEqual({ success: true });
        });

        it("returns backend error details on failure", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(JSON.stringify({ message: "Chat not found or not owned by user" }), { status: 404 })
            );

            const result = await deleteChatSession("chat-1");
            expect(result.success).toBe(false);
            expect(result.error).toContain("Chat not found");
        });
    });
});
