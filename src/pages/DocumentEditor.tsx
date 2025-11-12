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
  AlertCircle,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
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
  const [insertAfterBlockId, setInsertAfterBlockId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);

  // Load document from database
  useEffect(() => {
    const loadDocument = async () => {
      if (!user || !id) return;

      if (id === "new") {
        // Create new document
        const { data, error } = await supabase
          .from("documents")
          .insert({
            user_id: user.id,
            title: "Untitled Document",
            description: "",
            content: { sections: [{ id: "1", title: "Introduction", content: [] }] } as any,
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating document:", error);
          toast({
            title: "Error",
            description: "Failed to create document.",
            variant: "destructive",
          });
          return;
        }

        if (data) {
          navigate(`/editor/${data.id}`, { replace: true });
        }
      } else {
        // Load existing document
        const { data, error } = await supabase
          .from("documents")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          console.error("Error loading document:", error);
          return;
        }

        if (data) {
          setTitle(data.title);
          const content = data.content as { sections?: Section[] };
          setSections(content.sections || [{ id: "1", title: "Introduction", content: [] }]);
        }
      }
    };

    loadDocument();
  }, [id, user, navigate]);

  // Auto-save document to database
  useEffect(() => {
    if (!user || !id || id === "new") return;

    const autoSave = setTimeout(async () => {
      const description = sections[0]?.content[0]?.content?.substring(0, 100) || "";
      
      const { error } = await supabase
        .from("documents")
        .update({
          title,
          description,
          content: { sections } as any,
        })
        .eq("id", id);

      if (error) {
        console.error("Auto-save error:", error);
      }
    }, 2000);

    return () => clearTimeout(autoSave);
  }, [title, sections, id, user]);

  const saveDocument = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to save your document.",
        variant: "destructive",
      });
      return;
    }

    if (!id || id === "new") {
      toast({
        title: "Error",
        description: "Cannot save a new document. Please wait for it to be created.",
        variant: "destructive",
      });
      return;
    }

    const description = sections[0]?.content[0]?.content?.substring(0, 100) || "";
    
    try {
      const { error } = await supabase
        .from("documents")
        .update({
          title,
          description,
          content: { sections } as any,
          last_modified: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Save error:", error);
        toast({
          title: "Error",
          description: `Failed to save document: ${error.message}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Document saved",
          description: "Your changes have been saved successfully.",
        });
      }
    } catch (err) {
      console.error("Save exception:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving.",
        variant: "destructive",
      });
    }
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
    setDeleteSectionId(null);
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

  const addBlock = (sectionId: string, type: Block["type"], afterBlockId?: string) => {
    if (type === "image" || type === "pdf" || type === "video") {
      setPendingAttachmentType(type);
      fileInputRef.current?.click();
      setShowBlockTypeMenu(false);
      setInsertAfterBlockId(null);
      return;
    }

    const newBlock: Block = {
      id: Date.now().toString(),
      type,
      content: "",
    };

    const section = findSection(sectionId);
    if (section) {
      if (afterBlockId) {
        const blockIndex = section.content.findIndex((b) => b.id === afterBlockId);
        const newContent = [...section.content];
        newContent.splice(blockIndex + 1, 0, newBlock);
        updateSection(sectionId, "content", newContent);
      } else {
        updateSection(sectionId, "content", [...section.content, newBlock]);
      }
      setCurrentBlockId(newBlock.id);
    }
    setShowBlockTypeMenu(false);
    setInsertAfterBlockId(null);
  };

  const addLinkBlock = (sectionId: string, afterBlockId?: string) => {
    const url = prompt("Enter the URL:");
    if (!url) return;

    const newBlock: Block = {
      id: Date.now().toString(),
      type: "link",
      content: url,
    };

    const section = findSection(sectionId);
    if (section) {
      if (afterBlockId) {
        const blockIndex = section.content.findIndex((b) => b.id === afterBlockId);
        const newContent = [...section.content];
        newContent.splice(blockIndex + 1, 0, newBlock);
        updateSection(sectionId, "content", newContent);
      } else {
        updateSection(sectionId, "content", [...section.content, newBlock]);
      }
    }
    setShowBlockTypeMenu(false);
    setInsertAfterBlockId(null);
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
    setDeleteConfirmId(null);
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
              onClick={() => setDeleteSectionId(section.id)}
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

  const openPreview = async () => {
    await saveDocument();
    window.open(`/preview/${id}`, "_blank");
  };

  const exportDocument = async () => {
    await saveDocument();
    
    const flattenSections = (sectionList: Section[]): Section[] => {
      const result: Section[] = [];
      sectionList.forEach((section) => {
        result.push(section);
        if (section.children) {
          result.push(...flattenSections(section.children));
        }
      });
      return result;
    };

    const allSections = flattenSections(sections);

    const renderBlockHTML = (block: Block): string => {
      if (block.type === "h1") {
        return `<h1 class="text-3xl font-bold mb-4">${block.content}</h1>`;
      }
      if (block.type === "h2") {
        return `<h2 class="text-2xl font-bold mb-3">${block.content}</h2>`;
      }
      if (block.type === "h3") {
        return `<h3 class="text-xl font-bold mb-2">${block.content}</h3>`;
      }
      if (block.type === "image" && block.attachmentData) {
        return `<div class="my-4"><img src="${block.attachmentData}" alt="${block.content}" class="max-w-full rounded-lg border" style="box-shadow: 0 4px 20px -2px rgba(37, 99, 235, 0.08);"/><p class="mt-2 text-sm text-gray-500">${block.content}</p></div>`;
      }
      if (block.type === "pdf" && block.attachmentData) {
        return `<div class="my-4 rounded-lg border p-4 bg-gray-50"><div class="flex items-center gap-3"><svg class="h-6 w-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg><div class="flex-1"><p class="font-medium">${block.content}</p><p class="text-sm text-gray-500">PDF Document</p></div><a href="${block.attachmentData}" download="${block.content}" class="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100">Download</a></div></div>`;
      }
      if (block.type === "video" && block.attachmentData) {
        return `<div class="my-4"><video controls class="max-w-full rounded-lg border" src="${block.attachmentData}" style="box-shadow: 0 4px 20px -2px rgba(37, 99, 235, 0.08);">Your browser does not support the video tag.</video><p class="mt-2 text-sm text-gray-500">${block.content}</p></div>`;
      }
      if (block.type === "link") {
        return `<div class="my-4 rounded-lg border p-4 bg-gray-50"><div class="flex items-center gap-3"><svg class="h-6 w-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg><a href="${block.content}" target="_blank" rel="noopener noreferrer" class="flex-1 text-blue-700 hover:underline">${block.content}</a></div></div>`;
      }
      return `<p class="text-base leading-7 mb-4 whitespace-pre-wrap">${block.content}</p>`;
    };

    const renderSectionHTML = (section: Section, index: number): string => {
      const contentHTML = section.content.map(renderBlockHTML).join('\n');
      const prev = index > 0 ? allSections[index - 1] : null;
      const next = index < allSections.length - 1 ? allSections[index + 1] : null;
      const isFirst = index === 0;
      
      return `
        <div id="section-${section.id}" class="section-content${isFirst ? ' active' : ''}" style="${isFirst ? '' : 'display: none;'}">
          <h1 class="mb-6 text-4xl font-bold">${section.title}</h1>
          <div class="prose prose-lg max-w-none">
            ${contentHTML}
          </div>
          <div class="mt-12 pt-8 border-t flex gap-4">
            ${prev ? `
              <button onclick="showSection('${prev.id}')" class="nav-btn flex gap-2 flex-1 py-4 px-4 border rounded-lg hover:bg-gray-50">
                <svg class="h-5 w-5 rotate-180 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                <div class="text-left flex-1"><div class="text-xs text-gray-500">Previous</div><div class="font-medium">${prev.title}</div></div>
              </button>
            ` : '<div class="flex-1"></div>'}
            ${next ? `
              <button onclick="showSection('${next.id}')" class="nav-btn flex gap-2 flex-1 py-4 px-4 border rounded-lg hover:bg-gray-50">
                <div class="text-right flex-1"><div class="text-xs text-gray-500">Next</div><div class="font-medium">${next.title}</div></div>
                <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
              </button>
            ` : '<div class="flex-1"></div>'}
          </div>
        </div>
      `;
    };

    const renderSidebarNav = (sectionList: Section[], depth = 0, isFirst = false): string => {
      return sectionList.map((section, index) => {
        const hasChildren = section.children && section.children.length > 0;
        const isFirstSection = isFirst && index === 0 && depth === 0;
        return `
          <div>
            <button onclick="showSection('${section.id}')" data-section="${section.id}" class="sidebar-btn${isFirstSection ? ' active' : ''} w-full flex items-start gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-100 text-gray-600" style="padding-left: ${depth * 12 + 12}px;">
              <span class="flex-1 text-left">${section.title}</span>
              ${hasChildren ? '<svg class="h-4 w-4 rotate-90 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>' : ''}
            </button>
            ${hasChildren ? `<div>${renderSidebarNav(section.children, depth + 1, false)}</div>` : ''}
          </div>
        `;
      }).join('');
    };

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .sidebar-btn.active { background: #f3f4f6; font-weight: 600; color: #1e3a8a; }
    .section-content { display: none; }
    .section-content.active { display: block; }
  </style>
</head>
<body class="bg-white text-gray-800">
  <!-- Header -->
  <header class="sticky top-0 z-50 w-full border-b bg-white/95" style="backdrop-filter: blur(8px);">
    <div class="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4">
      <div class="flex items-center gap-2">
        <img src="https://leapmile-website.blr1.digitaloceanspaces.com/leapmile.png" alt="Leapmile Robotics" class="h-7"/>
      </div>
      <div class="flex items-center gap-6">
        <nav class="hidden md:flex items-center gap-6 text-sm">
          <button onclick="location.reload()" class="transition-colors hover:text-blue-700">Home</button>
          <a href="https://www.leapmile.com" class="transition-colors hover:text-blue-700">Website</a>
          <a href="https://www.leapmile.com/#contact" class="transition-colors hover:text-blue-700">Contact Us</a>
        </nav>
        <div class="relative">
          <svg class="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input type="search" id="searchInput" placeholder="Search in document..." class="w-[200px] lg:w-[300px] pl-8 pr-3 py-2 border rounded-md text-sm" />
          <button onclick="clearSearch()" id="clearBtn" class="hidden absolute right-1 top-1 h-6 w-6 hover:bg-gray-100 rounded-md">
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>
    </div>
    <div id="searchResults" class="hidden absolute right-4 top-16 z-50 w-[400px] bg-white border rounded-lg shadow-lg max-h-[400px] overflow-y-auto p-2"></div>
  </header>

  <div class="flex overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 border-r bg-gray-50 h-[calc(100vh-4rem)] overflow-y-auto">
      <div class="p-4">
        <h2 class="mb-4 text-lg font-bold">${title}</h2>
        <nav class="space-y-1" id="sidebarNav">
          ${renderSidebarNav(sections, 0, true)}
        </nav>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto h-[calc(100vh-4rem)]">
      <div class="container max-w-7xl mx-auto px-8 py-12" id="mainContent">
        ${allSections.map((section, index) => renderSectionHTML(section, index)).join('\n')}
      </div>
    </main>
  </div>

  <script>
    let currentSection = '${allSections[0]?.id || '1'}';
    const sections = ${JSON.stringify(allSections.map(s => ({ id: s.id, title: s.title, content: s.content.map(b => ({ type: b.type, content: b.content })) })))};

    function showSection(sectionId) {
      currentSection = sectionId;
      document.querySelectorAll('.section-content').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.sidebar-btn').forEach(el => el.classList.remove('active'));
      
      const section = document.getElementById('section-' + sectionId);
      if (section) {
        section.classList.add('active');
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      
      const btn = document.querySelector('[data-section="' + sectionId + '"]');
      if (btn) btn.classList.add('active');
    }

    function clearSearch() {
      document.getElementById('searchInput').value = '';
      document.getElementById('searchResults').classList.add('hidden');
      document.getElementById('clearBtn').classList.add('hidden');
    }

    document.getElementById('searchInput').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const resultsDiv = document.getElementById('searchResults');
      const clearBtn = document.getElementById('clearBtn');
      
      if (!query) {
        resultsDiv.classList.add('hidden');
        clearBtn.classList.add('hidden');
        return;
      }
      
      clearBtn.classList.remove('hidden');
      const results = [];
      
      sections.forEach(section => {
        if (section.title.toLowerCase().includes(query)) {
          results.push({ id: section.id, title: section.title, match: section.title });
        }
        section.content.forEach(block => {
          if (block.content.toLowerCase().includes(query)) {
            const idx = block.content.toLowerCase().indexOf(query);
            const start = Math.max(0, idx - 30);
            const end = Math.min(block.content.length, idx + query.length + 30);
            const match = (start > 0 ? '...' : '') + block.content.substring(start, end) + (end < block.content.length ? '...' : '');
            results.push({ id: section.id, title: section.title, match });
          }
        });
      });
      
      if (results.length > 0) {
        resultsDiv.innerHTML = results.map(r => 
          \`<button onclick="showSection('\${r.id}'); clearSearch();" class="w-full text-left p-3 rounded hover:bg-gray-100">
            <div class="font-medium text-sm text-blue-700 mb-1">\${r.title}</div>
            <div class="text-xs text-gray-500 line-clamp-2">\${r.match}</div>
          </button>\`
        ).join('');
        resultsDiv.classList.remove('hidden');
      } else {
        resultsDiv.innerHTML = '<div class="p-3 text-sm text-gray-500">No results found</div>';
        resultsDiv.classList.remove('hidden');
      }
    });

    // Initialize
    showSection(currentSection);
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Document exported",
      description: "Your document has been exported as a complete standalone HTML file matching the preview.",
    });
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
            <Button variant="ghost" size="sm" className="gap-2" onClick={exportDocument}>
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
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Document Structure</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={addSection}
                title="Add Section"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-1">{renderSections(sections)}</div>
            </ScrollArea>
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
                      
                      {currentSection.content.map((block, index) => (
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
                          
                          {/* Delete button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -right-8 top-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={() => setDeleteConfirmId(block.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          
                          {/* Insert content button - shows at the end of block on hover */}
                          <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Popover open={insertAfterBlockId === block.id} onOpenChange={(open) => !open && setInsertAfterBlockId(null)}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full border border-border bg-background hover:bg-accent mt-2"
                                  onClick={() => setInsertAfterBlockId(block.id)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-2" align="center">
                                <div className="flex flex-col gap-1">
                                  <Button
                                    variant="ghost"
                                    className="justify-start text-sm"
                                    onClick={() => addBlock(currentSection.id, "paragraph", block.id)}
                                  >
                                    Paragraph
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="justify-start text-sm"
                                    onClick={() => addBlock(currentSection.id, "h1", block.id)}
                                  >
                                    Heading 1
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="justify-start text-sm"
                                    onClick={() => addBlock(currentSection.id, "h2", block.id)}
                                  >
                                    Heading 2
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="justify-start text-sm"
                                    onClick={() => addBlock(currentSection.id, "h3", block.id)}
                                  >
                                    Heading 3
                                  </Button>
                                  <Separator className="my-1" />
                                  <Button
                                    variant="ghost"
                                    className="justify-start gap-2 text-sm"
                                    onClick={() => addBlock(currentSection.id, "image", block.id)}
                                  >
                                    <ImageIcon className="h-4 w-4" />
                                    Image
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="justify-start gap-2 text-sm"
                                    onClick={() => addBlock(currentSection.id, "pdf", block.id)}
                                  >
                                    <FileText className="h-4 w-4" />
                                    PDF
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="justify-start gap-2 text-sm"
                                    onClick={() => addLinkBlock(currentSection.id, block.id)}
                                  >
                                    <LinkIcon className="h-4 w-4" />
                                    Link
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="justify-start gap-2 text-sm"
                                    onClick={() => addBlock(currentSection.id, "video", block.id)}
                                  >
                                    <Code className="h-4 w-4" />
                                    Video (MP4)
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
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

      {/* Delete Block Confirmation Dialog */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Content Block
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this content block? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId && currentSection) {
                  deleteBlock(currentSection.id, deleteConfirmId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Section Confirmation Dialog */}
      <AlertDialog open={deleteSectionId !== null} onOpenChange={(open) => !open && setDeleteSectionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Section
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this section? All content within this section will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSectionId) {
                  deleteSection(deleteSectionId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentEditor;