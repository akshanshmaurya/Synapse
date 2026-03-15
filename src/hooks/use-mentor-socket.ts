import { useState, useEffect, useRef, useCallback } from "react";

const WS_URL = "ws://localhost:8000";

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

    const connect = useCallback(() => {
        if (!sessionId) return;

        try {
            const ws = new WebSocket(`${WS_URL}/ws/chat/${sessionId}`);

            ws.onopen = () => {
                setIsConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    switch (data.type) {
                        case "token":
                            onToken?.(data.content);
                            break;
                        case "done":
                            onDone?.(data.content, data.chat_id);
                            break;
                        case "error":
                            onError?.(data.content);
                            break;
                        case "typing":
                            onTyping?.();
                            break;
                    }
                } catch {
                    // Ignore parse errors
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                // Auto-reconnect after 3 seconds
                reconnectTimer.current = setTimeout(() => {
                    connect();
                }, 3000);
            };

            ws.onerror = () => {
                setIsSupported(false);
                ws.close();
            };

            wsRef.current = ws;
        } catch {
            setIsSupported(false);
        }
    }, [sessionId, onToken, onDone, onError, onTyping]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
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
        wsRef.current?.close();
        setIsConnected(false);
    }, []);

    return { isConnected, isSupported, sendMessage, disconnect };
}
