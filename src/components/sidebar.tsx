import { Search, Plus, Trash2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type ChatSession } from "@/lib/storage";

interface SidebarProps {
    sessions: ChatSession[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
}

export function Sidebar({
    sessions,
    activeId,
    onSelect,
    onNew,
    onDelete,
}: SidebarProps) {
    const [search, setSearch] = useState("");

    const filtered = sessions.filter((s) =>
        s.title.toLowerCase().includes(search.toLowerCase()),
    );

    // Group by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: { label: string; items: ChatSession[] }[] = [];
    const todayItems = filtered.filter((s) => s.createdAt >= today.getTime());
    const yesterdayItems = filtered.filter(
        (s) =>
            s.createdAt >= yesterday.getTime() && s.createdAt < today.getTime(),
    );
    const weekItems = filtered.filter(
        (s) =>
            s.createdAt >= weekAgo.getTime() &&
            s.createdAt < yesterday.getTime(),
    );
    const olderItems = filtered.filter((s) => s.createdAt < weekAgo.getTime());

    if (todayItems.length) groups.push({ label: "Today", items: todayItems });
    if (yesterdayItems.length)
        groups.push({ label: "Yesterday", items: yesterdayItems });
    if (weekItems.length)
        groups.push({ label: "7 Days Ago", items: weekItems });
    if (olderItems.length) groups.push({ label: "Older", items: olderItems });

    return (
        <div className="flex h-full w-64 flex-col border-r border-border bg-muted/30">
            {/* New chat button */}
            <div className="p-3">
                <Button
                    onClick={onNew}
                    variant="outline"
                    className="w-full justify-start gap-2"
                    size="sm"
                >
                    <Plus className="h-4 w-4" />
                    New Chat
                </Button>
            </div>

            {/* Search */}
            <div className="px-3 pb-2">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search chats..."
                        className="h-8 pl-8 text-xs"
                    />
                </div>
            </div>

            {/* Sessions list */}
            <ScrollArea className="flex-1 px-2">
                {groups.map((group) => (
                    <div key={group.label} className="mb-3">
                        <p className="mb-1 px-2 text-[11px] font-medium text-muted-foreground">
                            {group.label}
                        </p>
                        {group.items.map((session) => (
                            <div
                                key={session.id}
                                className={cn(
                                    "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                                    session.id === activeId && "bg-accent",
                                )}
                                onClick={() => onSelect(session.id)}
                            >
                                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="flex-1 truncate text-xs">
                                    {session.title}
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(session.id);
                                    }}
                                    className="hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                ))}

                {filtered.length === 0 && (
                    <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                        {search ? "No chats found" : "No chat history yet"}
                    </p>
                )}
            </ScrollArea>
        </div>
    );
}
