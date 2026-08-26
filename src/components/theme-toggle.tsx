import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
            <button
                onClick={() => setTheme("light")}
                className={`rounded p-1.5 transition-colors ${theme === "light" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Light"
            >
                <Sun className="h-3.5 w-3.5" />
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={`rounded p-1.5 transition-colors ${theme === "dark" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Dark"
            >
                <Moon className="h-3.5 w-3.5" />
            </button>
            <button
                onClick={() => setTheme("system")}
                className={`rounded p-1.5 transition-colors ${theme === "system" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="System"
            >
                <Monitor className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
