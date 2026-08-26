import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInput,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { type ChatSession } from "@/lib/storage";

interface AppSidebarProps {
    sessions: ChatSession[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
}

export function AppSidebar({
    sessions,
    activeId,
    onSelect,
    onNew,
    onDelete,
}: AppSidebarProps) {
    const [search, setSearch] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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

    function confirmDelete() {
        if (deleteTarget) {
            onDelete(deleteTarget);
            toast.add({ title: "Chat deleted", type: "success" });
            setDeleteTarget(null);
        }
    }

    return (
        <>
            <Sidebar collapsible="offcanvas">
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={onNew}
                                tooltip="New Chat"
                            >
                                <Plus className="size-4" />
                                <span>New Chat</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                    <SidebarInput
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search chats..."
                    />
                </SidebarHeader>

                <SidebarContent>
                    {groups.map((group) => (
                        <SidebarGroup key={group.label}>
                            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {group.items.map((session) => (
                                        <SidebarMenuItem key={session.id}>
                                            <SidebarMenuButton
                                                onClick={() =>
                                                    onSelect(session.id)
                                                }
                                                isActive={
                                                    session.id === activeId
                                                }
                                                tooltip={session.title}
                                            >
                                                <span>{session.title}</span>
                                            </SidebarMenuButton>
                                            <SidebarMenuAction
                                                onClick={() =>
                                                    setDeleteTarget(session.id)
                                                }
                                                showOnHover
                                            >
                                                <Trash2 className="size-4" />
                                                <span className="sr-only">
                                                    Delete
                                                </span>
                                            </SidebarMenuAction>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    ))}

                    {filtered.length === 0 && (
                        <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                            {search ? "No chats found" : "No chat history yet"}
                        </div>
                    )}
                </SidebarContent>

                <SidebarFooter>
                    <ThemeToggle />
                </SidebarFooter>
            </Sidebar>

            <AlertDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null);
                }}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete chat?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this conversation. This
                            action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={confirmDelete}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
