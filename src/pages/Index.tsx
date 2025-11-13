import { useState, useEffect, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Upload, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getUserDocuments, saveDocument, generateId } from "@/lib/localStorage";
import { exportBackup, importBackup, restoreBackup, importDocument, getAutoBackups } from "@/lib/backup";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [recentProjects, setRecentProjects] = useState<Array<{
    id: string;
    title: string;
    description: string;
    lastModified: string;
    author: string;
  }>>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement>(null);
  const importDocInputRef = useRef<HTMLInputElement>(null);
  const [showAutoBackups, setShowAutoBackups] = useState(false);

  // Load projects from localStorage
  const loadProjects = () => {
    if (!user) return;

    const documents = getUserDocuments(user.id);
    const sorted = documents.sort((a, b) => 
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );

    setRecentProjects(
      sorted.map((doc) => ({
        id: doc.id,
        title: doc.title,
        description: doc.description || "No description",
        lastModified: new Date(doc.lastModified).toLocaleString(),
        author: user.mobileNumber || "User",
      }))
    );
  };

  useEffect(() => {
    loadProjects();
  }, [user]);

  const handleExportBackup = () => {
    exportBackup();
    toast({
      title: "Backup Exported",
      description: "All projects have been exported successfully.",
    });
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const backup = await importBackup(file);
      restoreBackup(backup, user.id);
      loadProjects();
      toast({
        title: "Backup Imported",
        description: `Successfully restored ${backup.documents.length} documents.`,
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import backup file. Please check the file format.",
        variant: "destructive",
      });
    }
    
    // Reset input
    if (importInputRef.current) {
      importInputRef.current.value = '';
    }
  };

  const handleImportDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const document = await importDocument(file);
      // Generate new ID and update user ID
      const newDocument = {
        ...document,
        id: generateId(),
        userId: user.id,
        lastModified: new Date().toISOString(),
      };
      saveDocument(newDocument);
      loadProjects();
      toast({
        title: "Document Imported",
        description: `Successfully imported "${document.title}".`,
      });
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import document. Please check the file format.",
        variant: "destructive",
      });
    }
    
    // Reset input
    if (importDocInputRef.current) {
      importDocInputRef.current.value = '';
    }
  };

  const handleRestoreAutoBackup = (backupKey: string) => {
    if (!user) return;
    
    const backupData = localStorage.getItem(backupKey);
    if (!backupData) return;

    try {
      const backup = JSON.parse(backupData);
      restoreBackup(backup, user.id);
      loadProjects();
      setShowAutoBackups(false);
      toast({
        title: "Backup Restored",
        description: "Auto-backup has been restored successfully.",
      });
    } catch (error) {
      toast({
        title: "Restore Failed",
        description: "Failed to restore auto-backup.",
        variant: "destructive",
      });
    }
  };
  return <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-hero py-20 text-primary-foreground">
        <div className="container relative z-10 px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight">
              Documentation Builder
            </h1>
            <p className="mb-8 text-lg opacity-90">
              Create, edit, and publish comprehensive technical documentation with ease.
              Build structured documents with our intuitive interface.
            </p>
            <div className="flex justify-center">
              <Link to="/editor/new">
                <Button variant="secondary" size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  New Document
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:30px_30px]" />
      </section>

      {/* Features Section */}
      <section className="py-12 border-b">
        <div className="container px-4">
          
        </div>
      </section>

      {/* Recent Projects Section */}
      <section className="py-12">
        <div className="container px-4">
          <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-3xl font-bold">Recent Projects</h2>
            <div className="flex items-center gap-2">
              <input
                ref={importDocInputRef}
                type="file"
                accept=".json"
                onChange={handleImportDocument}
                className="hidden"
              />
              <Button
                variant="default"
                size="default"
                onClick={() => importDocInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Import Project
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="default" className="gap-2">
                    <Download className="h-4 w-4" />
                    Backup Options
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportBackup}>
                    <Download className="h-4 w-4 mr-2" />
                    Export All Projects
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => importInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import All Projects
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAutoBackups(true)}>
                    View Auto-Backups
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </div>
          </div>
          <div className="mb-4 relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" placeholder="Search projects..." className="pl-9" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map(project => <ProjectCard key={project.id} {...project} onUpdate={loadProjects} />)}
          </div>

          {recentProjects.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-4 h-16 w-16 text-muted-foreground/50" />
              <h3 className="mb-2 text-xl font-semibold">No projects yet</h3>
              <p className="mb-6 text-muted-foreground">
                Get started by creating your first documentation project
              </p>
              <Link to="/editor/new">
                <Button variant="hero" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Create Your First Project
                </Button>
              </Link>
            </div>}
        </div>
      </section>

      <Dialog open={showAutoBackups} onOpenChange={setShowAutoBackups}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auto-Backups</DialogTitle>
            <DialogDescription>
              System automatically creates backups every 10 minutes. Click to restore any backup.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {getAutoBackups().map((backup) => (
              <div
                key={backup.key}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                onClick={() => handleRestoreAutoBackup(backup.key)}
              >
                <div>
                  <p className="font-medium">
                    {backup.timestamp.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {backup.backup.documents.length} documents
                  </p>
                </div>
                <Button size="sm" variant="outline">
                  Restore
                </Button>
              </div>
            ))}
            {getAutoBackups().length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No auto-backups available yet
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default Index;