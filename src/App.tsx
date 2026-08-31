import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ChatLayout } from "@/components/chat-layout";
import { AdminPage } from "@/components/admin/admin-page";
import { Toaster } from "@/components/ui/toast";

function getSidebarDefault(): boolean {
    const match = document.cookie.match(/(?:^|; )sidebar_state=([^;]*)/);
    if (match) return match[1] === "true";
    return true;
}

function ChatView() {
    return (
        <TooltipProvider>
            <SidebarProvider defaultOpen={getSidebarDefault()}>
                <ChatLayout />
            </SidebarProvider>
        </TooltipProvider>
    );
}

function App() {
    return (
        <ThemeProvider defaultTheme="system">
            <Toaster>
                <BrowserRouter>
                    <Routes>
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="*" element={<ChatView />} />
                    </Routes>
                </BrowserRouter>
            </Toaster>
        </ThemeProvider>
    );
}

export default App;
