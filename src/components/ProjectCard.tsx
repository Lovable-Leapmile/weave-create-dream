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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useState } from "react";
import { getDocumentById, saveDocument as saveToLocalStorage, deleteDocument, generateId, type Document } from "@/lib/localStorage";

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = () => {
    navigate(`/editor/${id}`);
  };

  const handleDuplicate = () => {
    try {
      // Get the original document from localStorage
      const originalDoc = getDocumentById(id);

      if (!originalDoc) {
        toast.error("Original document not found");
        return;
      }

      // Create a duplicate
      const newDoc: Document = {
        ...originalDoc,
        id: generateId(),
        title: `${originalDoc.title} (Copy)`,
        lastModified: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      saveToLocalStorage(newDoc);
      toast.success("Project duplicated successfully");
      onUpdate?.();
    } catch (error) {
      console.error("Error duplicating project:", error);
      toast.error("Failed to duplicate project");
    }
  };

  const handleExport = () => {
    try {
      const docData = getDocumentById(id);

      if (!docData) {
        toast.error("Document not found");
        return;
      }

      const exportData = {
        title: docData.title,
        description: docData.description,
        content: docData.content,
        lastModified: docData.lastModified,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Project exported successfully");
    } catch (error) {
      console.error("Error exporting project:", error);
      toast.error("Failed to export project");
    }
  };

  const handleDelete = () => {
    setIsDeleting(true);
    try {
      deleteDocument(id);
      toast.success("Project deleted successfully");
      setShowDeleteDialog(false);
      onUpdate?.();
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
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
                <DropdownMenuItem className="text-destructive" onClick={() => setShowDeleteDialog(true)}>
                  Delete
                </DropdownMenuItem>
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
