import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ChatLayout } from "@/components/chat-layout";
import { Toaster } from "@/components/ui/toast";

function getSidebarDefault(): boolean {
    const match = document.cookie.match(/(?:^|; )sidebar_state=([^;]*)/);
    if (match) return match[1] === "true";
    return true;
}

function App() {
    return (
        <ThemeProvider defaultTheme="dark">
            <Toaster>
                <TooltipProvider>
                    <SidebarProvider defaultOpen={getSidebarDefault()}>
                        <ChatLayout />
                    </SidebarProvider>
                </TooltipProvider>
            </Toaster>
        </ThemeProvider>
    );
}

export default App;
