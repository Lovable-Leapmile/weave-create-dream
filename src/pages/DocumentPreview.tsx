import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Block {
  id: string;
  type: "paragraph" | "h1" | "h2" | "h3";
  content: string;
}

interface Section {
  id: string;
  title: string;
  content: Block[];
  children?: Section[];
}

const DocumentPreview = () => {
  const { id } = useParams();
  const [title, setTitle] = useState("Untitled Document");
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSection, setActiveSection] = useState("1");

  useEffect(() => {
    const saved = localStorage.getItem(`doc-${id}`);
    if (saved) {
      const data = JSON.parse(saved);
      setTitle(data.title || "Untitled Document");
      setSections(data.sections || []);
      if (data.sections && data.sections.length > 0) {
        setActiveSection(data.sections[0].id);
      }
    }
  }, [id]);

  const renderContent = (blocks: Block[]) => {
    return blocks.map((block) => {
      if (block.type === "h1") {
        return (
          <h1 key={block.id} className="text-3xl font-bold mb-4">
            {block.content}
          </h1>
        );
      }
      return (
        <p key={block.id} className="text-base leading-7 mb-4">
          {block.content}
        </p>
      );
    });
  };

  const currentSection = sections.find((s) => s.id === activeSection);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-hero">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Leapmile Robotics
            </span>
          </Link>
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search documentation..."
              className="w-[200px] pl-8 lg:w-[300px]"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-64 border-r bg-muted/30">
          <ScrollArea className="h-[calc(100vh-4rem)]">
            <div className="p-4">
              <h2 className="mb-4 text-lg font-bold">{title}</h2>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                      activeSection === section.id
                        ? "bg-muted font-semibold text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-4xl px-8 py-12">
            {currentSection && (
              <div>
                <h1 className="mb-6 text-4xl font-bold">{currentSection.title}</h1>
                <div className="prose prose-lg max-w-none">
                  {renderContent(currentSection.content)}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DocumentPreview;
