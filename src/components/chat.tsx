import { useState, useRef, useEffect, type FormEvent } from "react";
import { Send, Trash2, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
    role: "user" | "assistant" | "system";
    content: string;
    sources?: Source[];
}

interface Stats {
    totalDocuments: number;
    totalChunks: number;
    indexedDocuments: number;
}

export function Chat() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "system",
            content:
                'Selamat datang! Tanyakan apa saja tentang kurikulum studi Alkitab "Pelajaran Dasar-Dasar Utama".',
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [lessonFilter, setLessonFilter] = useState("");
    const [sectionFilter, setSectionFilter] = useState("");
    const [stats, setStats] = useState<Stats | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const historyRef = useRef<{ role: string; content: string }[]>([]);

    useEffect(() => {
        loadStats();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    function scrollToBottom() {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }

    async function loadStats() {
        try {
            const res = await fetch(`${API_BASE}/status`);
            const data = await res.json();
            if (data.success) setStats(data.status);
        } catch {
            // silently fail
        }
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const query = input.trim();
        if (!query || isLoading) return;

        setMessages((prev) => [...prev, { role: "user", content: query }]);
        historyRef.current.push({ role: "user", content: query });
        setInput("");
        setIsLoading(true);

        try {
            const body: Record<string, unknown> = {
                query,
                history: historyRef.current.slice(-20),
            };
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

            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "", sources: [] },
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
                            // skip malformed
                        }
                        eventType = "";
                    }
                }
            }

            historyRef.current.push({ role: "assistant", content: fullAnswer });
        } catch (err) {
            setMessages((prev) => [
                ...prev.filter((m) => m.content !== ""),
                {
                    role: "system",
                    content: `❌ Error: ${(err as Error).message}`,
                },
            ]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    }

    function clearChat() {
        historyRef.current = [];
        setMessages([
            {
                role: "system",
                content:
                    "Percakapan direset. Tanyakan apa saja tentang kurikulum studi Alkitab.",
            },
        ]);
    }

    return (
        <div className="flex h-full flex-col bg-background text-foreground">
            {/* Header */}
            <header className="flex items-center gap-3 border-b border-border px-6 py-4">
                <BookOpen className="h-6 w-6 text-primary" />
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">Bible Study RAG</h1>
                    <p className="text-xs text-muted-foreground">
                        Pelajaran Dasar-Dasar Utama — Tanya jawab berbasis
                        kurikulum
                    </p>
                </div>
                {stats && (
                    <div className="hidden gap-3 text-xs text-muted-foreground sm:flex">
                        <span>📄 {stats.totalDocuments} docs</span>
                        <span>🧩 {stats.totalChunks} chunks</span>
                    </div>
                )}
            </header>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
                <div className="mx-auto max-w-3xl space-y-4">
                    {messages.map((msg, i) => (
                        <MessageBubble key={i} message={msg} />
                    ))}
                    {isLoading &&
                        messages[messages.length - 1]?.content === "" && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Sedang berpikir...
                            </div>
                        )}
                </div>
            </div>

            {/* Input Area */}
            <div className="border-t border-border px-4 py-3">
                <form
                    onSubmit={handleSubmit}
                    className="mx-auto flex max-w-3xl gap-2"
                >
                    <Input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ketik pertanyaan tentang studi Alkitab..."
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
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={clearChat}
                        title="Clear chat"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </form>

                {/* Filters */}
                <div className="mx-auto mt-2 flex max-w-3xl gap-2">
                    <select
                        value={lessonFilter}
                        onChange={(e) => setLessonFilter(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
    );
}

function MessageBubble({ message }: { message: Message }) {
    if (message.role === "system") {
        return (
            <div className="text-center text-sm text-muted-foreground">
                {message.content}
            </div>
        );
    }

    const isUser = message.role === "user";

    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                }`}
            >
                {message.content}

                {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 border-t border-border/50 pt-2">
                        <p className="mb-1 text-xs font-medium opacity-70">
                            📚 Sumber:
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {message.sources.map((s, i) => (
                                <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-[10px]"
                                >
                                    L{s.lesson_number}: {s.lesson_title} (
                                    {s.section_type})
                                    {s.bible_verses?.length > 0 &&
                                        ` — ${s.bible_verses.join(", ")}`}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
