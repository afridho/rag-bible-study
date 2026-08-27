import { useState, useEffect, useCallback } from "react";
import {
    Plus,
    Pencil,
    Trash2,
    RefreshCw,
    ArrowLeft,
    Database,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { DocumentForm } from "@/components/admin/document-form";
import {
    type BibleDocument,
    type DocumentInput,
    type Pagination,
    listDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    getStatus,
    triggerIngest,
} from "@/lib/admin-api";

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
    ["", "All Sections"],
    ["objectives", "Objectives"],
    ["tips", "Tips"],
    ["verses", "Verses"],
    ["keywords", "Keywords"],
    ["questions", "Questions"],
    ["application", "Application"],
    ["illustrations", "Illustrations"],
    ["general", "General"],
];

export function AdminPage() {
    const [documents, setDocuments] = useState<BibleDocument[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lessonFilter, setLessonFilter] = useState("");
    const [sectionFilter, setSectionFilter] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<BibleDocument | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<BibleDocument | null>(
        null,
    );
    const [ingesting, setIngesting] = useState(false);
    const [status, setStatus] = useState<{
        totalDocuments: number;
        indexedDocuments: number;
        totalChunks: number;
    } | null>(null);

    const loadDocuments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listDocuments({
                page,
                limit: 20,
                lesson: lessonFilter || undefined,
                section_type: sectionFilter || undefined,
            });
            setDocuments(res.documents);
            setPagination(res.pagination);
        } catch {
            toast.add({ title: "Gagal memuat dokumen", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [page, lessonFilter, sectionFilter]);

    const loadStatus = useCallback(async () => {
        try {
            const s = await getStatus();
            setStatus(s);
        } catch {
            /* ignore */
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadDocuments();
        void loadStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, lessonFilter, sectionFilter]);

    async function handleSubmit(doc: DocumentInput) {
        try {
            if (editing) {
                await updateDocument(editing._id, doc);
                toast.add({ title: "Dokumen diperbarui", type: "success" });
            } else {
                await createDocument(doc);
                toast.add({ title: "Dokumen ditambahkan", type: "success" });
            }
            setEditing(null);
            loadDocuments();
            loadStatus();
        } catch (err) {
            toast.add({
                title: (err as Error).message,
                type: "error",
            });
            throw err;
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            await deleteDocument(deleteTarget._id);
            toast.add({ title: "Dokumen dihapus", type: "success" });
            setDeleteTarget(null);
            loadDocuments();
            loadStatus();
        } catch (err) {
            toast.add({ title: (err as Error).message, type: "error" });
        }
    }

    async function handleIngest() {
        setIngesting(true);
        try {
            await triggerIngest();
            toast.add({ title: "Re-index selesai", type: "success" });
            loadStatus();
            loadDocuments();
        } catch (err) {
            toast.add({ title: (err as Error).message, type: "error" });
        } finally {
            setIngesting(false);
        }
    }

    return (
        <div className="min-h-svh bg-background text-foreground">
            <div className="mx-auto max-w-5xl px-6 py-6">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <a
                            href="/"
                            className="flex size-8 items-center justify-center rounded-lg hover:bg-accent"
                            title="Kembali ke chat"
                        >
                            <ArrowLeft className="size-4" />
                        </a>
                        <div>
                            <h1 className="text-lg font-semibold">
                                Admin — Knowledge RAG
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Kelola dokumen studi Alkitab
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleIngest}
                            disabled={ingesting}
                        >
                            <RefreshCw
                                className={
                                    ingesting ? "size-4 animate-spin" : "size-4"
                                }
                            />
                            Re-index
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setEditing(null);
                                setFormOpen(true);
                            }}
                        >
                            <Plus className="size-4" />
                            Tambah
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                {status && (
                    <div className="mb-6 flex flex-wrap gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                        <span className="flex items-center gap-1.5">
                            <Database className="size-4 text-muted-foreground" />
                            <strong>{status.totalDocuments}</strong> dokumen
                        </span>
                        <span className="text-muted-foreground">
                            <strong className="text-foreground">
                                {status.indexedDocuments}
                            </strong>{" "}
                            terindeks
                        </span>
                        <span className="text-muted-foreground">
                            <strong className="text-foreground">
                                {status.totalChunks}
                            </strong>{" "}
                            chunks
                        </span>
                    </div>
                )}

                {/* Filters */}
                <div className="mb-4 flex flex-wrap gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs outline-none transition-colors hover:bg-accent">
                            {
                                LESSON_LABELS.find(
                                    ([v]) => v === lessonFilter,
                                )?.[1]
                            }
                            <ChevronDown className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="start"
                            className="min-w-[180px]"
                        >
                            <DropdownMenuRadioGroup
                                value={lessonFilter}
                                onValueChange={(v) => {
                                    setLessonFilter(v);
                                    setPage(1);
                                }}
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
                        <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs outline-none transition-colors hover:bg-accent">
                            {
                                SECTION_LABELS.find(
                                    ([v]) => v === sectionFilter,
                                )?.[1]
                            }
                            <ChevronDown className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="start"
                            className="min-w-[160px]"
                        >
                            <DropdownMenuRadioGroup
                                value={sectionFilter}
                                onValueChange={(v) => {
                                    setSectionFilter(v);
                                    setPage(1);
                                }}
                            >
                                {SECTION_LABELS.map(([value, label]) => (
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
                </div>

                {/* List */}
                {loading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton
                                key={i}
                                className="h-20 w-full rounded-lg"
                            />
                        ))}
                    </div>
                ) : documents.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
                        Belum ada dokumen. Klik "Tambah" untuk mulai.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {documents.map((doc) => (
                            <div
                                key={doc._id}
                                className="group flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                        {doc.lesson_number && (
                                            <Badge
                                                variant="secondary"
                                                className="text-[10px]"
                                            >
                                                L{doc.lesson_number}
                                            </Badge>
                                        )}
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] capitalize"
                                        >
                                            {doc.section_type}
                                        </Badge>
                                        {doc.lesson_title && (
                                            <span className="text-xs font-medium">
                                                {doc.lesson_title}
                                            </span>
                                        )}
                                        {!doc.indexed && (
                                            <Badge className="bg-amber-500/15 text-[10px] text-amber-600">
                                                belum terindeks
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                        {doc.content}
                                    </p>
                                    {doc.bible_verses?.length > 0 && (
                                        <p className="mt-1 text-[11px] text-muted-foreground/70">
                                            📖 {doc.bible_verses.join(", ")}
                                        </p>
                                    )}
                                </div>
                                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => {
                                            setEditing(doc);
                                            setFormOpen(true);
                                        }}
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => setDeleteTarget(doc)}
                                    >
                                        <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            Sebelumnya
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            {page} / {pagination.totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= pagination.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Berikutnya
                        </Button>
                    </div>
                )}
            </div>

            <DocumentForm
                open={formOpen}
                onOpenChange={setFormOpen}
                document={editing}
                onSubmit={handleSubmit}
            />

            <AlertDialog
                open={deleteTarget !== null}
                onOpenChange={(o) => {
                    if (!o) setDeleteTarget(null);
                }}
            >
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus dokumen?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dokumen dan vektornya di RAG akan dihapus permanen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={handleDelete}
                        >
                            Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
