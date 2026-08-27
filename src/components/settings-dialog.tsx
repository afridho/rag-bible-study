import { useState, type FormEvent } from "react";
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

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    nickname: string | null;
    onSaveNickname: (name: string) => void;
    /** When true, the dialog is used for first-time onboarding (cannot dismiss without a name) */
    forceComplete?: boolean;
}

export function SettingsDialog({
    open,
    onOpenChange,
    nickname,
    onSaveNickname,
    forceComplete = false,
}: SettingsDialogProps) {
    const [value, setValue] = useState(nickname || "");

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) {
            onSaveNickname(trimmed);
            onOpenChange(false);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                // Prevent closing during onboarding until a name is provided
                if (forceComplete && !o && !nickname) return;
                onOpenChange(o);
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {forceComplete
                            ? "Siapa nama panggilan kamu?"
                            : "Pengaturan"}
                    </DialogTitle>
                    <DialogDescription>
                        {forceComplete
                            ? "Supaya asisten bisa memanggil kamu dengan nama panggilan."
                            : "Atur preferensi kamu di sini."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label
                            htmlFor="nickname"
                            className="text-sm font-medium"
                        >
                            Nama Panggilan
                        </label>
                        <Input
                            id="nickname"
                            autoFocus
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Contoh: Dho"
                            className="h-9 text-sm"
                        />
                    </div>

                    {/* Add more settings here in the future */}

                    <DialogFooter>
                        <Button type="submit" disabled={!value.trim()}>
                            Simpan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
