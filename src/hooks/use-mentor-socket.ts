import { useState, useEffect, useRef, useCallback } from "react";
import { WS_URL } from "@/config/env";

const WS_DEBUG = import.meta.env.DEV;
const wslog = (...args: unknown[]) => {
    if (WS_DEBUG) console.log("[WS]", ...args);
};

// ── Connection state machine ──────────────────────────────────────────
// Consumers use this to choose transport (WS vs REST) and render status.
export enum WsConnectionState {
    /** No sessionId provided — connection not needed. */
    IDLE = "idle",
    /** Establishing the initial connection. */
    CONNECTING = "connecting",
    /** WebSocket is open and ready to send/receive. */
    OPEN = "open",
    /** Connection dropped unexpectedly — attempting to restore. */
    RECONNECTING = "reconnecting",
    /** Max retries exhausted — fall back to REST. */
    FAILED = "failed",
    /** Intentionally closed (unmount / navigation). */
    CLOSED = "closed",
}

interface UseMentorSocketOptions {
    sessionId: string | null;
    onToken?: (token: string) => void;
    onDone?: (content: string, chatId: string) => void;
    onError?: (message: string) => void;
    onTyping?: () => void;
}

/** Maximum reconnect attempts before giving up and falling back. */
const MAX_RECONNECT_ATTEMPTS = 3;

/** Initial backoff delay in milliseconds. Doubles on each retry. */
const INITIAL_BACKOFF_MS = 1000;

export function useMentorSocket({
    sessionId,
    onToken,
    onDone,
    onError,
    onTyping,
}: UseMentorSocketOptions) {
    const wsRef = useRef<WebSocket | null>(null);
    const [connectionState, setConnectionState] = useState<WsConnectionState>(
        WsConnectionState.IDLE
    );
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState("");
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backoffRef = useRef(INITIAL_BACKOFF_MS);
    const reconnectAttemptsRef = useRef(0);
    const intentionalCloseRef = useRef(false);

    // ── Ref-based callbacks ───────────────────────────────────────────
    // Prevents the WebSocket from reconnecting every time the parent
    // re-renders with new inline callback references.
    const onTokenRef = useRef(onToken);
    const onDoneRef = useRef(onDone);
    const onErrorRef = useRef(onError);
    const onTypingRef = useRef(onTyping);

    useEffect(() => { onTokenRef.current = onToken; }, [onToken]);
    useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);
    useEffect(() => { onTypingRef.current = onTyping; }, [onTyping]);

    const connect = useCallback(() => {
        if (!sessionId) {
            setConnectionState(WsConnectionState.IDLE);
            return;
        }

        // Clean up any existing connection before creating a new one
        if (wsRef.current) {
            wsRef.current.onclose = null; // Prevent reconnect from old close
            wsRef.current.close();
        }

        intentionalCloseRef.current = false;

        try {
            setConnectionState((prev) =>
                prev === WsConnectionState.RECONNECTING
                    ? WsConnectionState.RECONNECTING
                    : WsConnectionState.CONNECTING
            );

            const url = `${WS_URL}/ws/chat/${sessionId}`;
            wslog("connecting →", url);
            const ws = new WebSocket(url);

            ws.onopen = () => {
                wslog("open", url);
                setConnectionState(WsConnectionState.OPEN);
                // Reset retry state on successful connection
                reconnectAttemptsRef.current = 0;
                backoffRef.current = INITIAL_BACKOFF_MS;
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    wslog("msg", data.type, data.type === "token" ? JSON.stringify(data.content).slice(0, 40) : "");
                    switch (data.type) {
                        case "token":
                            setIsStreaming(true);
                            setStreamingContent((prev) => prev + data.content);
                            onTokenRef.current?.(data.content);
                            break;
                        case "done":
                            setIsStreaming(false);
                            onDoneRef.current?.(data.content, data.chat_id);
                            // Keep content for a tick so UI can transition, then clear
                            setTimeout(() => setStreamingContent(""), 50);
                            break;
                        case "error":
                            setIsStreaming(false);
                            setStreamingContent("");
                            onErrorRef.current?.(data.content);
                            break;
                        case "typing":
                            onTypingRef.current?.();
                            break;
                    }
                } catch (e) {
                    wslog("parse error", e);
                }
            };

            ws.onclose = (ev) => {
                wslog("close", { code: ev.code, reason: ev.reason, wasClean: ev.wasClean, attempts: reconnectAttemptsRef.current });
                // Don't reconnect if the close was intentional (unmount, navigation)
                if (intentionalCloseRef.current) {
                    setConnectionState(WsConnectionState.CLOSED);
                    return;
                }

                // Check retry budget
                if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                    wslog("FAILED — exhausted retries; REST fallback will handle further messages");
                    setConnectionState(WsConnectionState.FAILED);
                    return;
                }

                // Auto-reconnect with exponential backoff
                setConnectionState(WsConnectionState.RECONNECTING);
                reconnectAttemptsRef.current += 1;
                const delay = backoffRef.current;
                backoffRef.current = Math.min(delay * 2, 8000);
                wslog(`reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
                reconnectTimer.current = setTimeout(() => {
                    connect();
                }, delay);
            };

            ws.onerror = (ev) => {
                wslog("error", ev);
                // onerror is always followed by onclose — let onclose handle state
                ws.close();
            };

            wsRef.current = ws;
        } catch {
            setConnectionState(WsConnectionState.FAILED);
        }
    }, [sessionId]); // Only reconnect when sessionId changes

    useEffect(() => {
        // Reset retry state when sessionId changes (new session = fresh start)
        reconnectAttemptsRef.current = 0;
        backoffRef.current = INITIAL_BACKOFF_MS;
        connect();
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (wsRef.current) {
                intentionalCloseRef.current = true;
                wsRef.current.onclose = null; // Prevent reconnect on intentional close
                wsRef.current.close();
            }
        };
    }, [connect]);

    const sendMessage = useCallback(
        (message: string) => {
            const rs = wsRef.current?.readyState;
            if (rs === WebSocket.OPEN) {
                wslog("send via WS", JSON.stringify(message).slice(0, 60));
                setStreamingContent("");
                setIsStreaming(true);
                wsRef.current!.send(JSON.stringify({ message }));
                return true;
            }
            wslog("send rejected — WS not OPEN (readyState=" + rs + ") → REST fallback");
            return false;
        },
        []
    );

    const disconnect = useCallback(() => {
        intentionalCloseRef.current = true;
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
        }
        setConnectionState(WsConnectionState.CLOSED);
        setIsStreaming(false);
        setStreamingContent("");
    }, []);

    return { connectionState, isStreaming, streamingContent, sendMessage, disconnect };
}
