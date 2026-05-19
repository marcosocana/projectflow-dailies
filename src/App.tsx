import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProjectThemeProvider } from "@/contexts/ProjectThemeContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminProjects from "./pages/AdminProjects";
import ExternalIncident from "./pages/ExternalIncident";
import ExternalTaskCreate from "./pages/ExternalTaskCreate";

const queryClient = new QueryClient();

const AppContent = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/newincidence" element={<ExternalIncident />} />
    <Route path="/newtask" element={<ExternalTaskCreate />} />
    <Route path="/admin" element={<AdminProjects />} />
    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
    <Route path="/*" element={<Index />} />
  </Routes>
);

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
