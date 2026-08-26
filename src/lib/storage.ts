export interface ChatSession {
    id: string;
    title: string;
    messages: {
        role: "user" | "assistant";
        content: string;
        sources?: unknown[];
    }[];
    createdAt: number;
}

const STORAGE_KEY = "bible-study-chat-history";

export function getSessions(): ChatSession[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveSession(session: ChatSession) {
    const sessions = getSessions();
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
        sessions[idx] = session;
    } else {
        sessions.unshift(session);
    }
    // Keep max 50 sessions
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 50)));
}

export function deleteSession(id: string) {
    const sessions = getSessions().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Nickname storage
const NICKNAME_KEY = "bible-study-nickname";

export function getNickname(): string | null {
    return localStorage.getItem(NICKNAME_KEY);
}

export function setNickname(name: string) {
    localStorage.setItem(NICKNAME_KEY, name);
}
