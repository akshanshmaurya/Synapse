/**
 * API Service
 * Handles all backend API calls with authentication
 */

const API_URL = 'http://localhost:8000';

// Helper to get auth headers
const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Chat API
export const sendMessage = async (message: string): Promise<string> => {
    const token = localStorage.getItem('auth_token');
    const endpoint = token ? '/api/chat' : '/api/chat/guest';

    const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify({ message }),
    });

    if (!response.ok) {
        throw new Error('Failed to send message');
    }

    const data = await response.json();
    return data.response;
};

// Legacy function for backward compatibility
export const sendMessageWithUserId = async (userId: string, message: string): Promise<string> => {
    return sendMessage(message);
};

// TTS API
export const streamAudio = async (text: string): Promise<HTMLAudioElement | null> => {
    try {
        const response = await fetch(`${API_URL}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) return null;

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        return new Audio(url);
    } catch (error) {
        console.error('TTS Error:', error);
        return null;
    }
};

// User API
export const fetchUserState = async (): Promise<any> => {
    try {
        const response = await fetch(`${API_URL}/api/user/me`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Fetch User Error:', error);
        return null;
    }
};

export const fetchUserMemory = async (): Promise<any> => {
    try {
        const response = await fetch(`${API_URL}/api/user/memory`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.memory;
    } catch (error) {
        console.error('Fetch Memory Error:', error);
        return null;
    }
};

// Dashboard Data Types
export interface DashboardData {
    momentum: {
        state: "starting" | "building" | "steady" | "accelerating";
        insight: string;
        metrics: {
            sessions_this_week: number;
            roadmap_progress: number;
            clarity_trend: "low" | "moderate" | "high";
        };
    };
    next_bloom: {
        title: string;
        description: string;
        source: "roadmap" | "inferred";
        action_hint?: string;
    } | null;
    recent_signals: {
        observation: string;
        timestamp: string;
        type: "pattern" | "progress" | "struggle";
        severity?: "mild" | "moderate" | "significant";
    }[];
    show_daily_nurture: boolean;
    daily_nurture_prompt: string | null;
}


export const fetchDashboardData = async (): Promise<DashboardData | null> => {
    try {
        const response = await fetch(`${API_URL}/api/user/dashboard`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Fetch Dashboard Error:', error);
        return null;
    }
};

export const updateUserProfile = async (interests?: string[], goals?: string[]): Promise<boolean> => {
    try {
        const params = new URLSearchParams();
        if (interests) params.append('interests', JSON.stringify(interests));
        if (goals) params.append('goals', JSON.stringify(goals));

        const response = await fetch(`${API_URL}/api/user/profile?${params}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
        });
        return response.ok;
    } catch (error) {
        console.error('Update Profile Error:', error);
        return false;
    }
};

// Roadmap API
export const fetchRoadmap = async (): Promise<any> => {
    try {
        const response = await fetch(`${API_URL}/api/roadmap/current`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.roadmap;
    } catch (error) {
        console.error('Fetch Roadmap Error:', error);
        return null;
    }
};

export const generateRoadmap = async (goal: string, context?: string): Promise<any> => {
    try {
        const response = await fetch(`${API_URL}/api/roadmap/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
            },
            body: JSON.stringify({ goal, context }),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.roadmap;
    } catch (error) {
        console.error('Generate Roadmap Error:', error);
        return null;
    }
};

export const submitRoadmapFeedback = async (
    roadmapId: string,
    stepId: string,
    feedbackType: string,
    message?: string
): Promise<boolean> => {
    try {
        const response = await fetch(`${API_URL}/api/roadmap/feedback?roadmap_id=${roadmapId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders(),
            },
            body: JSON.stringify({ step_id: stepId, feedback_type: feedbackType, message }),
        });
        return response.ok;
    } catch (error) {
        console.error('Submit Feedback Error:', error);
        return false;
    }
};

export const regenerateRoadmap = async (roadmapId: string): Promise<any> => {
    try {
        const response = await fetch(`${API_URL}/api/roadmap/regenerate?roadmap_id=${roadmapId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.roadmap;
    } catch (error) {
        console.error('Regenerate Roadmap Error:', error);
        return null;
    }
};
