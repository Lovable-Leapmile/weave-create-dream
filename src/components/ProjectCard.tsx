import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, User, MoreVertical } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ProjectCardProps {
  id: string;
  title: string;
  description: string;
  lastModified: string;
  author: string;
  onUpdate?: () => void;
}

export const ProjectCard = ({ id, title, description, lastModified, author, onUpdate }: ProjectCardProps) => {
  const navigate = useNavigate();

  const handleEdit = () => {
    navigate(`/editor/${id}`);
  };

  const handleDuplicate = () => {
    // Load the original document
    const originalDoc = localStorage.getItem(`doc-${id}`);
    if (originalDoc) {
      const docData = JSON.parse(originalDoc);
      const newId = Date.now().toString();
      
      // Save duplicated document
      localStorage.setItem(`doc-${newId}`, JSON.stringify({
        ...docData,
        title: `${docData.title} (Copy)`
      }));
      
      // Update projects list
      const savedProjects = localStorage.getItem("projects");
      const projects = savedProjects ? JSON.parse(savedProjects) : [];
      projects.unshift({
        id: newId,
        title: `${docData.title} (Copy)`,
        description,
        lastModified: new Date().toLocaleString(),
        author
      });
      localStorage.setItem("projects", JSON.stringify(projects));
      
      toast.success("Project duplicated successfully");
      onUpdate?.();
    }
  };

  const handleExport = () => {
    const docData = localStorage.getItem(`doc-${id}`);
    if (docData) {
      const blob = new Blob([docData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Project exported successfully");
    }
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      // Remove document
      localStorage.removeItem(`doc-${id}`);
      
      // Update projects list
      const savedProjects = localStorage.getItem("projects");
      if (savedProjects) {
        const projects = JSON.parse(savedProjects);
        const updatedProjects = projects.filter((p: any) => p.id !== id);
        localStorage.setItem("projects", JSON.stringify(updatedProjects));
      }
      
      toast.success("Project deleted successfully");
      onUpdate?.();
    }
  };
  return (
    <Card className="group transition-all duration-300 hover:shadow-hover">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>Duplicate</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>Export</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={handleDelete}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{lastModified}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{author}</span>
            </div>
          </div>
          <Link to={`/editor/${id}`}>
            <Button variant="secondary" size="sm">
              Open
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
