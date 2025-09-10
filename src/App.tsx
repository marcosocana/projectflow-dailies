import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProjectThemeProvider } from "@/contexts/ProjectThemeContext";
import FloatingChatbot from "@/components/FloatingChatbot";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminProjects from "./pages/AdminProjects";
import ExternalIncident from "./pages/ExternalIncident";

const queryClient = new QueryClient();

const AppContent = () => {
  const { currentProject } = useProjectAccess();
  
  console.log('Current project in App:', currentProject); // Debug log
  
  return (
    <>
      <Routes>
        <Route path="/*" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/newincidence" element={<ExternalIncident />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="/admin" element={<AdminProjects />} />
      </Routes>
      <FloatingChatbot />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ProjectThemeProvider>
          <AppContent />
        </ProjectThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
