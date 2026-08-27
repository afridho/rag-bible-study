import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setAdminCredentials } from "@/lib/admin-api";

interface AdminLoginProps {
    onSuccess: () => void;
    error?: string;
}

export function AdminLogin({ onSuccess, error }: AdminLoginProps) {
    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!user.trim() || !pass) return;
        setAdminCredentials(user.trim(), pass);
        onSuccess();
    }

    return (
        <div className="flex min-h-svh items-center justify-center bg-background px-6">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6"
            >
                <div className="flex flex-col items-center text-center">
                    <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                        <Lock className="size-5 text-muted-foreground" />
                    </div>
                    <h1 className="text-lg font-semibold">Admin Login</h1>
                    <p className="text-xs text-muted-foreground">
                        Masukkan kredensial untuk mengakses admin.
                    </p>
                </div>

                {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
                        {error}
                    </p>
                )}

                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Username</label>
                    <Input
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        autoFocus
                        className="h-9 text-sm"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Password</label>
                    <Input
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        className="h-9 text-sm"
                    />
                </div>

                <Button
                    type="submit"
                    className="w-full"
                    disabled={!user.trim() || !pass}
                >
                    Masuk
                </Button>
            </form>
        </div>
    );
}
