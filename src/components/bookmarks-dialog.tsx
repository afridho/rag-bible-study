import { useEffect, useState } from "react";
import { Trash2, BookmarkX } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type SavedVerse, getBookmarks, removeBookmark } from "@/lib/storage";

interface BookmarksDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function BookmarksDialog({ open, onOpenChange }: BookmarksDialogProps) {
    const [items, setItems] = useState<SavedVerse[]>([]);

    // Refresh the list each time the dialog opens (bookmarks live in localStorage).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (open) setItems(getBookmarks());
    }, [open]);

    function handleRemove(reference: string) {
        setItems(removeBookmark(reference));
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Ayat Tersimpan</DialogTitle>
                    <DialogDescription>
                        Ayat yang kamu simpan dari percakapan.
                    </DialogDescription>
                </DialogHeader>

                {items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                        <BookmarkX className="size-6" />
                        Belum ada ayat tersimpan.
                    </div>
                ) : (
                    <ScrollArea className="max-h-[60vh]">
                        <div className="space-y-2 pr-2">
                            {items.map((v) => (
                                <div
                                    key={v.reference}
                                    className="group rounded-lg border border-border bg-card p-3"
                                >
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold">
                                            {v.reference}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemove(v.reference)
                                            }
                                            title="Hapus"
                                            aria-label={`Hapus ${v.reference}`}
                                            className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {v.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
}
