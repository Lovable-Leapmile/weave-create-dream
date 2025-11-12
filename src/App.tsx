import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import DocumentEditor from "./pages/DocumentEditor";
import DocumentPreview from "./pages/DocumentPreview";
import NotFound from "./pages/NotFound";
import { useAuth } from "./hooks/useAuth";

// Get base path from Vite's BASE_URL (automatically set from vite.config.ts base option)
// This works with both VITE_APP_BASE env var and --base CLI flag
// BASE_URL already includes trailing slash, but BrowserRouter expects it without trailing slash for root
const BASE_PATH = import.meta.env.BASE_URL === "/" ? "/" : import.meta.env.BASE_URL.slice(0, -1);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// Root route component that redirects to login if not authenticated, or shows home if authenticated
// This ensures first-time visitors (not authenticated) see the login page immediately
const RootRoute = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  // If user is authenticated, show the home page
  if (user) {
    return <Index />;
  }
  
  // If not authenticated, redirect to login page
  // This ensures first-time visitors see the login page
  return <Navigate to="/login" replace />;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={BASE_PATH}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRoute />} />
          <Route path="/editor/:id" element={<ProtectedRoute><DocumentEditor /></ProtectedRoute>} />
          <Route path="/preview/:id" element={<ProtectedRoute><DocumentPreview /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
