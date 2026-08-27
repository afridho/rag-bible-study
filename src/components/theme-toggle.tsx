import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const items = [
        { value: "light" as const, icon: Sun, label: "Light" },
        { value: "dark" as const, icon: Moon, label: "Dark" },
        { value: "system" as const, icon: Monitor, label: "System" },
    ];

    return (
        <div className="flex items-center justify-between gap-1 rounded-lg border border-border bg-muted/50 p-1">
            {items.map(({ value, icon: Icon, label }) => (
                <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
                        theme === value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                    title={label}
                >
                    <Icon className="size-3.5" />
                </button>
            ))}
        </div>
    );
}
