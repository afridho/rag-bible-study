import React, { useState, useRef, useEffect, type FormEvent } from "react";
import { Send, Loader2, SquarePen, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { VerseLink, splitVerseReferences } from "@/components/verse-link";
import {
    type ChatSession,
    getSessions,
    saveSession,
    deleteSession,
    generateId,
    getNickname,
    setNickname,
} from "@/lib/storage";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

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

const SECTION_LABELS: [string, string][] = [
    ["", "Semua Section"],
    ["objectives", "Tujuan"],
    ["tips", "Tips"],
    ["verses", "Ayat"],
    ["keywords", "Kata Kunci"],
    ["questions", "Pertanyaan"],
    ["application", "Aplikasi"],
    ["illustrations", "Ilustrasi"],
    ["general", "Umum"],
];

interface Source {
    document_id: string;
    lesson_title: string;
    lesson_number: number;
    section_type: string;
    bible_verses: string[];
    images: string[];
}

interface Message {
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
    const [sectionFilter, setSectionFilter] = useState("");
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [nickname, setNicknameState] = useState<string | null>(getNickname);
    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Sync activeId from URL hash on mount
    useEffect(() => {
        // Show name prompt if no nickname set
        if (!getNickname()) {
            setShowNamePrompt(true);
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

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    function scrollToBottom() {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, 50);
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
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const history = [...messages, userMsg]
                .filter((m) => m.role === "user" || m.role === "assistant")
                .slice(-20)
                .map((m) => ({ role: m.role, content: m.content }));

            const body: Record<string, unknown> = { query, history };
            if (lessonFilter) body.lesson = parseInt(lessonFilter);
            if (sectionFilter) body.section_type = sectionFilter;
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

            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "" },
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
                                setMessages((prev) => {
                                    const u = [...prev];
                                    u[u.length - 1] = {
                                        role: "assistant",
                                        content: fullAnswer,
                                        sources,
                                    };
                                    return u;
                                });
                            } else if (eventType === "done") {
                                fullAnswer = data.answer || fullAnswer;
                                setMessages((prev) => {
                                    const u = [...prev];
                                    u[u.length - 1] = {
                                        role: "assistant",
                                        content: fullAnswer,
                                        sources,
                                    };
                                    return u;
                                });
                            } else if (eventType === "error")
                                throw new Error(data.message);
                        } catch {
                            /* skip */
                        }
                        eventType = "";
                    }
                }
            }
        } catch (err) {
            // Don't show error message for user-initiated abort
            if ((err as Error).name === "AbortError") {
                setMessages((prev) => prev.filter((m) => m.content !== ""));
            } else {
                setMessages((prev) => [
                    ...prev.filter((m) => m.content !== ""),
                    {
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
                        <span key={j}>
                            {part.value}
                            <VerseLink reference={part.value} />
                        </span>
                    ) : (
                        <span key={j}>{part.value}</span>
                    ),
                )}
            </span>
        );
    }

    return (
        <>
            {/* Name prompt overlay */}
            {showNamePrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-sm rounded-xl bg-popover p-6 shadow-lg">
                        <h3 className="mb-2 text-lg font-medium">
                            Siapa nama kamu?
                        </h3>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Supaya asisten bisa memanggil kamu dengan nama.
                        </p>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const input = form.elements.namedItem(
                                    "nickname",
                                ) as HTMLInputElement;
                                const value = input.value.trim();
                                if (value) {
                                    setNickname(value);
                                    setNicknameState(value);
                                    setShowNamePrompt(false);
                                }
                            }}
                        >
                            <input
                                name="nickname"
                                autoFocus
                                placeholder="Nama panggilan..."
                                className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                            />
                            <button
                                type="submit"
                                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                            >
                                Lanjutkan
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <AppSidebar
                sessions={sessions}
                activeId={activeId}
                onSelect={selectSession}
                onNew={startNewChat}
                onDelete={handleDeleteSession}
                nickname={nickname}
                onChangeNickname={() => setShowNamePrompt(true)}
            />
            <SidebarInset>
                <div className="relative flex h-svh flex-col">
                    {/* Floating toolbar (top-left like Gemini) */}
                    <div className="absolute left-4 top-4 z-10 flex items-center gap-1">
                        <SidebarTrigger />
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={startNewChat}
                            title="New chat"
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
                                            RAG
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
                                    return (
                                        <div
                                            key={i}
                                            className={cn(
                                                "flex gap-3",
                                                isUser
                                                    ? "flex-row-reverse"
                                                    : "flex-row",
                                            )}
                                        >
                                            <div className="flex-shrink-0 pt-1">
                                                <div
                                                    className={cn(
                                                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                                                        isUser
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-muted text-muted-foreground",
                                                    )}
                                                >
                                                    {isUser
                                                        ? nickname?.[0]?.toUpperCase() ||
                                                          "U"
                                                        : "📖"}
                                                </div>
                                            </div>
                                            <div
                                                className={cn(
                                                    "min-w-0 flex-1",
                                                    isUser &&
                                                        "flex justify-end",
                                                )}
                                            >
                                                <Bubble
                                                    variant={
                                                        isUser
                                                            ? "default"
                                                            : "secondary"
                                                    }
                                                    align={
                                                        isUser ? "end" : "start"
                                                    }
                                                >
                                                    <BubbleContent>
                                                        {isUser ? (
                                                            <div className="whitespace-pre-wrap">
                                                                {msg.content}
                                                            </div>
                                                        ) : (
                                                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 text-left">
                                                                <ReactMarkdown
                                                                    remarkPlugins={[
                                                                        remarkGfm,
                                                                    ]}
                                                                    components={{
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
                                                                    }}
                                                                >
                                                                    {
                                                                        msg.content
                                                                    }
                                                                </ReactMarkdown>
                                                            </div>
                                                        )}
                                                        {msg.sources &&
                                                            msg.sources.length >
                                                                0 &&
                                                            !(
                                                                isLoading &&
                                                                i ===
                                                                    messages.length -
                                                                        1
                                                            ) && (
                                                                <div className="mt-3 border-t border-border/30 pt-2 text-left">
                                                                    <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                                                                        📚
                                                                        Sumber:
                                                                    </p>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {msg.sources.map(
                                                                            (
                                                                                s,
                                                                                j,
                                                                            ) => (
                                                                                <Badge
                                                                                    key={
                                                                                        j
                                                                                    }
                                                                                    variant="secondary"
                                                                                    className="text-[10px]"
                                                                                >
                                                                                    L
                                                                                    {
                                                                                        s.lesson_number
                                                                                    }

                                                                                    :{" "}
                                                                                    {
                                                                                        s.lesson_title
                                                                                    }{" "}
                                                                                    (
                                                                                    {
                                                                                        s.section_type
                                                                                    }

                                                                                    )
                                                                                    {s
                                                                                        .bible_verses
                                                                                        ?.length >
                                                                                        0 &&
                                                                                        ` — ${s.bible_verses.join(", ")}`}
                                                                                </Badge>
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                    {msg.sources.some(
                                                                        (s) =>
                                                                            s
                                                                                .images
                                                                                ?.length >
                                                                            0,
                                                                    ) && (
                                                                        <div className="mt-2 flex flex-wrap gap-2">
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
                                                                </div>
                                                            )}
                                                    </BubbleContent>
                                                </Bubble>
                                            </div>
                                        </div>
                                    );
                                })}

                                {isLoading &&
                                    messages[messages.length - 1]?.content ===
                                        "" && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs">
                                                📖
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span>Sedang berpikir...</span>
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Input */}
                    <div className="mx-auto w-full max-w-3xl px-6 py-3">
                        <form
                            onSubmit={handleSubmit}
                            className="flex items-center gap-2 rounded-2xl border bg-muted/50 px-4 py-2"
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
                                <DropdownMenuTrigger className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border bg-transparent px-2.5 text-[10px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground">
                                    {
                                        LESSON_LABELS.find(
                                            ([v]) => v === lessonFilter,
                                        )?.[1]
                                    }
                                    <ChevronDown className="size-3" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="min-w-[180px]"
                                >
                                    <DropdownMenuRadioGroup
                                        value={lessonFilter}
                                        onValueChange={setLessonFilter}
                                    >
                                        {LESSON_LABELS.map(([value, label]) => (
                                            <DropdownMenuRadioItem
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </DropdownMenuRadioItem>
                                        ))}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
