import { useState, useEffect, useRef, useCallback } from "react";
import { WS_URL } from "@/config/env";

interface UseMentorSocketOptions {
    sessionId: string | null;
    onToken?: (token: string) => void;
    onDone?: (content: string, chatId: string) => void;
    onError?: (message: string) => void;
    onTyping?: () => void;
}

export function useMentorSocket({
    sessionId,
    onToken,
    onDone,
    onError,
    onTyping,
}: UseMentorSocketOptions) {
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const backoffRef = useRef(3000); // Start at 3s, exponential up to 30s

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
        if (!sessionId) return;

        // Clean up any existing connection before creating a new one
        if (wsRef.current) {
            wsRef.current.onclose = null; // Prevent reconnect from old close
            wsRef.current.close();
        }

        try {
            const ws = new WebSocket(`${WS_URL}/ws/chat/${sessionId}`);

            ws.onopen = () => {
                setIsConnected(true);
                setIsSupported(true);
                backoffRef.current = 3000; // Reset backoff on successful connect
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    switch (data.type) {
                        case "token":
                            onTokenRef.current?.(data.content);
                            break;
                        case "done":
                            onDoneRef.current?.(data.content, data.chat_id);
                            break;
                        case "error":
                            onErrorRef.current?.(data.content);
                            break;
                        case "typing":
                            onTypingRef.current?.();
                            break;
                    }
                } catch {
                    // Ignore parse errors
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                // Auto-reconnect with exponential backoff
                const delay = backoffRef.current;
                backoffRef.current = Math.min(delay * 2, 30000);
                reconnectTimer.current = setTimeout(() => {
                    connect();
                }, delay);
            };

            ws.onerror = () => {
                setIsSupported(false);
                ws.close();
            };

            wsRef.current = ws;
        } catch {
            setIsSupported(false);
        }
    }, [sessionId]); // Only reconnect when sessionId changes

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (wsRef.current) {
                wsRef.current.onclose = null; // Prevent reconnect on intentional close
                wsRef.current.close();
            }
        };
    }, [connect]);

    const sendMessage = useCallback(
        (message: string) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ message }));
                return true;
            }
            return false;
        },
        []
    );

    const disconnect = useCallback(() => {
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
        }
        setIsConnected(false);
    }, []);

    return { isConnected, isSupported, sendMessage, disconnect };
}
