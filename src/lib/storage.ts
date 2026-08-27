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

// ─── Saved verses (bookmarks) ────────────────────────────────────────────────

export interface SavedVerse {
    reference: string; // canonical, e.g. "Yohanes 3:16"
    text: string; // verse text at save time
    savedAt: number;
}

const BOOKMARKS_KEY = "bible-study-bookmarks";

export function getBookmarks(): SavedVerse[] {
    try {
        const raw = localStorage.getItem(BOOKMARKS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function isBookmarked(reference: string): boolean {
    return getBookmarks().some((b) => b.reference === reference);
}

/**
 * Add a bookmark (no-op if the reference is already saved). Returns the new list.
 * `savedAt` is stamped here so callers (components) never touch Date.now().
 */
export function addBookmark(verse: {
    reference: string;
    text: string;
}): SavedVerse[] {
    const list = getBookmarks();
    if (list.some((b) => b.reference === verse.reference)) return list;
    const next = [{ ...verse, savedAt: Date.now() }, ...list].slice(0, 200);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    return next;
}

/** Remove a bookmark by reference. Returns the new list. */
export function removeBookmark(reference: string): SavedVerse[] {
    const next = getBookmarks().filter((b) => b.reference !== reference);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    return next;
}

/** Toggle a bookmark. Returns true if now saved, false if removed. */
export function toggleBookmark(verse: {
    reference: string;
    text: string;
}): boolean {
    if (isBookmarked(verse.reference)) {
        removeBookmark(verse.reference);
        return false;
    }
    addBookmark(verse);
    return true;
}
