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
  data: string; // base64 for images/pdfs, url for links
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const newAttachment: Attachment = {
        id: Date.now().toString(),
        name: file.name,
        type: "image",
        data: reader.result as string,
      };
      setAttachments([...attachments, newAttachment]);
      toast({
        title: "Image attached",
        description: `${file.name} has been added to attachments.`,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const newAttachment: Attachment = {
        id: Date.now().toString(),
        name: file.name,
        type: "pdf",
        data: reader.result as string,
      };
      setAttachments([...attachments, newAttachment]);
      toast({
        title: "PDF attached",
        description: `${file.name} has been added to attachments.`,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const insertAttachment = (attachment: Attachment, blockId: string) => {
    if (!currentSection) return;

    let insertText = "";
    if (attachment.type === "image") {
      insertText = `[IMAGE:${attachment.id}:${attachment.name}]`;
    } else if (attachment.type === "pdf") {
      insertText = `[PDF:${attachment.id}:${attachment.name}]`;
    }

    const block = currentSection.content.find((b) => b.id === blockId);
    if (block) {
      updateBlock(currentSection.id, blockId, block.content + insertText);
      toast({
        title: "Attachment inserted",
        description: `${attachment.name} has been inserted.`,
      });
    }
  };

  const deleteAttachment = (attachmentId: string) => {
    setAttachments(attachments.filter((a) => a.id !== attachmentId));
    toast({
      title: "Attachment removed",
      description: "The attachment has been deleted.",
    });
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
          </div>

          <Separator className="my-4" />

          <div className="mb-4">
            <h3 className="mb-3 text-sm font-semibold">Attachments</h3>
            <div className="space-y-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handlePdfUpload}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => imageInputRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4" />
                Add Image
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => pdfInputRef.current?.click()}
              >
                <FileText className="h-4 w-4" />
                Add PDF
              </Button>
            </div>

            {attachments.length > 0 && (
              <ScrollArea className="mt-4 h-[200px]">
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="group flex items-center justify-between gap-2 rounded-md border bg-background p-2 text-sm"
                    >
                      <div className="flex flex-1 items-center gap-2 overflow-hidden text-left">
                        {attachment.type === "image" ? (
                          <ImageIcon className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <FileText className="h-4 w-4 flex-shrink-0" />
                        )}
                        <span className="truncate" title={attachment.name}>{attachment.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteAttachment(attachment.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -right-8 top-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => deleteBlock(currentSection.id, block.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>

                          {/* Attachment insert buttons for this block */}
                          {attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2 opacity-0 group-hover:opacity-100">
                              {attachments.map((attachment) => (
                                <Button
                                  key={attachment.id}
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => insertAttachment(attachment, block.id)}
                                >
                                  {attachment.type === "image" ? (
                                    <ImageIcon className="h-3 w-3 mr-1" />
                                  ) : (
                                    <FileText className="h-3 w-3 mr-1" />
                                  )}
                                  Insert {attachment.name.substring(0, 15)}...
                                </Button>
                              ))}
                            </div>
                          )}
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