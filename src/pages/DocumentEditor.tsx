import { useState, useEffect, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Save,
  Download,
  Eye,
  Upload,
  Plus,
  Trash2,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

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
  parentId?: string;
}

interface Attachment {
  id: string;
  name: string;
  type: "image" | "pdf" | "link";
  data: string;
}

const DocumentEditor = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [title, setTitle] = useState("Untitled Document");
  const [sections, setSections] = useState<Section[]>([
    { id: "1", title: "Introduction", content: [] },
  ]);
  const [activeSection, setActiveSection] = useState("1");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showBlockTypeMenu, setShowBlockTypeMenu] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`doc-${id}`);
    if (saved) {
      const data = JSON.parse(saved);
      setTitle(data.title);
      setSections(data.sections);
      setAttachments(data.attachments || []);
    }
  }, [id]);

  const saveDocument = () => {
    const data = { title, sections, attachments };
    localStorage.setItem(`doc-${id}`, JSON.stringify(data));
    toast({
      title: "Document saved",
      description: "Your changes have been saved successfully.",
    });
  };

  const addSection = () => {
    const newSection: Section = {
      id: Date.now().toString(),
      title: "New Section",
      content: [],
    };
    setSections([...sections, newSection]);
    setActiveSection(newSection.id);
  };

  const findSection = (id: string, sectionList: Section[] = sections): Section | undefined => {
    for (const section of sectionList) {
      if (section.id === id) return section;
      if (section.children) {
        const found = findSection(id, section.children);
        if (found) return found;
      }
    }
    return undefined;
  };

  const updateSection = (id: string, field: keyof Section, value: any) => {
    const updateInList = (sectionList: Section[]): Section[] => {
      return sectionList.map((section) => {
        if (section.id === id) {
          return { ...section, [field]: value };
        }
        if (section.children) {
          return {
            ...section,
            children: updateInList(section.children),
          };
        }
        return section;
      });
    };
    setSections(updateInList(sections));
  };

  const addBlock = (sectionId: string, type: Block["type"]) => {
    const newBlock: Block = {
      id: Date.now().toString(),
      type,
      content: "",
    };
    const section = findSection(sectionId);
    if (section) {
      updateSection(sectionId, "content", [...section.content, newBlock]);
    }
    setShowBlockTypeMenu(false);
  };

  const updateBlock = (sectionId: string, blockId: string, content: string) => {
    const section = findSection(sectionId);
    if (section) {
      const updatedContent = section.content.map((block) =>
        block.id === blockId ? { ...block, content } : block
      );
      updateSection(sectionId, "content", updatedContent);
    }
  };

  const currentSection = findSection(activeSection);

  const renderSections = (sectionList: Section[], depth = 0) => {
    return sectionList.map((section) => (
      <div key={section.id}>
        <button
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${
            activeSection === section.id ? "bg-muted font-semibold" : ""
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setActiveSection(section.id)}
        >
          <FileText className="h-4 w-4" />
          <span>{section.title}</span>
        </button>
      </div>
    ));
  };

  const openPreview = () => {
    saveDocument();
    window.open(`/preview/${id}`, "_blank");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />

      <div className="sticky top-16 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-between px-4 py-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-[300px] text-lg font-semibold"
            placeholder="Document title..."
          />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2" onClick={openPreview}>
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button variant="hero" size="sm" className="gap-2" onClick={saveDocument}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        <aside className="w-64 border-r bg-muted/30 p-4">
          <h3 className="mb-3 text-sm font-semibold">Document Structure</h3>
          <ScrollArea className="h-[300px]">
            <div className="space-y-1">{renderSections(sections)}</div>
          </ScrollArea>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2"
            onClick={addSection}
          >
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-4xl px-8 py-8">
            <Card className="p-8">
              {currentSection && (
                <div>
                  <Input
                    value={currentSection.title}
                    onChange={(e) =>
                      updateSection(currentSection.id, "title", e.target.value)
                    }
                    className="mb-6 text-2xl font-bold"
                    placeholder="Section title..."
                  />

                  <div className="space-y-4">
                    {currentSection.content.map((block) => (
                      <div key={block.id} className="group relative">
                        {block.type === "paragraph" && (
                          <Textarea
                            value={block.content}
                            onChange={(e) => updateBlock(currentSection.id, block.id, e.target.value)}
                            className="min-h-[100px] resize-none border-0 p-0 text-base focus-visible:ring-0"
                            placeholder="Start typing..."
                          />
                        )}
                        {block.type === "h1" && (
                          <Input
                            value={block.content}
                            onChange={(e) => updateBlock(currentSection.id, block.id, e.target.value)}
                            className="text-3xl font-bold border-0 p-0 focus-visible:ring-0"
                            placeholder="Heading 1"
                          />
                        )}
                      </div>
                    ))}

                    {showBlockTypeMenu ? (
                      <Card className="p-2">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            onClick={() => addBlock(currentSection.id, "paragraph")}
                          >
                            Paragraph
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => addBlock(currentSection.id, "h1")}
                          >
                            Heading 1
                          </Button>
                        </div>
                      </Card>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={() => setShowBlockTypeMenu(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Add content block
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DocumentEditor;
