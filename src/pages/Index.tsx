import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Zap, Users } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // Mock data for recent projects
  const recentProjects = [
    {
      id: "1",
      title: "System Integration Guide",
      description: "Complete guide for partner system integration",
      lastModified: "2 hours ago",
      author: "John Doe",
    },
    {
      id: "2",
      title: "API Documentation",
      description: "RESTful API endpoints and authentication",
      lastModified: "1 day ago",
      author: "Jane Smith",
    },
    {
      id: "3",
      title: "Robotics Platform Overview",
      description: "Technical specifications and capabilities",
      lastModified: "3 days ago",
      author: "Mike Johnson",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
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
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/editor/new">
                <Button variant="secondary" size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  New Document
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="gap-2 bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20">
                <FileText className="h-5 w-5" />
                View Templates
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:30px_30px]" />
      </section>

      {/* Features Section */}
      <section className="py-12 border-b">
        <div className="container px-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-muted/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Fast & Intuitive</h3>
              <p className="text-sm text-muted-foreground">
                Build documentation quickly with our drag-and-drop interface and live preview
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-muted/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
                <FileText className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Rich Content</h3>
              <p className="text-sm text-muted-foreground">
                Embed PDFs, images, videos, and code snippets seamlessly in your docs
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-muted/50">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Collaboration</h3>
              <p className="text-sm text-muted-foreground">
                Version control and team editing for seamless documentation workflows
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Projects Section */}
      <section className="py-12">
        <div className="container px-4">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-3xl font-bold">Recent Projects</h2>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search projects..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project) => (
              <ProjectCard key={project.id} {...project} />
            ))}
          </div>

          {recentProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
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
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Index;
