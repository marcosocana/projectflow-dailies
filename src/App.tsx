import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProjectThemeProvider } from "@/contexts/ProjectThemeContext";

const queryClient = new QueryClient();
const AdminProjects = lazy(() => import("./pages/AdminProjects"));
const Auth = lazy(() => import("./pages/Auth"));
const ExternalIncident = lazy(() => import("./pages/ExternalIncident"));
const ExternalTaskCreate = lazy(() => import("./pages/ExternalTaskCreate"));
const Index = lazy(() => import("./pages/Index"));

const PageLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
    Cargando...
  </div>
);

const AppContent = () => (
  <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/newincidence" element={<ExternalIncident />} />
      <Route path="/newtask" element={<ExternalTaskCreate />} />
      <Route path="/admin" element={<AdminProjects />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="/*" element={<Index />} />
    </Routes>
  </Suspense>
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
