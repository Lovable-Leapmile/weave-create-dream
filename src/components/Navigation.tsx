import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
export const Navigation = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      const { error } = await signOut();
      if (error) throw error;
      
      // Clear any local state
      localStorage.clear();
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      
      // Force navigation to login using React Router
      navigate("/login", { replace: true });
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  return <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src="https://leapmile-website.blr1.digitaloceanspaces.com/leapmile.png" alt="Leapmile Robotics" className="h-7" />
        </Link>

        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <button onClick={() => window.location.reload()} className="transition-colors hover:text-primary">
              Home
            </button>
            <a href="https://www.leapmile.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-primary">
              Website
            </a>
            <a href="https://www.leapmile.com/#contact" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-primary">
              Contact Us
            </a>
          </nav>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>;
};