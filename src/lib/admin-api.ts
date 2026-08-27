const API_BASE = "/api";

const AUTH_KEY = "bible-admin-auth";

/** Store base64-encoded "user:pass" credentials for admin requests. */
export function setAdminCredentials(user: string, pass: string) {
    sessionStorage.setItem(AUTH_KEY, btoa(`${user}:${pass}`));
}

export function getAdminAuthHeader(): Record<string, string> {
    const token = sessionStorage.getItem(AUTH_KEY);
    return token ? { Authorization: `Basic ${token}` } : {};
}

/** Whether admin credentials are currently stored (i.e. the user has logged in). */
export function hasAdminCredentials(): boolean {
    return !!sessionStorage.getItem(AUTH_KEY);
}

export function clearAdminCredentials() {
    sessionStorage.removeItem(AUTH_KEY);
}

/** Thrown when the server rejects credentials (401). */
export class UnauthorizedError extends Error {
    constructor() {
        super("Unauthorized");
        this.name = "UnauthorizedError";
    }
}

export interface DocumentImage {
    url: string;
    public_id: string;
}

export interface BibleDocument {
    _id: string;
    content: string;
    section_type: string;
    lesson_number: number | null;
    lesson_title: string;
    bible_verses: string[];
    tags: string[];
    images?: DocumentImage[];
    indexed: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface DocumentInput {
    content: string;
    section_type: string;
    lesson_number: number | null;
    lesson_title: string;
    bible_verses: string[];
    tags: string[];
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export const SECTION_TYPES = [
    "objectives",
    "tips",
    "verses",
    "keywords",
    "questions",
    "application",
    "illustrations",
    "general",
] as const;

export async function listDocuments(params: {
    lesson?: string;
    section_type?: string;
    search?: string;
    page?: number;
    limit?: number;
}): Promise<{ documents: BibleDocument[]; pagination: Pagination }> {
    const q = new URLSearchParams();
    if (params.lesson) q.set("lesson", params.lesson);
    if (params.section_type) q.set("section_type", params.section_type);
    if (params.search) q.set("search", params.search);
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));

    const res = await fetch(`${API_BASE}/documents?${q.toString()}`, {
        headers: getAdminAuthHeader(),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) throw new Error("Failed to fetch documents");
    return res.json();
}

export async function createDocument(
    doc: DocumentInput,
): Promise<BibleDocument> {
    const res = await fetch(`${API_BASE}/documents`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAdminAuthHeader(),
        },
        body: JSON.stringify(doc),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create document");
    }
    const data = await res.json();
    return data.document;
}

export async function updateDocument(
    id: string,
    doc: Partial<DocumentInput>,
): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...getAdminAuthHeader(),
        },
        body: JSON.stringify(doc),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update document");
    }
}

export async function deleteDocument(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
        method: "DELETE",
        headers: getAdminAuthHeader(),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete document");
    }
}

export interface ChunkPreview {
    index: number;
    text: string;
    verse_refs: string[];
    chars: number;
}

/** Preview how content will be chunked + which verse refs are detected (no save). */
export async function previewChunks(content: string): Promise<ChunkPreview[]> {
    const res = await fetch(`${API_BASE}/documents/preview-chunks`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAdminAuthHeader(),
        },
        body: JSON.stringify({ content }),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to preview chunks");
    }
    const data = await res.json();
    return data.chunks;
}

export async function getStatus(): Promise<{
    indexed: boolean;
    lastIndexedAt: string | null;
    totalDocuments: number;
    indexedDocuments: number;
    totalChunks: number;
}> {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error("Failed to fetch status");
    const data = await res.json();
    return data.status;
}

export async function triggerIngest(): Promise<void> {
    const res = await fetch(`${API_BASE}/ingest`, {
        method: "POST",
        headers: getAdminAuthHeader(),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to ingest");
    }
}

export async function uploadImages(
    id: string,
    files: File[],
): Promise<DocumentImage[]> {
    const form = new FormData();
    files.forEach((f) => form.append("images", f));

    const res = await fetch(`${API_BASE}/documents/${id}/images`, {
        method: "POST",
        headers: getAdminAuthHeader(),
        body: form,
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload images");
    }
    const data = await res.json();
    return data.images;
}

export async function deleteImage(id: string, publicId: string): Promise<void> {
    const res = await fetch(`${API_BASE}/documents/${id}/images`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            ...getAdminAuthHeader(),
        },
        body: JSON.stringify({ public_id: publicId }),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete image");
    }
}
