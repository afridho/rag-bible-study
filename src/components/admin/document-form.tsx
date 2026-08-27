import { useState, useEffect, useRef, type FormEvent } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ImagePlus, X, Loader2, Eye } from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
    type BibleDocument,
    type DocumentImage,
    type DocumentInput,
    type ChunkPreview,
    SECTION_TYPES,
    uploadImages,
    deleteImage,
    previewChunks,
} from "@/lib/admin-api";

const LESSON_OPTIONS = [
    { value: "", label: "— Tidak ada —" },
    { value: "1", label: "1 - Mencari Tuhan" },
    { value: "2", label: "2 - Firman Tuhan" },
    { value: "3", label: "3 - Pemuridan" },
    { value: "4", label: "4 - Dosa" },
    { value: "5", label: "5 - Pertobatan" },
    { value: "6", label: "6 - Salib" },
    { value: "7", label: "7 - Baptisan" },
    { value: "8", label: "8 - Jemaat/Gereja" },
    { value: "9", label: "9 - Roh Kudus" },
];

interface DocumentFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    document?: BibleDocument | null;
    onSubmit: (doc: DocumentInput) => Promise<void>;
}

export function DocumentForm({
    open,
    onOpenChange,
    document,
    onSubmit,
}: DocumentFormProps) {
    const [content, setContent] = useState("");
    const [sectionType, setSectionType] = useState<string>("general");
    const [lessonNumber, setLessonNumber] = useState("");
    const [lessonTitle, setLessonTitle] = useState("");
    const [bibleVerses, setBibleVerses] = useState("");
    const [tags, setTags] = useState("");
    const [saving, setSaving] = useState(false);
    const [images, setImages] = useState<DocumentImage[]>([]);
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<ChunkPreview[] | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (document) {
            setContent(document.content);
            setSectionType(document.section_type);
            setLessonNumber(
                document.lesson_number ? String(document.lesson_number) : "",
            );
            setLessonTitle(document.lesson_title || "");
            setBibleVerses((document.bible_verses || []).join(", "));
            setTags((document.tags || []).join(", "));
            setImages(document.images || []);
        } else {
            setContent("");
            setSectionType("general");
            setLessonNumber("");
            setLessonTitle("");
            setBibleVerses("");
            setTags("");
            setImages([]);
        }
        setPreview(null);
    }, [document, open]);
    /* eslint-enable react-hooks/set-state-in-effect */

    async function handlePreview() {
        if (!content.trim()) return;
        setPreviewing(true);
        try {
            setPreview(await previewChunks(content));
        } catch (err) {
            toast.add({ title: (err as Error).message, type: "error" });
        } finally {
            setPreviewing(false);
        }
    }

    async function handleUpload(files: FileList | null) {
        if (!files || files.length === 0 || !document) return;
        setUploading(true);
        try {
            const uploaded = await uploadImages(
                document._id,
                Array.from(files),
            );
            setImages((prev) => [...prev, ...uploaded]);
            toast.add({ title: "Gambar diunggah", type: "success" });
        } catch (err) {
            toast.add({ title: (err as Error).message, type: "error" });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleRemoveImage(publicId: string) {
        if (!document) return;
        try {
            await deleteImage(document._id, publicId);
            setImages((prev) =>
                prev.filter((img) => img.public_id !== publicId),
            );
            toast.add({ title: "Gambar dihapus", type: "success" });
        } catch (err) {
            toast.add({ title: (err as Error).message, type: "error" });
        }
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!content.trim()) return;

        setSaving(true);
        try {
            await onSubmit({
                content: content.trim(),
                section_type: sectionType,
                lesson_number: lessonNumber ? Number(lessonNumber) : null,
                lesson_title: lessonTitle.trim(),
                bible_verses: bibleVerses
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                tags: tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
            });
            onOpenChange(false);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {document ? "Edit Dokumen" : "Tambah Dokumen"}
                    </DialogTitle>
                    <DialogDescription>
                        Data ini akan diindeks ke RAG secara otomatis.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">
                                Konten *
                            </label>
                            <button
                                type="button"
                                onClick={handlePreview}
                                disabled={!content.trim() || previewing}
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                            >
                                {previewing ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                    <Eye className="size-3.5" />
                                )}
                                Preview RAG
                            </button>
                        </div>
                        <Textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Isi materi..."
                            rows={12}
                            className="min-h-56 text-sm"
                        />
                        {preview && (
                            <div className="mt-2 rounded-md border border-border bg-muted/30 p-2">
                                <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                                    {preview.length} chunk yang akan diindeks
                                    RAG:
                                </p>
                                <div className="max-h-48 space-y-2 overflow-y-auto">
                                    {preview.map((c) => (
                                        <div
                                            key={c.index}
                                            className="rounded border border-border bg-background p-2"
                                        >
                                            <div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                                                <span className="font-medium">
                                                    #{c.index + 1}
                                                </span>
                                                <span>{c.chars} char</span>
                                                {c.verse_refs.length > 0 && (
                                                    <span className="truncate">
                                                        📖{" "}
                                                        {c.verse_refs.join(
                                                            ", ",
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="line-clamp-3 text-xs text-muted-foreground">
                                                {c.text}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                                Section Type
                            </label>
                            <DropdownMenu>
                                <DropdownMenuTrigger className="inline-flex h-9 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-background px-3 text-sm capitalize outline-none transition-colors hover:bg-accent">
                                    {sectionType}
                                    <ChevronDown className="size-4 text-muted-foreground" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="min-w-[var(--anchor-width)]"
                                >
                                    <DropdownMenuRadioGroup
                                        value={sectionType}
                                        onValueChange={(v) =>
                                            setSectionType(v || "general")
                                        }
                                    >
                                        {SECTION_TYPES.map((s) => (
                                            <DropdownMenuRadioItem
                                                key={s}
                                                value={s}
                                                className="capitalize"
                                            >
                                                {s}
                                            </DropdownMenuRadioItem>
                                        ))}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">
                                Pelajaran
                            </label>
                            <DropdownMenu>
                                <DropdownMenuTrigger className="inline-flex h-9 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors hover:bg-accent">
                                    {LESSON_OPTIONS.find(
                                        (l) => l.value === lessonNumber,
                                    )?.label || "— Tidak ada —"}
                                    <ChevronDown className="size-4 text-muted-foreground" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="min-w-[var(--anchor-width)]"
                                >
                                    <DropdownMenuRadioGroup
                                        value={lessonNumber}
                                        onValueChange={(v) =>
                                            setLessonNumber(v || "")
                                        }
                                    >
                                        {LESSON_OPTIONS.map((l) => (
                                            <DropdownMenuRadioItem
                                                key={l.value || "none"}
                                                value={l.value}
                                            >
                                                {l.label}
                                            </DropdownMenuRadioItem>
                                        ))}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                            Judul Pelajaran
                        </label>
                        <Input
                            value={lessonTitle}
                            onChange={(e) => setLessonTitle(e.target.value)}
                            placeholder="Contoh: Pemuridan"
                            className="h-9 text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">
                            Ayat Alkitab
                        </label>
                        <Input
                            value={bibleVerses}
                            onChange={(e) => setBibleVerses(e.target.value)}
                            placeholder="Matius 28:19-20, Roma 6:23 (pisahkan koma)"
                            className="h-9 text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Tags</label>
                        <Input
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="murid, amanat agung (pisahkan koma)"
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Images — only available when editing an existing document */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Gambar</label>
                        {!document ? (
                            <p className="text-xs text-muted-foreground">
                                Simpan dokumen dulu untuk bisa mengunggah
                                gambar.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                    {images.map((img) => (
                                        <div
                                            key={img.public_id}
                                            className="group relative"
                                        >
                                            <img
                                                src={img.url}
                                                alt="Gambar"
                                                className="h-20 w-20 rounded-md border border-border object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleRemoveImage(
                                                        img.public_id,
                                                    )
                                                }
                                                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                                            >
                                                <X className="size-3" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            fileInputRef.current?.click()
                                        }
                                        disabled={uploading}
                                        className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                                    >
                                        {uploading ? (
                                            <Loader2 className="size-5 animate-spin" />
                                        ) : (
                                            <ImagePlus className="size-5" />
                                        )}
                                        <span className="text-[10px]">
                                            {uploading ? "Upload..." : "Tambah"}
                                        </span>
                                    </button>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) =>
                                        handleUpload(e.target.files)
                                    }
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving || !content.trim()}
                        >
                            {saving ? "Menyimpan..." : "Simpan"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
