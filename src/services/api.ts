import { API_URL } from '@/config/env';


// Chat API

interface ChatResult {
    response: string;
    chatId: string | null;
}

export async function sendMessage(message: string, chatId?: string): Promise<ChatResult> {
    const body: any = { message };
    if (chatId) body.chat_id = chatId;

    const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Chat failed: ${response.status}`);
    }

    const data = await response.json();
    return {
        response: data.response,
        chatId: data.chat_id || null,
    };
}

// Legacy function for backward compatibility
export async function sendMessageWithUserId(userId: string, message: string): Promise<string> {
    const result = await sendMessage(message);
    return result.response;
}

// Chat History API

export interface ChatSession {
    _id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    message_count: number;
    last_message_preview: string | null;
}

export interface ChatMessage {
    _id: string;
    chat_id: string;
    sender: 'user' | 'mentor';
    content: string;
    timestamp: string;
}

export async function fetchChatSessions(limit: number = 20, offset: number = 0): Promise<ChatSession[]> {
    const response = await fetch(
        `${API_URL}/api/chats?limit=${limit}&offset=${offset}`,
        { credentials: 'include' },
    );

    if (!response.ok) {
        console.error('Failed to fetch chat sessions:', response.status);
        return [];
    }

    const data = await response.json();
    return data.chats || [];
}

export async function fetchChatMessages(chatId: string, limit: number = 50): Promise<ChatMessage[]> {
    const response = await fetch(
        `${API_URL}/api/chats/${chatId}/messages?limit=${limit}`,
        { credentials: 'include' },
    );

    if (!response.ok) {
        console.error('Failed to fetch messages:', response.status);
        return [];
    }

    const data = await response.json();
    return data.messages || [];
}

export async function createChatSession(title?: string): Promise<string | null> {
    try {
        const response = await fetch(`${API_URL}/api/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title: title || 'New Conversation' }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.chat_id;
    } catch (error) {
        console.error('Failed to create chat session:', error);
        return null;
    }
}

export async function deleteChatSession(chatId: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_URL}/api/chats/${chatId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        return response.ok;
    } catch {
        return false;
    }
}

// TTS API
export async function streamAudio(text: string): Promise<HTMLAudioElement | null> {
    try {
        const response = await fetch(`${API_URL}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text }),
        });

        if (!response.ok) return null;

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        return new Audio(audioUrl);
    } catch {
        return null;
    }
}

// User API
export async function fetchUserState(): Promise<any> {
    try {
        const response = await fetch(`${API_URL}/api/user/me`, {
            credentials: 'include',
        });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

export async function fetchUserMemory(): Promise<any> {
    try {
        const response = await fetch(`${API_URL}/api/user/memory`, {
            credentials: 'include',
        });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

// Dashboard Data Types

export interface DashboardData {
    momentum: {
        state: "starting" | "building" | "steady" | "accelerating" | "struggling";
        insight: string;
        metrics: {
            clarity_score: number;
            confusion_trend: string;
            understanding_delta: number;
            understanding_trend?: string;
        };
    };
    effort: {
        total_sessions: number;
        consistency_streak: number;
        persistence_score: number;
        label: string;
        persistence_label?: string;
        sessions_this_week?: number;
        note?: string;
    };
    next_bloom: {
        title: string;
        description: string;
        source: string;
        action_hint?: string;
    };
    recent_signals: {
        observation: string;
        timestamp: string;
        type: "pattern" | "progress" | "struggle";
        severity?: "mild" | "moderate" | "significant";
    }[];
    show_daily_nurture: boolean;
    daily_nurture_prompt: string | null;
}

export async function fetchDashboardData(): Promise<DashboardData | null> {
    try {
        const response = await fetch(`${API_URL}/api/user/dashboard`, {
            credentials: 'include',
        });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

export async function updateUserProfile(interests?: string[], goals?: string[]): Promise<boolean> {
    try {
        const params = new URLSearchParams();
        if (interests) interests.forEach((i) => params.append('interests', i));
        if (goals) goals.forEach((g) => params.append('goals', g));

        const response = await fetch(`${API_URL}/api/user/profile?${params}`, {
            method: 'PUT',
            credentials: 'include',
        });
        return response.ok;
    } catch {
        return false;
    }
}

// Roadmap API
export async function fetchRoadmap(): Promise<any> {
    try {
        const response = await fetch(`${API_URL}/api/roadmap/current`, {
            credentials: 'include',
        });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

export async function generateRoadmap(goal: string, context?: string): Promise<any> {
    try {
        const body: any = { goal };
        if (context) body.context = context;

        const response = await fetch(`${API_URL}/api/roadmap/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
        });

        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

export async function submitRoadmapFeedback(
    roadmapId: string,
    stepId: string,
    feedbackType: string,
    message?: string,
): Promise<boolean> {
    try {
        const body: any = {
            step_id: stepId,
            feedback_type: feedbackType,
        };
        if (message) body.message = message;

        const response = await fetch(`${API_URL}/api/roadmap/feedback/${roadmapId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
        });
        return response.ok;
    } catch {
        return false;
    }
}

export async function regenerateRoadmap(roadmapId: string): Promise<any> {
    try {
        const response = await fetch(`${API_URL}/api/roadmap/regenerate/${roadmapId}`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

// Analytics API

export interface AnalyticsData {
    clarity_trend: { index: number; date: string; score: number }[];
    confusion_trend: { index: number; date: string; trend: string }[];
    session_activity: { date: string; sessions: number }[];
    struggles: { topic: string; severity: string; count: number }[];
    summary: {
        current_clarity: number;
        current_trend: string;
        learning_pace: string;
        stage: string;
        total_sessions: number;
        total_evaluations: number;
        roadmap_regenerations: number;
    };
}

export async function fetchAnalyticsData(): Promise<AnalyticsData | null> {
    try {
        const response = await fetch(`${API_URL}/api/analytics/learning`, {
            credentials: 'include',
        });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}
