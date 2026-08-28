import React, { useState, useRef, useEffect, type FormEvent } from "react";
import {
    Send,
    SquarePen,
    ChevronDown,
    Copy,
    Check,
    Download,
    RotateCcw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Spinner } from "@/components/ui/spinner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
    VerseLink,
    splitVerseReferences,
    loadBibleBooks,
} from "@/components/verse-link";
import { SettingsDialog } from "@/components/settings-dialog";
import {
    type ChatSession,
    getSessions,
    saveSession,
    deleteSession,
    generateId,
    getNickname,
    setNickname,
} from "@/lib/storage";
import { avatarUrl } from "@/lib/avatar";

const API_BASE = "/api";

const LESSON_LABELS: [string, string][] = [
    ["", "Semua Pelajaran"],
    ["1", "1 - Mencari Tuhan"],
    ["2", "2 - Firman Tuhan"],
    ["3", "3 - Pemuridan"],
    ["4", "4 - Dosa"],
    ["5", "5 - Pertobatan"],
    ["6", "6 - Salib"],
    ["7", "7 - Baptisan"],
    ["8", "8 - Jemaat/Gereja"],
    ["9", "9 - Roh Kudus"],
];

// const SECTION_LABELS: [string, string][] = [
//     ["", "Semua Section"],
//     ["objectives", "Tujuan"],
//     ["tips", "Tips"],
//     ["verses", "Ayat"],
//     ["keywords", "Kata Kunci"],
//     ["questions", "Pertanyaan"],
//     ["application", "Aplikasi"],
//     ["illustrations", "Ilustrasi"],
//     ["general", "Umum"],
// ];

interface Source {
    document_id: string;
    lesson_title: string;
    lesson_number: number;
    section_type: string;
    bible_verses: string[];
    images: string[];
}

interface Message {
    id?: string;
    role: "user" | "assistant";
    content: string;
    sources?: Source[];
}

export function ChatLayout() {
    const [sessions, setSessions] = useState<ChatSession[]>(getSessions);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [lessonFilter, setLessonFilter] = useState("");
    // const [sectionFilter, setSectionFilter] = useState("");
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [nickname, setNicknameState] = useState<string | null>(getNickname);
    const [showSettings, setShowSettings] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Sync activeId from URL hash on mount
    useEffect(() => {
        // Load Bible books (for verse-link detection) from the backend
        void loadBibleBooks();

        // Show settings/onboarding if no nickname set
        if (!getNickname()) {
            setShowSettings(true);
        }

        // Fetch suggestions for empty state
        fetch(`${API_BASE}/suggestions`)
            .then((r) => r.json())
            .then((data) => {
                if (data.success) setSuggestions(data.data);
            })
            .catch(() => {});

        const hash = window.location.hash.slice(1);
        if (hash) {
            const allSessions = getSessions();
            const found = allSessions.find((s) => s.id === hash);
            if (found) {
                setActiveId(found.id);
                setMessages(
                    (found.messages as Message[]).filter(
                        (m) => m.role === "user" || m.content,
                    ),
                );
            } else {
                window.history.replaceState(null, "", window.location.pathname);
            }
        }
    }, []);

    // Update URL hash when activeId changes
    useEffect(() => {
        const currentHash = window.location.hash.slice(1);
        if (activeId && currentHash !== activeId) {
            window.history.replaceState(null, "", `#${activeId}`);
        } else if (!activeId && currentHash) {
            window.history.replaceState(null, "", window.location.pathname);
        }
    }, [activeId]);

    // Listen for browser back/forward (hashchange)
    useEffect(() => {
        function onHashChange() {
            const hash = window.location.hash.slice(1);
            if (hash && hash !== activeId) {
                const allSessions = getSessions();
                const found = allSessions.find((s) => s.id === hash);
                if (found) {
                    setActiveId(found.id);
                    setMessages(found.messages as Message[]);
                } else {
                    setActiveId(null);
                    setMessages([]);
                }
            } else if (!hash) {
                setActiveId(null);
                setMessages([]);
            }
        }
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, [activeId]);

    useEffect(() => {
        if (activeId && messages.length > 0) {
            const session = sessions.find((s) => s.id === activeId);
            if (session) {
                session.messages = messages;
                const firstUser = messages.find((m) => m.role === "user");
                if (firstUser) session.title = firstUser.content.slice(0, 50);
                saveSession(session);
            }
        }
    }, [messages, activeId, sessions]);

    // Scroll to the newest message whenever the conversation changes or a
    // different session is opened (opening a long chat should land at the end).
    useEffect(() => {
        scrollToBottom();
    }, [messages, activeId]);

    function scrollToBottom() {
        // `scrollRef` points at the ScrollArea Root; the element that actually
        // scrolls is its inner Viewport. Grab it and pin to the bottom after the
        // browser has laid out the new content (double rAF = after paint).
        const pin = () => {
            const root = scrollRef.current;
            if (!root) return;
            const viewport = root.querySelector<HTMLElement>(
                '[data-slot="scroll-area-viewport"]',
            );
            const el = viewport ?? root;
            el.scrollTop = el.scrollHeight;
        };
        requestAnimationFrame(() => requestAnimationFrame(pin));
    }

    function startNewChat() {
        const id = generateId();
        const session: ChatSession = {
            id,
            title: "New Chat",
            messages: [],
            createdAt: Date.now(),
        };
        setSessions((prev) => [session, ...prev]);
        saveSession(session);
        setActiveId(id);
        setMessages([]);
        window.history.pushState(null, "", `#${id}`);
        inputRef.current?.focus();
    }

    function selectSession(id: string) {
        const session = sessions.find((s) => s.id === id);
        if (session) {
            setActiveId(id);
            setMessages(
                (session.messages as Message[]).filter(
                    (m) => m.role === "user" || m.content,
                ),
            );
            window.history.pushState(null, "", `#${id}`);
        }
    }

    function handleDeleteSession(id: string) {
        deleteSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (activeId === id) {
            setActiveId(null);
            setMessages([]);
        }
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const query = input.trim();
        if (!query || isLoading) return;

        if (!activeId) {
            const id = generateId();
            const session: ChatSession = {
                id,
                title: query.slice(0, 50),
                messages: [],
                createdAt: Date.now(),
            };
            setSessions((prev) => [session, ...prev]);
            saveSession(session);
            setActiveId(id);
            window.history.pushState(null, "", `#${id}`);
        }

        const userMsg: Message = { role: "user", content: query };
        const baseMessages = [...messages, userMsg];
        setMessages(baseMessages);
        setInput("");
        await streamAnswer(query, baseMessages);
    }

    /**
     * Stream an assistant answer for `query`, building conversation history from
     * `baseMessages` (the message list that should already be rendered, ending
     * with the user turn being answered). Shared by first-send and regenerate.
     */
    async function streamAnswer(query: string, baseMessages: Message[]) {
        setIsLoading(true);

        // Stable id for this request's assistant placeholder — declared here so
        // the catch/finally can target it precisely (not by content equality).
        const placeholderId = generateId();

        try {
            const history = baseMessages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .slice(-20)
                .map((m) => ({ role: m.role, content: m.content }));

            const body: Record<string, unknown> = { query, history };
            if (lessonFilter) body.lesson = parseInt(lessonFilter);
            // if (sectionFilter) body.section_type = sectionFilter;
            if (nickname) body.name = nickname;

            const controller = new AbortController();
            abortRef.current = controller;

            const res = await fetch(`${API_BASE}/query/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Request failed");
            }

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let fullAnswer = "";
            let sources: Source[] = [];
            let eventType = "";

            // Track the assistant placeholder by its stable id so concurrent
            // submit/stop cycles never update or remove the wrong bubble.
            const updatePlaceholder = () =>
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === placeholderId
                            ? {
                                  ...m,
                                  content: fullAnswer,
                                  sources,
                              }
                            : m,
                    ),
                );

            setMessages((prev) => [
                ...prev,
                { id: placeholderId, role: "assistant", content: "" },
            ]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith("data: ") && eventType) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (eventType === "meta")
                                sources = data.sources || [];
                            else if (eventType === "token") {
                                fullAnswer += data.delta;
                                updatePlaceholder();
                            } else if (eventType === "done") {
                                fullAnswer = data.answer || fullAnswer;
                                updatePlaceholder();
                            } else if (eventType === "error")
                                throw new Error(data.message);
                        } catch {
                            /* skip */
                        }
                        eventType = "";
                    }
                }
            }

            // If the stream ended without any content, drop the empty placeholder.
            if (!fullAnswer) {
                setMessages((prev) =>
                    prev.filter((m) => m.id !== placeholderId),
                );
            }
        } catch (err) {
            // Remove this request's placeholder (by id — never touches other bubbles).
            setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
            // Don't show an error bubble for a user-initiated abort.
            if ((err as Error).name !== "AbortError") {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: generateId(),
                        role: "assistant",
                        content: `❌ Error: ${(err as Error).message}`,
                    },
                ]);
            }
        } finally {
            setIsLoading(false);
            abortRef.current = null;
            inputRef.current?.focus();
        }
    }

    /**
     * Re-run the last user question, replacing the latest assistant answer.
     * Drops the trailing assistant message and re-streams from the prior history.
     */
    async function handleRegenerate() {
        if (isLoading) return;
        // Find the last user message and everything up to (and including) it.
        let lastUserIdx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "user") {
                lastUserIdx = i;
                break;
            }
        }
        if (lastUserIdx === -1) return;

        const query = messages[lastUserIdx].content;
        const baseMessages = messages.slice(0, lastUserIdx + 1);
        setMessages(baseMessages);
        await streamAnswer(query, baseMessages);
    }

    function handleStop() {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
    }

    function handleSuggestionClick(text: string) {
        setInput(text);
        // Trigger submit programmatically
        setTimeout(() => {
            const form = document.querySelector("form");
            if (form) form.requestSubmit();
        }, 0);
    }

    async function handleCopy(text: string, index: number) {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 1500);
        } catch {
            /* clipboard unavailable — ignore */
        }
    }

    function handlePrint() {
        // Trigger the browser's print dialog (user can "Save as PDF").
        window.print();
    }

    /**
     * Recursively process React children to detect Bible verse references
     * in text nodes and inject VerseLink components.
     */
    function renderWithVerses(children: React.ReactNode): React.ReactNode {
        return Array.isArray(children)
            ? children.map((child, i) => renderChild(child, i))
            : renderChild(children, 0);
    }

    function renderChild(child: React.ReactNode, key: number): React.ReactNode {
        if (typeof child !== "string") return child;
        const parts = splitVerseReferences(child);
        if (parts.length === 1 && parts[0].type === "text") return child;
        return (
            <span key={key}>
                {parts.map((part, j) =>
                    part.type === "verse" ? (
                        <VerseLink key={j} reference={part.value} />
                    ) : (
                        <span key={j}>{part.value}</span>
                    ),
                )}
            </span>
        );
    }

    return (
        <>
            <SettingsDialog
                open={showSettings}
                onOpenChange={setShowSettings}
                nickname={nickname}
                forceComplete={!nickname}
                onSaveNickname={(name) => {
                    setNickname(name);
                    setNicknameState(name);
                }}
            />

            <AppSidebar
                sessions={sessions}
                activeId={activeId}
                onSelect={selectSession}
                onNew={startNewChat}
                onDelete={handleDeleteSession}
                onOpenSettings={() => setShowSettings(true)}
            />
            <SidebarInset>
                <div className="relative flex h-svh flex-col">
                    {/* Floating toolbar (top-left like Gemini) */}
                    <div className="absolute left-4 top-4 z-10 flex items-center gap-1 print:hidden">
                        <SidebarTrigger />
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={startNewChat}
                            title="New chat"
                            aria-label="New chat"
                        >
                            <SquarePen className="size-4" />
                        </Button>
                    </div>

                    {/* Messages */}
                    <div className="min-h-0 flex-1">
                        <ScrollArea className="h-full" ref={scrollRef}>
                            <div className="mx-auto max-w-3xl space-y-4 px-6 pt-16 pb-6">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <DotLottieReact
                                            src="/book.lottie"
                                            autoplay
                                            loop={false}
                                            dotLottieRefCallback={(
                                                dotLottie,
                                            ) => {
                                                if (!dotLottie) return;
                                                let count = 0;
                                                dotLottie.addEventListener(
                                                    "complete",
                                                    () => {
                                                        count++;
                                                        if (count < 1) {
                                                            dotLottie.play();
                                                        } else {
                                                            setTimeout(() => {
                                                                count = 0;
                                                                dotLottie.play();
                                                            }, 10000);
                                                        }
                                                    },
                                                );
                                            }}
                                            className="mb-4 h-48 w-48"
                                        />
                                        <h2 className="mb-2 text-lg font-medium">
                                            {/* RAG */}
                                            Bible Study
                                        </h2>
                                        <p className="max-w-md text-sm text-muted-foreground">
                                            Tanyakan apa saja tentang kurikulum
                                            "Pelajaran Dasar-Dasar Utama".
                                        </p>
                                        {suggestions.length > 0 && (
                                            <div className="mt-6 flex flex-wrap justify-center gap-2">
                                                {suggestions.map((s, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() =>
                                                            handleSuggestionClick(
                                                                s,
                                                            )
                                                        }
                                                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {messages.map((msg, i) => {
                                    const isUser = msg.role === "user";
                                    if (!msg.content && !isUser) return null;
                                    const isLastMessage =
                                        i === messages.length - 1;
                                    return (
                                        <div
                                            key={i}
                                            className={cn(
                                                "group flex gap-3",
                                                isUser
                                                    ? "flex-row-reverse"
                                                    : "flex-row",
                                            )}
                                        >
                                            {isUser && (
                                                <div className="flex-shrink-0 pt-1">
                                                    <img
                                                        src={avatarUrl(
                                                            nickname,
                                                        )}
                                                        alt="Avatar"
                                                        className="h-8 w-8 rounded-full border border-border bg-muted"
                                                    />
                                                </div>
                                            )}
                                            <div
                                                className={cn(
                                                    "min-w-0 flex-1",
                                                    isUser &&
                                                        "flex justify-end",
                                                )}
                                            >
                                                {isUser ? (
                                                    <Bubble
                                                        variant="default"
                                                        align="end"
                                                    >
                                                        <BubbleContent>
                                                            <div className="whitespace-pre-wrap">
                                                                {msg.content}
                                                            </div>
                                                        </BubbleContent>
                                                    </Bubble>
                                                ) : (
                                                    <div>
                                                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 text-left">
                                                            <ReactMarkdown
                                                                remarkPlugins={[
                                                                    remarkGfm,
                                                                ]}
                                                                components={{
                                                                    table: ({
                                                                        children,
                                                                    }) => (
                                                                        <div className="my-2">
                                                                            <Table>
                                                                                {
                                                                                    children
                                                                                }
                                                                            </Table>
                                                                        </div>
                                                                    ),
                                                                    thead: ({
                                                                        children,
                                                                    }) => (
                                                                        <TableHeader>
                                                                            {
                                                                                children
                                                                            }
                                                                        </TableHeader>
                                                                    ),
                                                                    tbody: ({
                                                                        children,
                                                                    }) => (
                                                                        <TableBody>
                                                                            {
                                                                                children
                                                                            }
                                                                        </TableBody>
                                                                    ),
                                                                    tr: ({
                                                                        children,
                                                                    }) => (
                                                                        <TableRow>
                                                                            {
                                                                                children
                                                                            }
                                                                        </TableRow>
                                                                    ),
                                                                    th: ({
                                                                        children,
                                                                    }) => (
                                                                        <TableHead className="whitespace-normal align-top font-semibold">
                                                                            {renderWithVerses(
                                                                                children,
                                                                            )}
                                                                        </TableHead>
                                                                    ),
                                                                    td: ({
                                                                        children,
                                                                    }) => (
                                                                        <TableCell className="whitespace-normal align-top">
                                                                            {renderWithVerses(
                                                                                children,
                                                                            )}
                                                                        </TableCell>
                                                                    ),
                                                                    p: ({
                                                                        children,
                                                                        ...props
                                                                    }) => (
                                                                        <p
                                                                            {...props}
                                                                        >
                                                                            {renderWithVerses(
                                                                                children,
                                                                            )}
                                                                        </p>
                                                                    ),
                                                                    li: ({
                                                                        children,
                                                                        ...props
                                                                    }) => (
                                                                        <li
                                                                            {...props}
                                                                        >
                                                                            {renderWithVerses(
                                                                                children,
                                                                            )}
                                                                        </li>
                                                                    ),
                                                                    strong: ({
                                                                        children,
                                                                        ...props
                                                                    }) => (
                                                                        <strong
                                                                            {...props}
                                                                        >
                                                                            {renderWithVerses(
                                                                                children,
                                                                            )}
                                                                        </strong>
                                                                    ),
                                                                    em: ({
                                                                        children,
                                                                        ...props
                                                                    }) => (
                                                                        <em
                                                                            {...props}
                                                                        >
                                                                            {renderWithVerses(
                                                                                children,
                                                                            )}
                                                                        </em>
                                                                    ),
                                                                    h1: ({
                                                                        children,
                                                                        ...props
                                                                    }) => (
                                                                        <h1
                                                                            {...props}
                                                                        >
                                                                            {renderWithVerses(
                                                                                children,
                                                                            )}
                                                                        </h1>
                                                                    ),
                                                                    h2: ({
                                                                        children,
                                                                        ...props
                                                                    }) => (
                                                                        <h2
                                                                            {...props}
                                                                        >
                                                                            {renderWithVerses(
                                                                                children,
                                                                            )}
                                                                        </h2>
                                                                    ),
                                                                    h3: ({
                                                                        children,
                                                                        ...props
                                                                    }) => (
                                                                        <h3
                                                                            {...props}
                                                                        >
                                                                            {renderWithVerses(
                                                                                children,
                                                                            )}
                                                                        </h3>
                                                                    ),
                                                                    h4: ({
                                                                        children,
                                                                        ...props
                                                                    }) => (
                                                                        <h4
                                                                            {...props}
                                                                        >
                                                                            {renderWithVerses(
                                                                                children,
                                                                            )}
                                                                        </h4>
                                                                    ),
                                                                }}
                                                            >
                                                                {msg.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                        {msg.sources &&
                                                            msg.sources.some(
                                                                (s) =>
                                                                    s.images
                                                                        ?.length >
                                                                    0,
                                                            ) &&
                                                            !(
                                                                isLoading &&
                                                                i ===
                                                                    messages.length -
                                                                        1
                                                            ) && (
                                                                <div className="mt-3 flex flex-wrap gap-2 text-left">
                                                                    {msg.sources
                                                                        .flatMap(
                                                                            (
                                                                                s,
                                                                            ) =>
                                                                                s.images ||
                                                                                [],
                                                                        )
                                                                        .map(
                                                                            (
                                                                                url,
                                                                                k,
                                                                            ) => (
                                                                                <img
                                                                                    key={
                                                                                        k
                                                                                    }
                                                                                    src={
                                                                                        url
                                                                                    }
                                                                                    alt="Ilustrasi"
                                                                                    className="h-24 w-auto cursor-zoom-in rounded-md border border-border object-contain hover:opacity-80 transition-opacity"
                                                                                    onClick={() => {
                                                                                        const allImages =
                                                                                            msg
                                                                                                .sources!.flatMap(
                                                                                                    (
                                                                                                        s,
                                                                                                    ) =>
                                                                                                        s.images ||
                                                                                                        [],
                                                                                                )
                                                                                                .map(
                                                                                                    (
                                                                                                        src,
                                                                                                    ) => ({
                                                                                                        src,
                                                                                                    }),
                                                                                                );
                                                                                        setLightboxSlides(
                                                                                            allImages,
                                                                                        );
                                                                                        setLightboxIndex(
                                                                                            k,
                                                                                        );
                                                                                        setLightboxOpen(
                                                                                            true,
                                                                                        );
                                                                                    }}
                                                                                />
                                                                            ),
                                                                        )}
                                                                </div>
                                                            )}
                                                        {!(
                                                            isLoading &&
                                                            isLastMessage
                                                        ) && (
                                                            <div
                                                                className={cn(
                                                                    "mt-2 flex items-center gap-1 text-muted-foreground transition-opacity print:hidden",
                                                                    // Gemini-style: the current (last) response keeps its
                                                                    // actions visible; older ones reveal on hover.
                                                                    isLastMessage
                                                                        ? "opacity-100"
                                                                        : "opacity-0 focus-within:opacity-100 group-hover:opacity-100",
                                                                )}
                                                            >
                                                                {isLastMessage && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={
                                                                            handleRegenerate
                                                                        }
                                                                        disabled={
                                                                            isLoading
                                                                        }
                                                                        title="Buat ulang jawaban"
                                                                        aria-label="Buat ulang jawaban"
                                                                        className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                                                                    >
                                                                        <RotateCcw className="size-4" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleCopy(
                                                                            msg.content,
                                                                            i,
                                                                        )
                                                                    }
                                                                    title="Copy response"
                                                                    aria-label="Copy response"
                                                                    className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
                                                                >
                                                                    {copiedIndex ===
                                                                    i ? (
                                                                        <Check className="size-4 text-lime-500" />
                                                                    ) : (
                                                                        <Copy className="size-4" />
                                                                    )}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={
                                                                        handlePrint
                                                                    }
                                                                    title="Export PDF"
                                                                    aria-label="Export PDF"
                                                                    className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
                                                                >
                                                                    <Download className="size-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {isLoading &&
                                    messages[messages.length - 1]?.content ===
                                        "" && (
                                        <Marker role="status">
                                            <MarkerIcon>
                                                <Spinner />
                                            </MarkerIcon>
                                            <MarkerContent className="shimmer">
                                                Sedang berpikir...
                                            </MarkerContent>
                                        </Marker>
                                    )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Input with Gemini-style fade backdrop */}
                    <div className="relative bg-background print:hidden">
                        {/* Gradient fade so messages blur out behind the input */}
                        <div className="pointer-events-none absolute -top-16 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
                        <div className="mx-auto w-full max-w-3xl px-6 py-3">
                            <form
                                onSubmit={handleSubmit}
                                className="flex items-center gap-2 rounded-2xl border bg-muted/50 px-4 py-2 shadow-lg shadow-black/5 backdrop-blur-sm"
                            >
                                <input
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ketik pertanyaan..."
                                    disabled={isLoading}
                                    className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
                                    autoFocus
                                />
                                <DropdownMenu>
                                    <DropdownMenuTrigger className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-transparent px-2.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                                        {
                                            LESSON_LABELS.find(
                                                ([v]) => v === lessonFilter,
                                            )?.[1]
                                        }
                                        <ChevronDown className="size-3.5" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="min-w-[180px]"
                                    >
                                        <DropdownMenuRadioGroup
                                            value={lessonFilter}
                                            onValueChange={setLessonFilter}
                                        >
                                            {LESSON_LABELS.map(
                                                ([value, label]) => (
                                                    <DropdownMenuRadioItem
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {label}
                                                    </DropdownMenuRadioItem>
                                                ),
                                            )}
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                {/* Section filter - disabled for now
                            <DropdownMenu>
                                <DropdownMenuTrigger className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border bg-transparent px-2.5 text-[10px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                                    {
                                        SECTION_LABELS.find(
                                            ([v]) => v === sectionFilter,
                                        )?.[1]
                                    }
                                    <ChevronDown className="size-3" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="min-w-[160px]"
                                >
                                    <DropdownMenuRadioGroup
                                        value={sectionFilter}
                                        onValueChange={setSectionFilter}
                                    >
                                        {SECTION_LABELS.map(
                                            ([value, label]) => (
                                                <DropdownMenuRadioItem
                                                    key={value}
                                                    value={value}
                                                >
                                                    {label}
                                                </DropdownMenuRadioItem>
                                            ),
                                        )}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            */}
                                {isLoading ? (
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="destructive"
                                        className="shrink-0 rounded-full"
                                        onClick={handleStop}
                                    >
                                        <svg
                                            className="size-4"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                        >
                                            <rect
                                                x="6"
                                                y="6"
                                                width="12"
                                                height="12"
                                                rx="2"
                                            />
                                        </svg>
                                    </Button>
                                ) : (
                                    <Button
                                        type="submit"
                                        size="icon-sm"
                                        className="shrink-0 rounded-full"
                                        disabled={!input.trim()}
                                    >
                                        <Send className="size-4" />
                                    </Button>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            </SidebarInset>
            <Lightbox
                open={lightboxOpen}
                close={() => setLightboxOpen(false)}
                index={lightboxIndex}
                slides={lightboxSlides}
            />
        </>
    );
}
