import { useState, useRef, useEffect, type FormEvent } from "react";
import { Send, Loader2, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Sidebar } from "@/components/sidebar";
import {
    type ChatSession,
    getSessions,
    saveSession,
    deleteSession,
    generateId,
} from "@/lib/storage";

const API_BASE =
    import.meta.env.VITE_API_URL ||
    "http://localhost:3300/api/bible/bible-study";

interface Source {
    document_id: string;
    lesson_title: string;
    lesson_number: number;
    section_type: string;
    bible_verses: string[];
}

interface Message {
    role: "user" | "assistant";
    content: string;
    sources?: Source[];
}

export function Chat() {
    const [sessions, setSessions] = useState<ChatSession[]>(getSessions);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [lessonFilter, setLessonFilter] = useState("");
    const [sectionFilter, setSectionFilter] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync messages to localStorage on change
    useEffect(() => {
        if (activeId && messages.length > 0) {
            const session = sessions.find((s) => s.id === activeId);
            if (session) {
                session.messages = messages;
                // Update title from first user message
                const firstUser = messages.find((m) => m.role === "user");
                if (firstUser) {
                    session.title = firstUser.content.slice(0, 50);
                }
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
        inputRef.current?.focus();
    }

    function selectSession(id: string) {
        const session = sessions.find((s) => s.id === id);
        if (session) {
            setActiveId(id);
            setMessages(session.messages as Message[]);
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

        // Auto-create session if none active
        let currentId = activeId;
        if (!currentId) {
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
            currentId = id;
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

            const res = await fetch(`${API_BASE}/query/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
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

            // Add placeholder
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
                            if (eventType === "meta") {
                                sources = data.sources || [];
                            } else if (eventType === "token") {
                                fullAnswer += data.delta;
                                setMessages((prev) => {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = {
                                        role: "assistant",
                                        content: fullAnswer,
                                        sources,
                                    };
                                    return updated;
                                });
                            } else if (eventType === "done") {
                                fullAnswer = data.answer || fullAnswer;
                                setMessages((prev) => {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = {
                                        role: "assistant",
                                        content: fullAnswer,
                                        sources,
                                    };
                                    return updated;
                                });
                            } else if (eventType === "error") {
                                throw new Error(data.message);
                            }
                        } catch {
                            // skip
                        }
                        eventType = "";
                    }
                }
            }
        } catch (err) {
            setMessages((prev) => [
                ...prev.filter((m) => m.content !== ""),
                {
                    role: "assistant",
                    content: `❌ Error: ${(err as Error).message}`,
                },
            ]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    }

    return (
        <div className="flex h-full bg-background text-foreground">
            {/* Sidebar */}
            <Sidebar
                sessions={sessions}
                activeId={activeId}
                onSelect={selectSession}
                onNew={startNewChat}
                onDelete={handleDeleteSession}
            />

            {/* Main Chat Area */}
            <div className="flex flex-1 flex-col">
                {/* Header */}
                <header className="flex items-center gap-3 border-b border-border px-6 py-3">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h1 className="text-sm font-semibold">Bible Study RAG</h1>
                    <span className="text-xs text-muted-foreground">
                        Pelajaran Dasar-Dasar Utama
                    </span>
                </header>

                {/* Messages */}
                <div className="min-h-0 flex-1">
                    <ScrollArea className="h-full" ref={scrollRef}>
                        <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
                            {messages.length === 0 && !activeId && (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
                                    <h2 className="mb-2 text-lg font-medium">
                                        Bible Study RAG
                                    </h2>
                                    <p className="max-w-md text-sm text-muted-foreground">
                                        Tanyakan apa saja tentang kurikulum
                                        "Pelajaran Dasar-Dasar Utama". Contoh:
                                        "Apa itu pemuridan?", "Jelaskan tentang
                                        baptisan"
                                    </p>
                                </div>
                            )}

                            {messages.length === 0 && activeId && (
                                <div className="py-12 text-center text-sm text-muted-foreground">
                                    Start a conversation...
                                </div>
                            )}

                            {messages.map((msg, i) => {
                                const isUser = msg.role === "user";

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
                                        {/* Avatar */}
                                        <div className="flex-shrink-0">
                                            <div
                                                className={cn(
                                                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                                                    isUser
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted text-muted-foreground",
                                                )}
                                            >
                                                {isUser ? "U" : "📖"}
                                            </div>
                                        </div>

                                        {/* Bubble */}
                                        <div
                                            className={cn(
                                                "min-w-0 flex-1",
                                                isUser && "flex justify-end",
                                            )}
                                        >
                                            <Bubble
                                                variant={
                                                    isUser
                                                        ? "default"
                                                        : "secondary"
                                                }
                                                align={isUser ? "end" : "start"}
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
                                                            >
                                                                {msg.content}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )}
                                                    {msg.sources &&
                                                        msg.sources.length >
                                                            0 && (
                                                            <div className="mt-3 border-t border-border/30 pt-2 text-left">
                                                                <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                                                                    📚 Sumber:
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
                <div className="border-t border-border px-6 py-3">
                    <form
                        onSubmit={handleSubmit}
                        className="mx-auto flex max-w-3xl gap-2"
                    >
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ketik pertanyaan..."
                            disabled={isLoading}
                            className="flex-1"
                            autoFocus
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={isLoading || !input.trim()}
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>

                    {/* Filters */}
                    <div className="mx-auto mt-2 flex max-w-3xl gap-2">
                        <select
                            value={lessonFilter}
                            onChange={(e) => setLessonFilter(e.target.value)}
                            className="h-7 rounded-md border border-input bg-background px-2 text-[11px] text-foreground"
                        >
                            <option value="">Semua Pelajaran</option>
                            <option value="1">1 - Mencari Tuhan</option>
                            <option value="2">2 - Firman Tuhan</option>
                            <option value="3">3 - Pemuridan</option>
                            <option value="4">4 - Dosa</option>
                            <option value="5">5 - Pertobatan</option>
                            <option value="6">6 - Salib</option>
                            <option value="7">7 - Baptisan</option>
                            <option value="8">8 - Jemaat/Gereja</option>
                            <option value="9">9 - Roh Kudus</option>
                        </select>
                        <select
                            value={sectionFilter}
                            onChange={(e) => setSectionFilter(e.target.value)}
                            className="h-7 rounded-md border border-input bg-background px-2 text-[11px] text-foreground"
                        >
                            <option value="">Semua Section</option>
                            <option value="objectives">Tujuan</option>
                            <option value="tips">Tips Mengajar</option>
                            <option value="verses">Ayat Alkitab</option>
                            <option value="keywords">Kata Kunci</option>
                            <option value="questions">Pertanyaan</option>
                            <option value="application">Aplikasi</option>
                            <option value="illustrations">Ilustrasi</option>
                            <option value="general">Umum</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
}
