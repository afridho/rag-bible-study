import { useState, useEffect, useCallback } from "react";
import {
    Plus,
    Pencil,
    Trash2,
    RefreshCw,
    ArrowLeft,
    Database,
    LogOut,
    ImageIcon,
    Search,
    X,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { ChevronDown } from "lucide-react";
import { DocumentForm } from "@/components/admin/document-form";
import { AdminLogin } from "@/components/admin/admin-login";
import {
    type BibleDocument,
    type DocumentInput,
    type Pagination as PaginationMeta,
    listDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    getStatus,
    triggerIngest,
    clearAdminCredentials,
    hasAdminCredentials,
    UnauthorizedError,
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

/**
 * Build the list of page tokens to render: page numbers and "ellipsis" markers.
 * Always shows first + last page, and a window around the current page.
 * e.g. current=5, total=10 → [1, "ellipsis", 4, 5, 6, "ellipsis", 10]
 */
function getPageRange(current: number, total: number): (number | "ellipsis")[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) pages.push("ellipsis");
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < total - 1) pages.push("ellipsis");

    pages.push(total);
    return pages;
}

export function AdminPage() {
    const [documents, setDocuments] = useState<BibleDocument[]>([]);
    const [pagination, setPagination] = useState<PaginationMeta | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lessonFilter, setLessonFilter] = useState("");
    const [sectionFilter, setSectionFilter] = useState("");
    // searchInput = live input value; search = debounced value used for fetching
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<BibleDocument | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<BibleDocument | null>(
        null,
    );
    const [ingesting, setIngesting] = useState(false);
    const [authed, setAuthed] = useState(false);
    const [authError, setAuthError] = useState<string | undefined>(undefined);
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
                search: search || undefined,
            });
            setDocuments(res.documents);
            setPagination(res.pagination);
            setAuthed(true);
        } catch (err) {
            if (err instanceof UnauthorizedError) {
                // Only show "wrong credentials" error if user actually had
                // stored credentials (i.e. they submitted the form at least
                // once). On first visit sessionStorage is empty — the 401 is
                // just the expected probe, so we show the login form cleanly.
                const hadCredentials = hasAdminCredentials();
                clearAdminCredentials();
                setAuthed(false);
                if (hadCredentials) {
                    setAuthError("Kredensial salah. Coba lagi.");
                }
            } else {
                toast.add({ title: "Gagal memuat dokumen", type: "error" });
            }
        } finally {
            setLoading(false);
        }
    }, [page, lessonFilter, sectionFilter, search]);

    const loadStatus = useCallback(async () => {
        try {
            const s = await getStatus();
            setStatus(s);
        } catch {
            /* ignore */
        }
    }, []);

    // Debounce the search input (300ms) before it triggers a fetch, and reset
    // to page 1 whenever the query changes.
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        // Skip the documents probe when the user isn't logged in yet — it would
        // just 401. After a successful login, AdminLogin.onSuccess triggers the
        // load explicitly. loadStatus is public (no auth) so it always runs.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (hasAdminCredentials()) void loadDocuments();
        void loadStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, lessonFilter, sectionFilter, search]);

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

    function handleLogout() {
        clearAdminCredentials();
        setAuthed(false);
        setAuthError(undefined);
        setDocuments([]);
    }

    // Show login gate until authenticated
    if (!authed) {
        return (
            <AdminLogin
                error={authError}
                onSuccess={() => {
                    setAuthError(undefined);
                    void loadDocuments();
                    void loadStatus();
                }}
            />
        );
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
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleLogout}
                            title="Logout"
                        >
                            <LogOut className="size-4" />
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

                {/* Filters + Search (one row; search fills the remaining space) */}
                <div className="mb-4 flex items-center gap-2">
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

                    {/* Search — fills the remaining space on the right */}
                    <div className="relative ml-auto min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Cari teks konten, judul, atau tag..."
                            className="h-8 pl-9 pr-9 text-sm"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={() => setSearchInput("")}
                                aria-label="Bersihkan pencarian"
                                className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>
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
                        {search || lessonFilter || sectionFilter
                            ? "Tidak ada dokumen yang cocok dengan filter/pencarian."
                            : 'Belum ada dokumen. Klik "Tambah" untuk mulai.'}
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
                                        {doc.images &&
                                            doc.images.length > 0 && (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1 text-[10px]"
                                                >
                                                    <ImageIcon className="size-3" />
                                                    {doc.images.length}
                                                </Badge>
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
                    <Pagination className="mt-6">
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    href="#"
                                    text="Sebelumnya"
                                    aria-disabled={page <= 1}
                                    className={
                                        page <= 1
                                            ? "pointer-events-none opacity-50"
                                            : undefined
                                    }
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (page > 1) setPage((p) => p - 1);
                                    }}
                                />
                            </PaginationItem>

                            {getPageRange(page, pagination.totalPages).map(
                                (token, i) =>
                                    token === "ellipsis" ? (
                                        <PaginationItem key={`ellipsis-${i}`}>
                                            <PaginationEllipsis />
                                        </PaginationItem>
                                    ) : (
                                        <PaginationItem key={token}>
                                            <PaginationLink
                                                href="#"
                                                isActive={token === page}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setPage(token);
                                                }}
                                            >
                                                {token}
                                            </PaginationLink>
                                        </PaginationItem>
                                    ),
                            )}

                            <PaginationItem>
                                <PaginationNext
                                    href="#"
                                    text="Berikutnya"
                                    aria-disabled={
                                        page >= pagination.totalPages
                                    }
                                    className={
                                        page >= pagination.totalPages
                                            ? "pointer-events-none opacity-50"
                                            : undefined
                                    }
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (page < pagination.totalPages)
                                            setPage((p) => p + 1);
                                    }}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
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
