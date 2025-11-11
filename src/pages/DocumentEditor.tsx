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
  Link as LinkIcon,
  Code,
  X,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Block {
  id: string;
  type: "paragraph" | "h1" | "h2" | "h3" | "image" | "pdf" | "link" | "video";
  content: string;
  attachmentData?: string; // For storing file data
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
  type: "image" | "pdf" | "link" | "video";
  data: string; // base64 for images/pdfs/videos, url for links
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
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [pendingAttachmentType, setPendingAttachmentType] = useState<"image" | "pdf" | "video" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load document from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`doc-${id}`);
    if (saved) {
      const data = JSON.parse(saved);
      setTitle(data.title);
      setSections(data.sections);
      setAttachments(data.attachments || []);
    }
  }, [id]);

  // Auto-save document
  useEffect(() => {
    const autoSave = setTimeout(() => {
      const data = { title, sections, attachments };
      localStorage.setItem(`doc-${id}`, JSON.stringify(data));
      
      // Update projects list
      const savedProjects = localStorage.getItem("projects");
      const projects = savedProjects ? JSON.parse(savedProjects) : [];
      
      const projectIndex = projects.findIndex((p: any) => p.id === id);
      const projectData = {
        id: id || Date.now().toString(),
        title,
        description: sections[0]?.content[0]?.content?.substring(0, 100) || "No description",
        lastModified: new Date().toLocaleString(),
        author: "User"
      };
      
      if (projectIndex >= 0) {
        projects[projectIndex] = projectData;
      } else {
        projects.unshift(projectData);
      }
      
      localStorage.setItem("projects", JSON.stringify(projects));
    }, 1000);
    
    return () => clearTimeout(autoSave);
  }, [title, sections, attachments, id]);

  const saveDocument = () => {
    const data = { title, sections, attachments };
    localStorage.setItem(`doc-${id}`, JSON.stringify(data));
    
    // Update projects list
    const savedProjects = localStorage.getItem("projects");
    const projects = savedProjects ? JSON.parse(savedProjects) : [];
    
    const projectIndex = projects.findIndex((p: any) => p.id === id);
    const projectData = {
      id: id || Date.now().toString(),
      title,
      description: sections[0]?.content[0]?.content?.substring(0, 100) || "No description",
      lastModified: new Date().toLocaleString(),
      author: "User"
    };
    
    if (projectIndex >= 0) {
      projects[projectIndex] = projectData;
    } else {
      projects.unshift(projectData);
    }
    
    localStorage.setItem("projects", JSON.stringify(projects));
    
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

  const addSubSection = (parentId: string) => {
    const newSubSection: Section = {
      id: Date.now().toString(),
      title: "New Sub-section",
      content: [],
      parentId,
    };

    const addToParent = (sectionList: Section[]): Section[] => {
      return sectionList.map((section) => {
        if (section.id === parentId) {
          return {
            ...section,
            children: [...(section.children || []), newSubSection],
          };
        }
        if (section.children) {
          return {
            ...section,
            children: addToParent(section.children),
          };
        }
        return section;
      });
    };

    setSections(addToParent(sections));
    setActiveSection(newSubSection.id);
  };

  const deleteSection = (sectionId: string) => {
    const countAllSections = (sectionList: Section[]): number => {
      return sectionList.reduce(
        (count, section) => count + 1 + (section.children ? countAllSections(section.children) : 0),
        0
      );
    };

    if (countAllSections(sections) === 1) {
      toast({
        title: "Cannot delete",
        description: "You must have at least one section.",
        variant: "destructive",
      });
      return;
    }

    const removeSection = (sectionList: Section[]): Section[] => {
      return sectionList.filter((s) => s.id !== sectionId).map((section) => ({
        ...section,
        children: section.children ? removeSection(section.children) : undefined,
      }));
    };

    setSections(removeSection(sections));
    if (activeSection === sectionId) {
      setActiveSection(sections[0].id);
    }
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

  const addBlock = (sectionId: string, type: Block["type"]) => {
    if (type === "image" || type === "pdf" || type === "video") {
      setPendingAttachmentType(type);
      fileInputRef.current?.click();
      setShowBlockTypeMenu(false);
      return;
    }

    const newBlock: Block = {
      id: Date.now().toString(),
      type,
      content: "",
    };

    const section = findSection(sectionId);
    if (section) {
      updateSection(sectionId, "content", [...section.content, newBlock]);
      setCurrentBlockId(newBlock.id);
    }
    setShowBlockTypeMenu(false);
  };

  const addLinkBlock = (sectionId: string) => {
    const url = prompt("Enter the URL:");
    if (!url) return;

    const newBlock: Block = {
      id: Date.now().toString(),
      type: "link",
      content: url,
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

  const deleteBlock = (sectionId: string, blockId: string) => {
    const section = findSection(sectionId);
    if (section) {
      const updatedContent = section.content.filter((block) => block.id !== blockId);
      updateSection(sectionId, "content", updatedContent);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingAttachmentType || !currentSection) return;

    const reader = new FileReader();
    reader.onload = () => {
      const newBlock: Block = {
        id: Date.now().toString(),
        type: pendingAttachmentType,
        content: file.name,
        attachmentData: reader.result as string,
      };

      updateSection(currentSection.id, "content", [...currentSection.content, newBlock]);
      
      toast({
        title: `${pendingAttachmentType.charAt(0).toUpperCase() + pendingAttachmentType.slice(1)} added`,
        description: `${file.name} has been added to the document.`,
      });
      
      setPendingAttachmentType(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };


  const currentSection = findSection(activeSection);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const renderSections = (sectionList: Section[], depth = 0) => {
    return sectionList.map((section) => {
      const hasChildren = section.children && section.children.length > 0;
      const isExpanded = expandedSections.has(section.id);

      return (
        <div key={section.id}>
          <div
            className="group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {hasChildren && (
              <button
                onClick={() => toggleSection(section.id)}
                className="p-0.5 hover:bg-muted-foreground/20 rounded"
              >
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </button>
            )}
            <button
              className={`flex flex-1 items-center gap-2 ${!hasChildren ? "ml-5" : ""}`}
              onClick={() => setActiveSection(section.id)}
            >
              <FileText className="h-4 w-4" />
              <span className={activeSection === section.id ? "font-semibold" : ""}>
                {section.title}
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => addSubSection(section.id)}
              title="Add sub-section"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => deleteSection(section.id)}
              title="Delete section"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          {hasChildren && isExpanded && (
            <div>
              {renderSections(section.children!, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const openPreview = () => {
    saveDocument();
    window.open(`/preview/${id}`, "_blank");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />

      {/* Editor Toolbar */}
      <div className="sticky top-16 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-[300px] text-lg font-semibold"
              placeholder="Document title..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2" onClick={openPreview}>
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button variant="ghost" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="hero" size="sm" className="gap-2" onClick={saveDocument}>
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left Sidebar - Document Structure */}
        <aside className="w-64 border-r bg-muted/30 p-4">
          <div className="mb-4">
            <h3 className="mb-3 text-sm font-semibold">Document Structure</h3>
            <ScrollArea className="h-[calc(100vh-200px)]">
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
          </div>
        </aside>

        {/* Main Editor Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-4xl px-8 py-8">
            <Card className="p-8">
              <div className="space-y-4">
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
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,.pdf"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      
                      {currentSection.content.map((block) => (
                        <div key={block.id} className="group relative">
                          {block.type === "h1" && (
                            <Input
                              value={block.content}
                              onChange={(e) => updateBlock(currentSection.id, block.id, e.target.value)}
                              className="text-3xl font-bold border-0 p-0 focus-visible:ring-0"
                              placeholder="Heading 1"
                            />
                          )}
                          {block.type === "h2" && (
                            <Input
                              value={block.content}
                              onChange={(e) => updateBlock(currentSection.id, block.id, e.target.value)}
                              className="text-2xl font-bold border-0 p-0 focus-visible:ring-0"
                              placeholder="Heading 2"
                            />
                          )}
                          {block.type === "h3" && (
                            <Input
                              value={block.content}
                              onChange={(e) => updateBlock(currentSection.id, block.id, e.target.value)}
                              className="text-xl font-bold border-0 p-0 focus-visible:ring-0"
                              placeholder="Heading 3"
                            />
                          )}
                          {block.type === "paragraph" && (
                            <Textarea
                              value={block.content}
                              onChange={(e) => updateBlock(currentSection.id, block.id, e.target.value)}
                              className="min-h-[100px] resize-none border-0 p-0 text-base focus-visible:ring-0"
                              placeholder="Start typing paragraph..."
                            />
                          )}
                          {block.type === "image" && block.attachmentData && (
                            <div className="my-4">
                              <img 
                                src={block.attachmentData} 
                                alt={block.content}
                                className="max-w-full rounded-lg border shadow-card"
                              />
                              <p className="mt-2 text-sm text-muted-foreground">{block.content}</p>
                            </div>
                          )}
                          {block.type === "pdf" && block.attachmentData && (
                            <div className="my-4 rounded-lg border bg-muted p-4">
                              <div className="flex items-center gap-3">
                                <FileText className="h-6 w-6 text-primary" />
                                <div className="flex-1">
                                  <p className="font-medium">{block.content}</p>
                                  <p className="text-sm text-muted-foreground">PDF Document</p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = block.attachmentData!;
                                    link.download = block.content;
                                    link.click();
                                  }}
                                >
                                  Download
                                </Button>
                              </div>
                            </div>
                          )}
                          {block.type === "video" && block.attachmentData && (
                            <div className="my-4">
                              <video 
                                controls 
                                className="max-w-full rounded-lg border shadow-card"
                                src={block.attachmentData}
                              >
                                Your browser does not support the video tag.
                              </video>
                              <p className="mt-2 text-sm text-muted-foreground">{block.content}</p>
                            </div>
                          )}
                          {block.type === "link" && (
                            <div className="my-4 rounded-lg border bg-muted p-4">
                              <div className="flex items-center gap-3">
                                <LinkIcon className="h-6 w-6 text-primary" />
                                <a 
                                  href={block.content} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex-1 text-primary hover:underline"
                                >
                                  {block.content}
                                </a>
                              </div>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -right-8 top-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => deleteBlock(currentSection.id, block.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}

                      {/* Add Block Menu */}
                      {showBlockTypeMenu ? (
                        <Card className="p-2">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              className="justify-start"
                              onClick={() => addBlock(currentSection.id, "paragraph")}
                            >
                              Paragraph
                            </Button>
                            <Button
                              variant="ghost"
                              className="justify-start text-3xl font-bold"
                              onClick={() => addBlock(currentSection.id, "h1")}
                            >
                              Heading 1
                            </Button>
                            <Button
                              variant="ghost"
                              className="justify-start text-2xl font-bold"
                              onClick={() => addBlock(currentSection.id, "h2")}
                            >
                              Heading 2
                            </Button>
                            <Button
                              variant="ghost"
                              className="justify-start text-xl font-bold"
                              onClick={() => addBlock(currentSection.id, "h3")}
                            >
                              Heading 3
                            </Button>
                            <Separator className="my-1" />
                            <Button
                              variant="ghost"
                              className="justify-start gap-2"
                              onClick={() => addBlock(currentSection.id, "image")}
                            >
                              <ImageIcon className="h-4 w-4" />
                              Image
                            </Button>
                            <Button
                              variant="ghost"
                              className="justify-start gap-2"
                              onClick={() => addBlock(currentSection.id, "pdf")}
                            >
                              <FileText className="h-4 w-4" />
                              PDF
                            </Button>
                            <Button
                              variant="ghost"
                              className="justify-start gap-2"
                              onClick={() => addLinkBlock(currentSection.id)}
                            >
                              <LinkIcon className="h-4 w-4" />
                              Link
                            </Button>
                            <Button
                              variant="ghost"
                              className="justify-start gap-2"
                              onClick={() => addBlock(currentSection.id, "video")}
                            >
                              <Code className="h-4 w-4" />
                              Video (MP4)
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
              </div>
            </Card>
          </div>
        </main>

      </div>
    </div>
  );
};

export default DocumentEditor;