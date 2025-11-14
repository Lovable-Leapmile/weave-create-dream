import { useState, useEffect, useRef, useCallback } from "react";
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
  Table as TableIcon,
  List,
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
import { useAuth } from "@/hooks/useAuth";
import { getDocumentById, saveDocument as saveToLocalStorage, generateId, type Document } from "@/lib/localStorage";
import {
  saveAsset,
  saveAssetFromDataUrl,
  getAssetObjectUrl,
  deleteAsset,
  getAssetDataUrl,
} from "@/lib/assetStorage";
import { startAutoBackup, stopAutoBackup } from "@/lib/backup";
import { TextFormattingToolbar } from "@/components/TextFormattingToolbar";

interface TableCell {
  content: string;
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
}

interface Block {
  id: string;
  type: "paragraph" | "h1" | "h2" | "h3" | "image" | "pdf" | "link" | "video" | "table" | "bulletList";
  content: string;
  attachmentId?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentData?: string; // Object URL for display
  imageSize?: "small" | "medium" | "large" | "full"; // For image sizing
  tableData?: TableCell[][];
  bulletStyle?: "disc" | "circle" | "square" | "decimal";
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
}

interface Section {
  id: string;
  title: string;
  content: Block[];
  children?: Section[];
  parentId?: string;
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
  const [showBlockTypeMenu, setShowBlockTypeMenu] = useState(false);
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [pendingAttachmentType, setPendingAttachmentType] = useState<"image" | "pdf" | "video" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [insertAfterBlockId, setInsertAfterBlockId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const loadedDocIdRef = useRef<string | null>(null);
  const [imageSizeDialogOpen, setImageSizeDialogOpen] = useState(false);
  const [pendingImageData, setPendingImageData] = useState<{ file: File; previewUrl: string } | null>(null);
  const assetUrlCacheRef = useRef<Map<string, string>>(new Map());
  const pendingImageRef = useRef<{ previewUrl: string } | null>(null);
  const [editingImageBlockId, setEditingImageBlockId] = useState<string | null>(null);
  const [textSelection, setTextSelection] = useState<{
    blockId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [editingTableBlock, setEditingTableBlock] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      assetUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      assetUrlCacheRef.current.clear();
      if (pendingImageRef.current) {
        URL.revokeObjectURL(pendingImageRef.current.previewUrl);
        pendingImageRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    pendingImageRef.current = pendingImageData;
  }, [pendingImageData]);

  useEffect(() => {
    if (!imageSizeDialogOpen && pendingImageData) {
      URL.revokeObjectURL(pendingImageData.previewUrl);
      setPendingImageData(null);
      setPendingAttachmentType(null);
      setInsertAfterBlockId(null);
    }
  }, [imageSizeDialogOpen, pendingImageData]);

  const sanitizeSections = useCallback((sectionList: Section[]): Section[] => {
    const sanitize = (sectionsToSanitize: Section[]): Section[] =>
      sectionsToSanitize.map((section) => ({
        ...section,
        content: section.content.map(({ attachmentData, ...blockRest }) => ({
          ...blockRest,
        })),
        children: section.children ? sanitize(section.children) : undefined,
      }));

    return sanitize(sectionList);
  }, []);

  const saveDocumentCore = useCallback(
    (override?: { sections?: Section[]; title?: string }) => {
      if (!user || !id || id === "new") return;

      const sectionsToPersist = override?.sections ?? sections;
      const titleToPersist = override?.title ?? title;

      const sanitizedSections = sanitizeSections(sectionsToPersist);
      const description =
        sanitizedSections[0]?.content[0]?.content?.substring(0, 100) || "";

      const doc: Document = {
        id,
        userId: user.id,
        title: titleToPersist,
        description,
        content: { sections: sanitizedSections },
        lastModified: new Date().toISOString(),
        createdAt: getDocumentById(id)?.createdAt || new Date().toISOString(),
      };

      saveToLocalStorage(doc);
    },
    [user, id, sections, title, sanitizeSections]
  );

  const hydrateSections = useCallback(
    async (sectionList: Section[]): Promise<{ sections: Section[]; migrated: boolean }> => {
      let migrated = false;

      const processSection = async (section: Section): Promise<Section> => {
        const processedBlocks: Block[] = [];

        for (const block of section.content) {
          let updatedBlock: Block = { ...block };

          if (block.attachmentData && !block.attachmentId) {
            try {
              const assetMeta = await saveAssetFromDataUrl(block.attachmentData, {
                name: block.content || "attachment",
              });
              const assetObj = await getAssetObjectUrl(assetMeta.id).catch((error) => {
                console.error("Failed to open stored asset", error);
                return null;
              });
              if (assetObj) {
                assetUrlCacheRef.current.set(assetMeta.id, assetObj.url);
                updatedBlock = {
                  ...updatedBlock,
                  attachmentId: assetMeta.id,
                  attachmentName: block.attachmentName || assetMeta.name,
                  attachmentType: block.attachmentType || assetObj.type,
                  attachmentData: assetObj.url,
                };
                migrated = true;
              }
            } catch (error) {
              console.error("Failed to migrate attachment data", error);
            }
          } else if (block.attachmentId) {
            const cachedUrl = assetUrlCacheRef.current.get(block.attachmentId);
            if (cachedUrl) {
              updatedBlock = {
                ...updatedBlock,
                attachmentData: cachedUrl,
              };
            } else {
              const assetObj = await getAssetObjectUrl(block.attachmentId).catch((error) => {
                console.error("Failed to load asset", error);
                return null;
              });
              if (assetObj) {
                assetUrlCacheRef.current.set(block.attachmentId, assetObj.url);
                updatedBlock = {
                  ...updatedBlock,
                  attachmentData: assetObj.url,
                  attachmentName: block.attachmentName || assetObj.name,
                  attachmentType: block.attachmentType || assetObj.type,
                };
              }
            }
          }

          processedBlocks.push(updatedBlock);
        }

        const processedChildren = section.children
          ? await Promise.all(section.children.map(processSection))
          : undefined;

        return {
          ...section,
          content: processedBlocks,
          children: processedChildren,
        };
      };

      const processedSections = await Promise.all(sectionList.map(processSection));
      return { sections: processedSections, migrated };
    },
    [getAssetObjectUrl, saveAssetFromDataUrl]
  );

  // Load document from storage and hydrate assets
  useEffect(() => {
    const loadDocument = async () => {
      if (!user || !id) return;
      if (loadedDocIdRef.current === id) return;

      loadedDocIdRef.current = id;

      if (id === "new") {
        const newId = generateId();
        const newDoc: Document = {
          id: newId,
          userId: user.id,
          title: "Untitled Document",
          description: "",
          content: { sections: [{ id: "1", title: "Introduction", content: [] }] },
          lastModified: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        saveToLocalStorage(newDoc);
        navigate(`/editor/${newId}`, { replace: true });
        return;
      }

      const doc = getDocumentById(id);

      if (!doc) {
        console.error("Document not found");
        return;
      }

      const docTitle = doc.title || "Untitled Document";
      setTitle(docTitle);
      const content = doc.content as { sections?: Section[] };
      const baseSections = content.sections || [{ id: "1", title: "Introduction", content: [] }];

      try {
        const { sections: hydratedSections, migrated } = await hydrateSections(baseSections);

        setSections(hydratedSections);
        setActiveSection((prev) => {
          if (hydratedSections.some((section) => section.id === prev)) {
            return prev;
          }
          return hydratedSections[0]?.id || "1";
        });

        if (migrated) {
          saveDocumentCore({ sections: hydratedSections, title: docTitle });
        }
      } catch (error) {
        console.error("Failed to hydrate sections", error);
        setSections(baseSections);
        setActiveSection(baseSections[0]?.id || "1");
        toast({
          title: "Asset storage unavailable",
          description: "Attachments could not be loaded. You can still edit text content.",
          variant: "destructive",
        });
      }
    };

    loadDocument();
  }, [id, user, hydrateSections, navigate, saveDocumentCore]);

  // Auto-save document to localStorage
  useEffect(() => {
    if (!user || !id || id === "new") return;

    const autoSave = setTimeout(() => {
      saveDocumentCore();
    }, 1200);

    return () => clearTimeout(autoSave);
  }, [title, sections, id, user, saveDocumentCore]);

  // Start auto-backup every 10 minutes
  useEffect(() => {
    startAutoBackup(10);
    return () => stopAutoBackup();
  }, []);

  const saveDocument = () => {
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
        title: "Please wait",
        description: "Setting up your new document...",
      });
      return;
    }

    try {
      saveDocumentCore();
      toast({
        title: "Document saved",
        description: "Your changes have been saved successfully.",
      });
    } catch (err: any) {
      console.error("Save error:", err);
      toast({
        title: "Save failed",
        description: "Failed to save the document.",
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

    const collectAttachmentIds = (section: Section, acc: string[] = []): string[] => {
      section.content.forEach((block) => {
        if (block.attachmentId) {
          acc.push(block.attachmentId);
        }
      });
      section.children?.forEach((child) => collectAttachmentIds(child, acc));
      return acc;
    };

    const sectionToDelete = findSection(sectionId);
    if (sectionToDelete) {
      const attachmentIds = collectAttachmentIds(sectionToDelete);
      attachmentIds.forEach((assetId) => {
        deleteAsset(assetId).catch((error) => {
          console.error("Failed to remove asset", error);
        });
        const cachedUrl = assetUrlCacheRef.current.get(assetId);
        if (cachedUrl) {
          URL.revokeObjectURL(cachedUrl);
          assetUrlCacheRef.current.delete(assetId);
        }
      });
    }

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
      setInsertAfterBlockId(afterBlockId ?? null);
      fileInputRef.current?.click();
      setShowBlockTypeMenu(false);
      return;
    }

    const newBlock: Block = {
      id: Date.now().toString(),
      type,
      content: "",
      ...(type === "table" && {
        tableData: [
          [{ content: "" }, { content: "" }],
          [{ content: "" }, { content: "" }],
        ],
      }),
      ...(type === "bulletList" && {
        bulletStyle: "disc" as const,
      }),
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

  const updateTableCell = (sectionId: string, blockId: string, rowIndex: number, colIndex: number, content: string) => {
    const section = findSection(sectionId);
    if (section) {
      const updatedContent = section.content.map((block) => {
        if (block.id === blockId && block.tableData) {
          const newTableData = block.tableData.map((row, rIdx) =>
            rIdx === rowIndex
              ? row.map((cell, cIdx) => (cIdx === colIndex ? { ...cell, content } : cell))
              : row
          );
          return { ...block, tableData: newTableData };
        }
        return block;
      });
      updateSection(sectionId, "content", updatedContent);
    }
  };

  const addTableRow = (sectionId: string, blockId: string) => {
    const section = findSection(sectionId);
    if (section) {
      const updatedContent = section.content.map((block) => {
        if (block.id === blockId && block.tableData) {
          const colCount = block.tableData[0]?.length || 2;
          const newRow = Array(colCount).fill(null).map(() => ({ content: "" }));
          return { ...block, tableData: [...block.tableData, newRow] };
        }
        return block;
      });
      updateSection(sectionId, "content", updatedContent);
    }
  };

  const addTableColumn = (sectionId: string, blockId: string) => {
    const section = findSection(sectionId);
    if (section) {
      const updatedContent = section.content.map((block) => {
        if (block.id === blockId && block.tableData) {
          const newTableData = block.tableData.map((row) => [...row, { content: "" }]);
          return { ...block, tableData: newTableData };
        }
        return block;
      });
      updateSection(sectionId, "content", updatedContent);
    }
  };

  const removeTableRow = (sectionId: string, blockId: string) => {
    const section = findSection(sectionId);
    if (section) {
      const updatedContent = section.content.map((block) => {
        if (block.id === blockId && block.tableData && block.tableData.length > 1) {
          const newTableData = block.tableData.slice(0, -1);
          return { ...block, tableData: newTableData };
        }
        return block;
      });
      updateSection(sectionId, "content", updatedContent);
    }
  };

  const removeTableColumn = (sectionId: string, blockId: string) => {
    const section = findSection(sectionId);
    if (section) {
      const updatedContent = section.content.map((block) => {
        if (block.id === blockId && block.tableData && block.tableData[0]?.length > 1) {
          const newTableData = block.tableData.map((row) => row.slice(0, -1));
          return { ...block, tableData: newTableData };
        }
        return block;
      });
      updateSection(sectionId, "content", updatedContent);
    }
  };

  const updateBulletStyle = (sectionId: string, blockId: string, style: "disc" | "circle" | "square" | "decimal") => {
    const section = findSection(sectionId);
    if (section) {
      const updatedContent = section.content.map((block) =>
        block.id === blockId ? { ...block, bulletStyle: style } : block
      );
      updateSection(sectionId, "content", updatedContent);
    }
  };

  const handleTextSelection = (blockId: string, event: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setTextSelection({
        blockId,
        position: { x: rect.left + rect.width / 2, y: rect.top },
      });
    } else {
      setTextSelection(null);
    }
  };

  const applyTextFormatting = (format: "bold" | "italic" | "underline") => {
    document.execCommand(format);
    setTextSelection(null);
  };

  const deleteBlock = (sectionId: string, blockId: string) => {
    const section = findSection(sectionId);
    if (section) {
      const blockToDelete = section.content.find((block) => block.id === blockId);
      if (blockToDelete?.attachmentId) {
        deleteAsset(blockToDelete.attachmentId).catch((error) => {
          console.error("Failed to remove asset", error);
        });
        const cachedUrl = assetUrlCacheRef.current.get(blockToDelete.attachmentId);
        if (cachedUrl) {
          URL.revokeObjectURL(cachedUrl);
          assetUrlCacheRef.current.delete(blockToDelete.attachmentId);
        }
      }
      const updatedContent = section.content.filter((block) => block.id !== blockId);
      updateSection(sectionId, "content", updatedContent);
    }
    setDeleteConfirmId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file || !pendingAttachmentType || !currentSection) {
      if (e.target.value) e.target.value = "";
      return;
    }

    if (pendingAttachmentType === "image") {
      const previewUrl = URL.createObjectURL(file);
      setPendingImageData({ file, previewUrl });
      setImageSizeDialogOpen(true);
      setPendingAttachmentType(null);
      if (e.target.value) e.target.value = "";
      return;
    }

    try {
      const typeHint =
        file.type || (pendingAttachmentType === "pdf" ? "application/pdf" : "video/mp4");
      const assetMeta = await saveAsset(file, {
        name: file.name,
        type: typeHint,
      });

      const objectUrl = URL.createObjectURL(file);
      assetUrlCacheRef.current.set(assetMeta.id, objectUrl);

      const newBlock: Block = {
        id: Date.now().toString(),
        type: pendingAttachmentType,
        content: file.name,
        attachmentId: assetMeta.id,
        attachmentName: file.name,
        attachmentType: assetMeta.type,
        attachmentData: objectUrl,
      };

      const section = findSection(currentSection.id);
      if (section) {
        const updatedContent = [...section.content];
        if (insertAfterBlockId) {
          const blockIndex = section.content.findIndex((b) => b.id === insertAfterBlockId);
          if (blockIndex >= 0) {
            updatedContent.splice(blockIndex + 1, 0, newBlock);
          } else {
            updatedContent.push(newBlock);
          }
        } else {
          updatedContent.push(newBlock);
        }
        updateSection(currentSection.id, "content", updatedContent);
        setCurrentBlockId(newBlock.id);
      }

      toast({
        title: `${pendingAttachmentType.charAt(0).toUpperCase() + pendingAttachmentType.slice(1)} added`,
        description: `${file.name} has been added to the document.`,
      });
    } catch (error) {
      console.error("Failed to store attachment", error);
      toast({
        title: "Upload failed",
        description: "We couldn't store this file locally. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPendingAttachmentType(null);
      setInsertAfterBlockId(null);
      if (e.target.value) e.target.value = "";
    }
  };

  const addImageWithSize = async (size: "small" | "medium" | "large" | "full") => {
    if (!pendingImageData || !currentSection) return;

    const { file, previewUrl } = pendingImageData;

    try {
      const assetMeta = await saveAsset(file, {
        name: file.name,
        type: file.type || "image/*",
      });

      assetUrlCacheRef.current.set(assetMeta.id, previewUrl);

      const newBlock: Block = {
        id: Date.now().toString(),
        type: "image",
        content: file.name,
        attachmentId: assetMeta.id,
        attachmentName: file.name,
        attachmentType: assetMeta.type,
        attachmentData: previewUrl,
        imageSize: size,
      };

      const section = findSection(currentSection.id);
      if (section) {
        const updatedContent = [...section.content];
        if (insertAfterBlockId) {
          const blockIndex = section.content.findIndex((b) => b.id === insertAfterBlockId);
          if (blockIndex >= 0) {
            updatedContent.splice(blockIndex + 1, 0, newBlock);
          } else {
            updatedContent.push(newBlock);
          }
        } else {
          updatedContent.push(newBlock);
        }
        updateSection(currentSection.id, "content", updatedContent);
        setCurrentBlockId(newBlock.id);
      }

      toast({
        title: "Image added",
        description: `${file.name} has been added to the document.`,
      });
    } catch (error) {
      console.error("Failed to store image asset", error);
      URL.revokeObjectURL(previewUrl);
      toast({
        title: "Image upload failed",
        description: "We couldn't store this image. Please try another file.",
        variant: "destructive",
      });
    } finally {
      setPendingImageData(null);
      setPendingAttachmentType(null);
      setImageSizeDialogOpen(false);
      setInsertAfterBlockId(null);
    }
  };

  const updateImageSize = (blockId: string, size: "small" | "medium" | "large" | "full") => {
    if (!currentSection) return;

    const updatedContent = currentSection.content.map((block) =>
      block.id === blockId ? { ...block, imageSize: size } : block
    );
    updateSection(currentSection.id, "content", updatedContent);
    setEditingImageBlockId(null);
    
    toast({
      title: "Image size updated",
      description: "The image size has been changed.",
    });
  };

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const currentSection = findSection(activeSection);

  const toggleSection = (sectionId: string) => {
    const section = findSection(sectionId);
    if (!section) return;

    // If it's a top-level section (no parentId), auto-collapse other top-level sections
    if (!section.parentId) {
      setExpandedSections((prev) => {
        const newSet = new Set(prev);
        const wasExpanded = newSet.has(sectionId);
        
        // Close all other top-level sections
        sections.forEach((s) => {
          if (s.id !== sectionId) {
            newSet.delete(s.id);
          }
        });
        
        // Toggle current section
        if (wasExpanded) {
          newSet.delete(sectionId);
        } else {
          newSet.add(sectionId);
        }
        
        return newSet;
      });
    } else {
      // For sub-sections, just toggle normally
      setExpandedSections((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(sectionId)) {
          newSet.delete(sectionId);
        } else {
          newSet.add(sectionId);
        }
        return newSet;
      });
    }
  };

  const renderSections = (sectionList: Section[], depth = 0) => {
    return sectionList.map((section) => {
      const hasChildren = section.children && section.children.length > 0;
      const isExpanded = expandedSections.has(section.id);

      return (
        <div key={section.id}>
          <div
            className={`group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${depth > 0 ? 'border-l-2 border-primary/30 ml-2' : ''}`}
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
    const savePromise = saveDocument();
    await Promise.race([savePromise, delay(1500)]);
    // Use BASE_URL from Vite to construct the correct path with base prefix
    const baseUrl = import.meta.env.BASE_URL;
    const previewPath = `${baseUrl}preview/${id}`.replace(/\/+/g, '/'); // Normalize slashes
    window.open(previewPath, "_blank");
  };

  const exportDocument = async () => {
    const savePromise = saveDocument();
    await Promise.race([savePromise, delay(1500)]);
    
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

    const attachmentIdSet = new Set<string>();
    allSections.forEach((section) => {
      section.content.forEach((block) => {
        if (block.attachmentId) {
          attachmentIdSet.add(block.attachmentId);
        }
      });
    });

    const assetDataMap = new Map<
      string,
      { dataUrl: string; name: string; type: string; size: number; createdAt: number; updatedAt: number }
    >();
    for (const assetId of attachmentIdSet) {
      const assetData = await getAssetDataUrl(assetId);
      if (assetData) {
        assetDataMap.set(assetId, assetData);
      }
    }

    // Escape HTML to prevent XSS
    const escapeHtml = (text: string): string => {
      const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, (m) => map[m]);
    };

    const renderBlockHTML = (block: Block): string => {
      if (block.type === "h1") {
        return `<h1 class="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">${escapeHtml(block.content)}</h1>`;
      }
      if (block.type === "h2") {
        return `<h2 class="text-xl sm:text-2xl md:text-3xl font-bold mb-2 md:mb-3">${escapeHtml(block.content)}</h2>`;
      }
      if (block.type === "h3") {
        return `<h3 class="text-lg sm:text-xl md:text-2xl font-bold mb-2">${escapeHtml(block.content)}</h3>`;
      }
      if (block.type === "image") {
        const assetData = block.attachmentId ? assetDataMap.get(block.attachmentId) : undefined;
        const src = assetData?.dataUrl || block.attachmentData;
        if (!src) {
          console.warn(`Missing image data for block ${block.id}`);
          return "";
        }
        const sizeClass = block.imageSize === "small" ? "max-w-xs" : 
                         block.imageSize === "medium" ? "max-w-md" :
                         block.imageSize === "large" ? "max-w-2xl" : "max-w-full";
        const altText = block.attachmentName || block.content;
        return `<div class="my-4"><img src="${src}" alt="${escapeHtml(altText)}" class="w-full ${sizeClass} h-auto rounded-lg"/></div>`;
      }
      if (block.type === "pdf") {
        const assetData = block.attachmentId ? assetDataMap.get(block.attachmentId) : undefined;
        const href = assetData?.dataUrl || block.attachmentData;
        if (!href) {
          console.warn(`Missing PDF data for block ${block.id}`);
          return "";
        }
        const fileName = block.attachmentName || block.content;
        return `<div class="my-4 rounded-lg border p-3 md:p-4 bg-gray-50"><div class="flex flex-col sm:flex-row items-start sm:items-center gap-3"><svg class="h-5 w-5 sm:h-6 sm:w-6 text-blue-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg><div class="flex-1 min-w-0"><p class="font-medium text-sm sm:text-base break-words">${escapeHtml(fileName)}</p><p class="text-xs sm:text-sm text-gray-500">PDF Document</p></div><a href="${href}" download="${escapeHtml(fileName)}" class="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-100 w-full sm:w-auto text-center flex-shrink-0">Download</a></div></div>`;
      }
      if (block.type === "video") {
        const assetData = block.attachmentId ? assetDataMap.get(block.attachmentId) : undefined;
        const src = assetData?.dataUrl || block.attachmentData;
        if (!src) {
          console.warn(`Missing video data for block ${block.id}`);
          return "";
        }
        const caption = block.attachmentName || block.content;
        return `<div class="my-4"><video controls class="w-full max-w-full h-auto rounded-lg border" src="${src}" style="box-shadow: 0 4px 20px -2px rgba(37, 99, 235, 0.08);">Your browser does not support the video tag.</video><p class="mt-2 text-xs sm:text-sm text-gray-500">${escapeHtml(caption)}</p></div>`;
      }
      if (block.type === "link") {
        return `<div class="my-4 rounded-lg border p-3 md:p-4 bg-gray-50"><div class="flex items-start sm:items-center gap-3"><svg class="h-5 w-5 sm:h-6 sm:w-6 text-blue-700 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg><a href="${escapeHtml(block.content)}" target="_blank" rel="noopener noreferrer" class="flex-1 text-blue-700 hover:underline break-all text-sm sm:text-base">${escapeHtml(block.content)}</a></div></div>`;
      }
      // Handle content with potential image/PDF placeholders
      const processedContent = block.content.replace(/\[(?:IMAGE|PDF):[^\]]+\]/g, '');
      return `<p class="text-sm sm:text-base md:text-lg leading-6 md:leading-7 mb-3 md:mb-4 whitespace-pre-wrap break-words">${escapeHtml(processedContent).replace(/\n/g, '<br>')}</p>`;
    };

    const renderSectionHTML = (section: Section, index: number): string => {
      const contentHTML = section.content.map(renderBlockHTML).join('\n');
      const prev = index > 0 ? allSections[index - 1] : null;
      const next = index < allSections.length - 1 ? allSections[index + 1] : null;
      
      return `
        <div id="section-${section.id}" class="section-content" style="display: ${index === 0 ? 'block' : 'none'};">
          <h1 class="mb-4 md:mb-6 text-2xl sm:text-3xl md:text-4xl font-bold">${escapeHtml(section.title)}</h1>
          <div class="prose prose-sm sm:prose-base md:prose-lg max-w-none">
            ${contentHTML}
          </div>
          <div class="mt-8 md:mt-12 pt-6 md:pt-8 border-t flex flex-col sm:flex-row gap-3 sm:gap-4">
            ${prev ? `
              <button onclick="showSection('${prev.id}'); return false;" class="nav-btn flex gap-2 flex-1 py-3 md:py-4 px-4 border rounded-lg hover:bg-gray-50 text-left w-full sm:w-auto">
                <svg class="h-5 w-5 rotate-180 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                <div class="text-left flex-1 min-w-0"><div class="text-xs text-gray-500">Previous</div><div class="font-medium truncate text-sm md:text-base">${escapeHtml(prev.title)}</div></div>
              </button>
            ` : '<div class="hidden sm:block flex-1"></div>'}
            ${next ? `
              <button onclick="showSection('${next.id}'); return false;" class="nav-btn flex gap-2 flex-1 py-3 md:py-4 px-4 border rounded-lg hover:bg-gray-50 text-right w-full sm:w-auto">
                <div class="text-right flex-1 min-w-0"><div class="text-xs text-gray-500">Next</div><div class="font-medium truncate text-sm md:text-base">${escapeHtml(next.title)}</div></div>
                <svg class="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
              </button>
            ` : '<div class="hidden sm:block flex-1"></div>'}
          </div>
          <div class="mt-6 md:mt-8 pt-4 text-xs sm:text-sm text-gray-500 text-center border-t">
            Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      `;
    };

    // Helper function to find all parent section IDs for a given section
    const findParentSectionIds = (targetId: string, sectionList: Section[], parentIds: string[] = []): string[] | null => {
      for (const section of sectionList) {
        if (section.id === targetId) {
          return parentIds;
        }
        if (section.children) {
          const found = findParentSectionIds(targetId, section.children, [...parentIds, section.id]);
          if (found !== null) {
            return found;
          }
        }
      }
      return null;
    };

    const firstSectionId = allSections[0]?.id || '';
    const parentSectionIds = findParentSectionIds(firstSectionId, sections) || [];
    const sectionsToExpand = new Set([...parentSectionIds]);

    // Build section tree for JavaScript (handles arbitrary nesting depth)
    const buildSectionTree = (sectionList: Section[]): Array<{ id: string; children?: any }> => {
      return sectionList.map(s => ({
        id: s.id,
        children: s.children && s.children.length > 0 ? buildSectionTree(s.children) : undefined
      }));
    };
    const sectionTreeForJS = buildSectionTree(sections);

    // Function to get icon SVG for section based on title
    const getIconForSection = (title: string): string => {
      const lowerTitle = title.toLowerCase();
      
      // Home icon
      if (lowerTitle.includes("intro") || lowerTitle.includes("home") || lowerTitle.includes("welcome")) {
        return '<svg class="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>';
      }
      // Info icon
      if (lowerTitle.includes("about") || lowerTitle.includes("info")) {
        return '<svg class="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
      }
      // Users icon
      if (lowerTitle.includes("team") || lowerTitle.includes("user") || lowerTitle.includes("people")) {
        return '<svg class="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>';
      }
      // Settings icon
      if (lowerTitle.includes("setting") || lowerTitle.includes("config")) {
        return '<svg class="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>';
      }
      // BookOpen icon
      if (lowerTitle.includes("document") || lowerTitle.includes("guide") || lowerTitle.includes("manual")) {
        return '<svg class="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>';
      }
      // Lightbulb icon
      if (lowerTitle.includes("idea") || lowerTitle.includes("innovation")) {
        return '<svg class="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>';
      }
      // Target icon
      if (lowerTitle.includes("goal") || lowerTitle.includes("objective") || lowerTitle.includes("target")) {
        return '<svg class="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
      }
      // Default FileText icon
      return '<svg class="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>';
    };

    const renderSidebarNav = (sectionList: Section[], depth = 0): string => {
      return sectionList.map((section) => {
        const hasChildren = section.children && section.children.length > 0;
        const isFirst = depth === 0 && sectionList.indexOf(section) === 0;
        const isExpanded = sectionsToExpand.has(section.id);
        const showIcon = depth === 0; // Only show icon for top-level sections
        const leftBorderClass = depth > 0 ? 'border-l-2' : '';
        const leftBorderStyle = depth > 0 ? 'border-color: hsl(258 63% 29% / 0.3);' : '';
        
        return `
          <div>
            <div class="flex items-start w-full ${leftBorderClass}" style="padding-left: ${depth * 12 + 12}px; ${leftBorderStyle}">
              <button onclick="showSection('${section.id}'); closeMobileMenu(); return false;" data-section="${section.id}"
                class="sidebar-btn${isFirst ? ' active' : ''} flex-1 flex items-start gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-100 ${isFirst ? 'bg-gray-100 font-semibold text-blue-800' : 'text-gray-600'}" style="text-align: left;">
                ${showIcon ? getIconForSection(section.title) : ''}
                <span class="flex-1 text-left break-words">${escapeHtml(section.title)}</span>
              </button>
              ${hasChildren ? `
                <button onclick="toggleSubSection('${section.id}', ${depth === 0}); event.stopPropagation(); return false;" class="p-2 hover:bg-gray-200 rounded flex-shrink-0 transition-colors" style="margin-top: 0.125rem;">
                  <svg id="chevron-${section.id}" class="h-4 w-4 transition-transform" style="transform: ${isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              ` : ''}
            </div>
            ${hasChildren ? `
              <div id="subsections-${section.id}" class="${isExpanded ? '' : 'hidden'}">
                ${renderSidebarNav(section.children!, depth + 1)}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    };

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    
    /* Sidebar Navigation Styles */
    .sidebar-btn { 
      position: relative;
      overflow: hidden;
      transition: all 0.2s ease;
    }
    .sidebar-btn:hover { 
      background: hsl(258 30% 96%) !important;
      color: hsl(258 63% 29%) !important;
    }
    .sidebar-btn.active { 
      background: hsl(258 30% 96%) !important;
      font-weight: 600 !important;
      color: hsl(258 63% 29%) !important;
    }
    
    .section-content { display: none; }
    .section-content.active { display: block; }
    #mobileMenu { display: none; opacity: 0; transition: opacity 0.3s ease; }
    #mobileMenu.open { display: block; opacity: 1; }
    #mobileMenuSidebar { transition: transform 0.3s ease; }
    #mobileMenuSidebar.open { display: block !important; transform: translateX(0) !important; }
    @media (max-width: 768px) {
      #sidebar { display: none !important; }
    }
    @media (min-width: 769px) {
      #mobileMenu { display: none !important; }
      #mobileMenuSidebar { display: none !important; }
    }
  </style>
</head>
<body class="bg-white text-gray-800">
  <!-- Header -->
  <header class="sticky top-0 z-50 w-full border-b bg-white/95" style="backdrop-filter: blur(8px);">
    <div class="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4">
      <div class="flex items-center gap-3">
        <!-- Mobile Menu Button -->
        <button id="mobileMenuBtn" onclick="toggleMobileMenu(); event.stopPropagation();" class="md:hidden p-2 hover:bg-gray-100 rounded-md">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
        <div class="flex items-center gap-2">
          <img src="https://leapmile-website.blr1.digitaloceanspaces.com/leapmile.png" alt="Leapmile Robotics" class="h-7"/>
        </div>
      </div>
      <div class="flex items-center gap-2 md:gap-6">
        <nav class="hidden md:flex items-center gap-6 text-sm">
          <button onclick="location.reload()" class="transition-colors hover:text-blue-700">Home</button>
          <a href="https://www.leapmile.com" class="transition-colors hover:text-blue-700">Website</a>
          <a href="https://www.leapmile.com/#contact" class="transition-colors hover:text-blue-700">Contact Us</a>
        </nav>
        <div class="relative">
          <svg class="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <input type="search" id="searchInput" placeholder="Search..." class="w-[140px] sm:w-[180px] md:w-[200px] lg:w-[300px] pl-8 pr-8 py-2 border rounded-md text-sm" />
          <button onclick="clearSearch()" id="clearBtn" class="hidden absolute right-1 top-1 h-6 w-6 hover:bg-gray-100 rounded-md">
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Search Results Dropdown -->
    <div id="searchResults" class="hidden absolute left-2 right-2 md:right-4 md:left-auto md:w-[400px] top-16 z-50 bg-white border rounded-lg shadow-lg max-h-[400px] overflow-y-auto p-2"></div>
  </header>
  
  <!-- Mobile Menu Overlay -->
  <div id="mobileMenu" class="fixed inset-0 z-40 bg-black bg-opacity-50" style="display: none;"></div>
  <div id="mobileMenuSidebar" class="fixed left-0 top-16 bottom-0 z-50 w-80 bg-gray-50 border-r shadow-lg overflow-hidden" style="display: none; transform: translateX(-100%);" onclick="event.stopPropagation();">
    <div class="p-4 border-b bg-white sticky top-0 z-10">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">${escapeHtml(title)}</h2>
        <button onclick="closeMobileMenu(); event.stopPropagation();" class="p-2 hover:bg-gray-100 rounded-md">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
    </div>
    <div class="overflow-y-auto h-[calc(100vh-5rem)] p-4" onclick="event.stopPropagation();">
      <nav class="space-y-1" id="mobileSidebarNav">
        ${renderSidebarNav(sections, 0)}
      </nav>
    </div>
  </div>

  <div class="flex overflow-hidden">
    <!-- Sidebar - Hidden on mobile -->
    <aside id="sidebar" class="hidden md:block w-72 border-r h-[calc(100vh-4rem)] overflow-y-auto" style="background: hsl(258 30% 98%);">
      <div class="p-4">
        <h2 class="mb-4 text-lg font-bold" style="color: hsl(258 63% 29%);">${escapeHtml(title)}</h2>
        <nav class="space-y-1" id="sidebarNav">
          ${renderSidebarNav(sections, 0)}
        </nav>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto h-[calc(100vh-4rem)]">
      <div class="container max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-12" id="mainContent">
        ${allSections.map((section, index) => renderSectionHTML(section, index)).join('\n')}
      </div>
    </main>
  </div>

  <script>
    let currentSection = '${firstSectionId}';
    const sections = ${JSON.stringify(allSections.map(s => ({ id: s.id, title: s.title, content: s.content.map(b => ({ type: b.type, content: b.content })) })))};
    const sectionTree = ${JSON.stringify(sectionTreeForJS)};
    const expandedSections = new Set(${JSON.stringify(Array.from(sectionsToExpand))});

    // Initialize expanded sections on page load
    function initializeExpandedSections() {
      expandedSections.forEach(sectionId => {
        const subsectionsEls = document.querySelectorAll('#subsections-' + sectionId);
        const chevronEls = document.querySelectorAll('#chevron-' + sectionId);
        subsectionsEls.forEach(el => el.classList.remove('hidden'));
        chevronEls.forEach(el => { el.style.transform = 'rotate(90deg)'; });
      });
    }

    // Helper to find parent section IDs for a given section
    function findParentIds(sectionId) {
      function search(sectionList, targetId, currentPath = []) {
        if (!sectionList) return null;
        for (const section of sectionList) {
          if (section.id === targetId) {
            return currentPath;
          }
          if (section.children) {
            const found = search(section.children, targetId, [...currentPath, section.id]);
            if (found) return found;
          }
        }
        return null;
      }
      return search(sectionTree, sectionId) || [];
    }

    function toggleMobileMenu() {
      const mobileMenu = document.getElementById('mobileMenu');
      const mobileMenuSidebar = document.getElementById('mobileMenuSidebar');
      if (mobileMenu && mobileMenuSidebar) {
        if (mobileMenu.classList.contains('open')) {
          closeMobileMenu();
        } else {
          mobileMenu.style.display = 'block';
          mobileMenuSidebar.style.display = 'block';
          // Force reflow
          mobileMenu.offsetHeight;
          setTimeout(() => {
            mobileMenu.classList.add('open');
            mobileMenuSidebar.classList.add('open');
          }, 10);
        }
      }
    }

    function closeMobileMenu() {
      const mobileMenu = document.getElementById('mobileMenu');
      const mobileMenuSidebar = document.getElementById('mobileMenuSidebar');
      if (mobileMenu && mobileMenuSidebar) {
        mobileMenu.classList.remove('open');
        mobileMenuSidebar.classList.remove('open');
        setTimeout(() => {
          if (!mobileMenu.classList.contains('open')) {
            mobileMenu.style.display = 'none';
            mobileMenuSidebar.style.display = 'none';
          }
        }, 300);
      }
    }

    function showSection(sectionId) {
      // Expand all parent sections
      const parentIds = findParentIds(sectionId);
      parentIds.forEach(parentId => {
        const subsectionsEls = document.querySelectorAll('#subsections-' + parentId);
        const chevronEls = document.querySelectorAll('#chevron-' + parentId);
        subsectionsEls.forEach(el => el.classList.remove('hidden'));
        chevronEls.forEach(el => { el.style.transform = 'rotate(90deg)'; });
        expandedSections.add(parentId);
      });
      
      // Hide all sections
      document.querySelectorAll('.section-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
      });
      
      // Show selected section
      const sectionEl = document.getElementById('section-' + sectionId);
      if (sectionEl) {
        sectionEl.style.display = 'block';
        sectionEl.classList.add('active');
      }
      
      // Update active button in sidebar (both desktop and mobile)
      document.querySelectorAll('.sidebar-btn').forEach(el => {
        el.classList.remove('active');
        el.classList.remove('bg-gray-100', 'font-semibold', 'text-blue-800');
        el.classList.add('text-gray-600');
      });
      
      const btn = document.querySelector('[data-section="' + sectionId + '"]');
      if (btn) {
        btn.classList.add('active', 'bg-gray-100', 'font-semibold', 'text-blue-800');
        btn.classList.remove('text-gray-600');
      }
      
      // Also update mobile sidebar button
      const mobileBtn = document.querySelector('#mobileSidebarNav [data-section="' + sectionId + '"]');
      if (mobileBtn) {
        mobileBtn.classList.add('active', 'bg-gray-100', 'font-semibold', 'text-blue-800');
        mobileBtn.classList.remove('text-gray-600');
      }
      
      currentSection = sectionId;
      
      // Close mobile menu on mobile devices (check if mobile menu is visible)
      const mobileMenuBtn = document.getElementById('mobileMenuBtn');
      if (mobileMenuBtn && window.getComputedStyle(mobileMenuBtn).display !== 'none') {
        closeMobileMenu();
      }
      
      // Scroll to top of main content
      const mainContent = document.getElementById('mainContent');
      if (mainContent) {
        mainContent.scrollTop = 0;
      }
    }

    function toggleSubSection(sectionId, isTopLevel) {
      const subsectionsEls = document.querySelectorAll('#subsections-' + sectionId);
      const chevronEls = document.querySelectorAll('#chevron-' + sectionId);

      if (subsectionsEls.length > 0) {
        // Determine target state based on current visibility of all matching elements
        const shouldExpand = Array.from(subsectionsEls).every(el => el.classList.contains('hidden'));

        // If it's a top-level section, auto-collapse other top-level sections
        if (isTopLevel && shouldExpand) {
          // Find all top-level section IDs
          const topLevelSectionIds = sectionTree.map(s => s.id);
          
          // Close all other top-level sections
          topLevelSectionIds.forEach(topId => {
            if (topId !== sectionId) {
              const otherSubsectionsEls = document.querySelectorAll('#subsections-' + topId);
              const otherChevronEls = document.querySelectorAll('#chevron-' + topId);
              otherSubsectionsEls.forEach(el => el.classList.add('hidden'));
              otherChevronEls.forEach(el => { el.style.transform = 'rotate(0deg)'; });
              expandedSections.delete(topId);
            }
          });
        }

        if (shouldExpand) {
          // Expand current section
          subsectionsEls.forEach(el => el.classList.remove('hidden'));
          chevronEls.forEach(el => { el.style.transform = 'rotate(90deg)'; });
          expandedSections.add(sectionId);
        } else {
          // Collapse current section
          subsectionsEls.forEach(el => el.classList.add('hidden'));
          chevronEls.forEach(el => { el.style.transform = 'rotate(0deg)'; });
          expandedSections.delete(sectionId);
        }
      }

      return false; // Prevent default
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
          if (block.content && block.content.toLowerCase().includes(query)) {
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
          \`<button onclick="showSection('\${r.id}'); clearSearch(); closeMobileMenu();" class="w-full text-left p-3 rounded hover:bg-gray-100">
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

    // Close mobile menu when clicking on overlay
    const mobileMenuOverlay = document.getElementById('mobileMenu');
    if (mobileMenuOverlay) {
      mobileMenuOverlay.addEventListener('click', function(e) {
        if (e.target === this) {
          closeMobileMenu();
        }
      });
    }
    
    // Prevent body scroll when mobile menu is open
    function handleBodyScroll() {
      const menuEl = document.getElementById('mobileMenu');
      if (menuEl && menuEl.classList.contains('open')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
    
    // Watch for mobile menu state changes
    const menuObserver = new MutationObserver(handleBodyScroll);
    const menuEl = document.getElementById('mobileMenu');
    if (menuEl) {
      menuObserver.observe(menuEl, { attributes: true, attributeFilter: ['class'] });
    }

    // Initialize - expand sections and show first section
    initializeExpandedSections();
    if (currentSection) {
      showSection(currentSection);
    }
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
                            <div
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) =>
                                updateBlock(
                                  currentSection.id,
                                  block.id,
                                  e.currentTarget.textContent || ""
                                )
                              }
                              onMouseUp={(e) => handleTextSelection(block.id, e)}
                              className="min-h-[100px] p-2 border-0 text-base outline-none focus:bg-muted/50 rounded"
                              dangerouslySetInnerHTML={{ __html: block.content || "Start typing paragraph..." }}
                            />
                          )}
                          {block.type === "image" && block.attachmentData && (
                            <div 
                              className="my-4 group/image relative"
                              onMouseEnter={() => setEditingImageBlockId(block.id)}
                              onMouseLeave={() => setEditingImageBlockId(null)}
                            >
                              <img 
                                src={block.attachmentData} 
                                alt={block.content}
                                className={`rounded-lg ${
                                  block.imageSize === "small" ? "max-w-xs" :
                                  block.imageSize === "medium" ? "max-w-md" :
                                  block.imageSize === "large" ? "max-w-2xl" :
                                  "max-w-full"
                                }`}
                              />
                              {editingImageBlockId === block.id && (
                                <div className="absolute top-2 right-2 flex gap-1 bg-background/95 backdrop-blur-sm border rounded-md p-1 shadow-lg">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 px-2 text-xs ${block.imageSize === "small" ? "bg-muted" : ""}`}
                                    onClick={() => updateImageSize(block.id, "small")}
                                  >
                                    Small
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 px-2 text-xs ${block.imageSize === "medium" ? "bg-muted" : ""}`}
                                    onClick={() => updateImageSize(block.id, "medium")}
                                  >
                                    Medium
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 px-2 text-xs ${block.imageSize === "large" ? "bg-muted" : ""}`}
                                    onClick={() => updateImageSize(block.id, "large")}
                                  >
                                    Large
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 px-2 text-xs ${block.imageSize === "full" ? "bg-muted" : ""}`}
                                    onClick={() => updateImageSize(block.id, "full")}
                                  >
                                    Full
                                  </Button>
                                </div>
                              )}
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
                          
                          {block.type === "table" && block.tableData && (
                            <div className="my-4 relative">
                              <div className="overflow-x-auto border rounded-lg">
                                <table className="w-full">
                                  <tbody>
                                    {block.tableData.map((row, rowIndex) => (
                                      <tr key={rowIndex} className="border-b last:border-b-0">
                                        {row.map((cell, colIndex) => (
                                          <td key={colIndex} className="border-r last:border-r-0 p-2">
                                            <div
                                              contentEditable
                                              suppressContentEditableWarning
                                              onBlur={(e) =>
                                                updateTableCell(
                                                  currentSection.id,
                                                  block.id,
                                                  rowIndex,
                                                  colIndex,
                                                  e.currentTarget.textContent || ""
                                                )
                                              }
                                              onMouseUp={(e) => handleTextSelection(block.id, e)}
                                              className="min-h-[40px] outline-none focus:bg-muted/50"
                                            >
                                              {cell.content}
                                            </div>
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="mt-2 flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTableRow(currentSection.id, block.id)}
                                >
                                  Add Row
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addTableColumn(currentSection.id, block.id)}
                                >
                                  Add Column
                                </Button>
                                {block.tableData.length > 1 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeTableRow(currentSection.id, block.id)}
                                  >
                                    Remove Row
                                  </Button>
                                )}
                                {block.tableData[0]?.length > 1 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeTableColumn(currentSection.id, block.id)}
                                  >
                                    Remove Column
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {block.type === "bulletList" && (
                            <div className="my-4">
                              <div className="flex gap-2 mb-2">
                                <Button
                                  variant={block.bulletStyle === "disc" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => updateBulletStyle(currentSection.id, block.id, "disc")}
                                >
                                  • Disc
                                </Button>
                                <Button
                                  variant={block.bulletStyle === "circle" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => updateBulletStyle(currentSection.id, block.id, "circle")}
                                >
                                  ○ Circle
                                </Button>
                                <Button
                                  variant={block.bulletStyle === "square" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => updateBulletStyle(currentSection.id, block.id, "square")}
                                >
                                  ▪ Square
                                </Button>
                                <Button
                                  variant={block.bulletStyle === "decimal" ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => updateBulletStyle(currentSection.id, block.id, "decimal")}
                                >
                                  1. Decimal
                                </Button>
                              </div>
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) =>
                                  updateBlock(
                                    currentSection.id,
                                    block.id,
                                    e.currentTarget.textContent || ""
                                  )
                                }
                                onMouseUp={(e) => handleTextSelection(block.id, e)}
                                className="min-h-[100px] p-4 border rounded-lg outline-none focus:bg-muted/50"
                                style={{
                                  listStyleType: block.bulletStyle || "disc",
                                }}
                              >
                                {block.content || "Type bullet points here..."}
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
                                  <Separator className="my-1" />
                                  <Button
                                    variant="ghost"
                                    className="justify-start gap-2 text-sm"
                                    onClick={() => addBlock(currentSection.id, "table", block.id)}
                                  >
                                    <TableIcon className="h-4 w-4" />
                                    Table
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="justify-start gap-2 text-sm"
                                    onClick={() => addBlock(currentSection.id, "bulletList", block.id)}
                                  >
                                    <List className="h-4 w-4" />
                                    Bullet List
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
                            <Separator className="my-1" />
                            <Button
                              variant="ghost"
                              className="justify-start gap-2"
                              onClick={() => addBlock(currentSection.id, "table")}
                            >
                              <TableIcon className="h-4 w-4" />
                              Table
                            </Button>
                            <Button
                              variant="ghost"
                              className="justify-start gap-2"
                              onClick={() => addBlock(currentSection.id, "bulletList")}
                            >
                              <List className="h-4 w-4" />
                              Bullet List
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

      {/* Image Size Selection Dialog */}
      <AlertDialog open={imageSizeDialogOpen} onOpenChange={setImageSizeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select Image Size</AlertDialogTitle>
            <AlertDialogDescription>
              Choose the size for the image in your document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-1"
              onClick={() => addImageWithSize("small")}
            >
              <span className="font-semibold">Small</span>
              <span className="text-xs text-muted-foreground">320px width</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-1"
              onClick={() => addImageWithSize("medium")}
            >
              <span className="font-semibold">Medium</span>
              <span className="text-xs text-muted-foreground">448px width</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-1"
              onClick={() => addImageWithSize("large")}
            >
              <span className="font-semibold">Large</span>
              <span className="text-xs text-muted-foreground">672px width</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-1"
              onClick={() => addImageWithSize("full")}
            >
              <span className="font-semibold">Full Width</span>
              <span className="text-xs text-muted-foreground">100% width</span>
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      
      {/* Text Formatting Toolbar */}
      {textSelection && (
        <TextFormattingToolbar
          position={textSelection.position}
          onFormat={applyTextFormatting}
        />
      )}
    </div>
  );
};

export default DocumentEditor;