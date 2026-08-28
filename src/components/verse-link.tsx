import { useState } from "react";
import { BookOpen, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Selected Bible version (module-level so both fetch helpers share it).
let currentVersion = "id_tb";

export function setBibleVersion(version: string) {
    if (version && version !== currentVersion) {
        currentVersion = version;
        verseRegex = null; // rebuild book regex for the new version
        void loadBibleBooks();
    }
}

export function getBibleVersion() {
    return currentVersion;
}

interface VerseData {
    verse: number;
    text: string;
}

interface VerseLinkProps {
    reference: string; // e.g. "Kejadian 1:1" or "Matius 28:19-20"
}

/**
 * Parse a Bible reference string into API-compatible params.
 * Supports: "Kejadian 1:1", "1 Korintus 13:4-7", "Mazmur 23:1,4"
 */
function parseReference(ref: string): {
    book: string;
    chapter: string;
    verse: string;
} | null {
    // Pattern: [optional "1 " or "2 "] BookName Chapter:Verse[-Verse]
    const match = ref.match(
        /^(\d\s+)?(.+?)\s+(\d{1,3}):(\d{1,3}(?:\s*-\s*\d{1,3})?)$/,
    );
    if (!match) return null;

    const prefix = match[1]?.trim() || "";
    const bookName = prefix ? `${prefix} ${match[2]}` : match[2];
    const chapter = match[3];
    const verse = match[4].replace(/\s/g, "");

    return { book: bookName, chapter, verse };
}

/** Which verse numbers a reference points at (for highlighting in chapter view). */
function referencedVerseSet(ref: string): Set<number> {
    const parsed = parseReference(ref);
    const set = new Set<number>();
    if (!parsed) return set;
    // parsed.verse is like "16" or "19-20"; expand ranges.
    for (const part of parsed.verse.split(",")) {
        const m = part.match(/^(\d+)(?:-(\d+))?$/);
        if (!m) continue;
        const s = parseInt(m[1], 10);
        const e = m[2] != null ? parseInt(m[2], 10) : s;
        for (let v = Math.min(s, e); v <= Math.max(s, e); v++) set.add(v);
    }
    return set;
}

export function VerseLink({ reference }: VerseLinkProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [verses, setVerses] = useState<VerseData[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Whether the popover currently shows the full chapter vs just the reference.
    const [chapterMode, setChapterMode] = useState(false);

    async function fetchVerse() {
        if (verses && !chapterMode) {
            setOpen(!open);
            return;
        }

        const parsed = parseReference(reference);
        if (!parsed) {
            setError("Format ayat tidak dikenali");
            setOpen(true);
            return;
        }

        setLoading(true);
        setOpen(true);
        setError(null);
        setChapterMode(false);

        try {
            const url = `/api/verses/${encodeURIComponent(parsed.book)}/${parsed.chapter}/${parsed.verse}?version=${currentVersion}`;
            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Gagal mengambil ayat");
                return;
            }

            // Single verse response
            if (data.text) {
                setVerses([{ verse: data.verse, text: data.text }]);
            }
            // Multiple verses (chapter or range)
            else if (data.data) {
                setVerses(
                    data.data.map((v: { verse: number; text: string }) => ({
                        verse: v.verse,
                        text: v.text,
                    })),
                );
            }
        } catch {
            setError("Gagal terhubung ke server");
        } finally {
            setLoading(false);
        }
    }

    async function fetchChapter() {
        const parsed = parseReference(reference);
        if (!parsed) return;

        setLoading(true);
        setError(null);

        try {
            const url = `/api/verses/${encodeURIComponent(parsed.book)}/${parsed.chapter}?version=${currentVersion}`;
            const res = await fetch(url);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Gagal mengambil pasal");
                return;
            }
            if (data.data) {
                setVerses(
                    data.data.map((v: { verse: number; text: string }) => ({
                        verse: v.verse,
                        text: v.text,
                    })),
                );
                setChapterMode(true);
            }
        } catch {
            setError("Gagal terhubung ke server");
        } finally {
            setLoading(false);
        }
    }

    const referenced = referencedVerseSet(reference);

    return (
        <span className="inline">
            <button
                onClick={fetchVerse}
                className={cn(
                    "inline-flex cursor-pointer items-center gap-0.5 rounded px-1 align-middle transition-colors",
                    // Highlight the reference label itself while the popover is
                    // open, so it's clear which verse is currently shown.
                    open
                        ? "bg-lime-300 text-black"
                        : "text-inherit hover:bg-accent",
                )}
                title={`Lihat ${reference}`}
                type="button"
            >
                {reference}
                <BookOpen
                    className={cn(
                        "size-3.5",
                        // When highlighted, inherit the dark label color so the
                        // icon stays visible on the lime background (esp. dark mode).
                        open ? "text-current" : "text-primary/70",
                    )}
                />
            </button>
            {open && (
                <span className="relative mt-1 block rounded-lg border border-border bg-muted/50 py-2 pl-3 pr-8 text-xs font-normal">
                    <button
                        onClick={() => setOpen(false)}
                        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                        type="button"
                        aria-label="Tutup"
                    >
                        <X className="size-3" />
                    </button>
                    {loading && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" />
                            Memuat...
                        </span>
                    )}
                    {error && <span className="text-destructive">{error}</span>}
                    {verses && (
                        <span
                            className={cn(
                                "block space-y-0.5 text-foreground/90",
                                chapterMode && "max-h-64 overflow-y-auto pr-1",
                            )}
                        >
                            {verses.map((v) => {
                                // In chapter view, dim verses that weren't the
                                // referenced ones so the cited verse stands out.
                                const isRef =
                                    !chapterMode || referenced.has(v.verse);
                                return (
                                    <span
                                        key={v.verse}
                                        className={cn(
                                            "block",
                                            !isRef && "opacity-50",
                                        )}
                                    >
                                        <span className="font-medium text-muted-foreground">
                                            {v.verse}.
                                        </span>{" "}
                                        {v.text}
                                    </span>
                                );
                            })}
                        </span>
                    )}
                    {verses && !loading && !error && (
                        <span className="mt-2 flex items-center justify-end">
                            <button
                                type="button"
                                onClick={
                                    chapterMode ? fetchVerse : fetchChapter
                                }
                                className="text-[11px] font-medium text-primary hover:underline"
                            >
                                {chapterMode
                                    ? "← Kembali ke ayat"
                                    : "Baca 1 pasal penuh"}
                            </button>
                        </span>
                    )}
                </span>
            )}
        </span>
    );
}

// The verse-reference regex is built dynamically from the Bible books returned
// by the backend (`/verses/books`), so book names & abbreviations stay in sync
// with the database — no hardcoded list to maintain here.
let verseRegex: RegExp | null = null;

function buildVerseRegex(books: string[]) {
    const sorted = [...books]
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)
        .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (sorted.length === 0) return;
    verseRegex = new RegExp(
        `(\\d\\s+)?(?:${sorted.join("|")})\\s+\\d{1,3}:\\d{1,3}(?:\\s*-\\s*\\d{1,3})?`,
        "g",
    );
}

/** Fetch book names + abbreviations from the backend and build the regex. */
export async function loadBibleBooks() {
    if (verseRegex) return; // already loaded
    try {
        const res = await fetch(`/api/verses/books?version=${currentVersion}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
            const names: string[] = [];
            for (const b of data.data) {
                if (b.name_id) names.push(b.name_id);
                if (b.name_en) names.push(b.name_en);
                if (b.abbr) names.push(b.abbr);
            }
            buildVerseRegex(names);
        }
    } catch {
        /* silently ignore — verse links just won't render until loaded */
    }
}

/**
 * Split text into parts: plain text and verse references.
 * Returns an array of {type: 'text'|'verse', value: string}
 */
export function splitVerseReferences(
    text: string,
): { type: "text" | "verse"; value: string }[] {
    // Regex not ready yet (books still loading) — return text as-is.
    if (!verseRegex) return [{ type: "text", value: text }];

    const parts: { type: "text" | "verse"; value: string }[] = [];
    let lastIndex = 0;

    const regex = new RegExp(verseRegex.source, "g");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                type: "text",
                value: text.slice(lastIndex, match.index),
            });
        }
        parts.push({ type: "verse", value: match[0] });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push({ type: "text", value: text.slice(lastIndex) });
    }

    return parts;
}
