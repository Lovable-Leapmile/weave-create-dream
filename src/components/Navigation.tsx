import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText } from "lucide-react";

export const Navigation = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <img 
            src="https://leapmile-website.blr1.digitaloceanspaces.com/leapmile.png" 
            alt="Leapmile Robotics" 
            className="h-10"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link to="/" className="transition-colors hover:text-primary">
            Home
          </Link>
          <a href="#" className="transition-colors hover:text-primary">
            Website
          </a>
          <a href="#contact" className="transition-colors hover:text-primary">
            Contact Us
          </a>
        </nav>
      </div>
    </header>
  );
};
