import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, ChevronRight, X, Home, Info, Users, Settings, BookOpen, Lightbulb, Target, Zap, Shield, Award, Briefcase, Globe, Mail, Phone, MessageSquare, Calendar, Database, Code, Layout, PieChart, TrendingUp, Heart, Star, CheckCircle, AlertCircle, Menu } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Block {
  id: string;
  type: "paragraph" | "h1" | "h2" | "h3" | "image" | "pdf" | "link" | "video";
  content: string;
  attachmentData?: string;
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
  data: string;
}

const DocumentPreview = () => {
  const { id } = useParams();
  const [title, setTitle] = useState("Untitled Document");
  const [sections, setSections] = useState<Section[]>([
    { id: "1", title: "Introduction", content: [] },
  ]);
  const [activeSection, setActiveSection] = useState("1");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{sectionId: string; sectionTitle: string; matchText: string}>>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      // Load latest from backend to reflect saved editor content
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Preview load error:", error);
        return;
      }

      if (data) {
        setTitle(data.title || "Untitled Document");
        const content = (data.content as { sections?: Section[] }) || {};
        const loadedSections = content.sections || [{ id: "1", title: "Introduction", content: [] }];
        setSections(loadedSections);
        if (loadedSections.length > 0) setActiveSection(loadedSections[0].id);
      }
    };
    load();
  }, [id]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const results: Array<{sectionId: string; sectionTitle: string; matchText: string}> = [];
    const searchLower = searchQuery.toLowerCase();

    const searchInSections = (sectionList: Section[]) => {
      sectionList.forEach(section => {
        // Search in section title
        if (section.title.toLowerCase().includes(searchLower)) {
          results.push({
            sectionId: section.id,
            sectionTitle: section.title,
            matchText: section.title
          });
        }

        // Search in section content
        section.content.forEach(block => {
          if (block.content.toLowerCase().includes(searchLower)) {
            const matchIndex = block.content.toLowerCase().indexOf(searchLower);
            const start = Math.max(0, matchIndex - 30);
            const end = Math.min(block.content.length, matchIndex + searchQuery.length + 30);
            const matchText = (start > 0 ? "..." : "") + block.content.substring(start, end) + (end < block.content.length ? "..." : "");
            
            results.push({
              sectionId: section.id,
              sectionTitle: section.title,
              matchText
            });
          }
        });

        if (section.children) {
          searchInSections(section.children);
        }
      });
    };

    searchInSections(sections);
    setSearchResults(results);
  }, [searchQuery, sections]);

  const renderBlockContent = (content: string) => {
    const parts = content.split(/(\[(?:IMAGE|PDF):[^\]]+\])/g);

    return parts.map((part, index) => {
      const imageMatch = part.match(/\[IMAGE:([^:]+):([^\]]+)\]/);
      const pdfMatch = part.match(/\[PDF:([^:]+):([^\]]+)\]/);

      if (imageMatch) {
        const [, attachmentId, fileName] = imageMatch;
        const attachment = attachments.find((a) => a.id === attachmentId);
        if (attachment) {
          return (
            <div key={index} className="my-4">
              <img
                src={attachment.data}
                alt={fileName}
                className="w-full max-w-full h-auto rounded-lg border shadow-card"
              />
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground">{fileName}</p>
            </div>
          );
        }
      }

      if (pdfMatch) {
        const [, attachmentId, fileName] = pdfMatch;
        const attachment = attachments.find((a) => a.id === attachmentId);
        if (attachment) {
          return (
            <div key={index} className="my-4 rounded-lg border bg-muted p-3 md:p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base break-words">{fileName}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">PDF Document</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto flex-shrink-0"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = attachment.data;
                    link.download = fileName;
                    link.click();
                  }}
                >
                  Download
                </Button>
              </div>
            </div>
          );
        }
      }

      return <span key={index}>{part}</span>;
    });
  };

  const renderContent = (blocks: Block[]) => {
    return blocks.map((block) => {
      if (block.type === "h1") {
        return (
          <h1 key={block.id} className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4">
            {renderBlockContent(block.content)}
          </h1>
        );
      }
      if (block.type === "h2") {
        return (
          <h2 key={block.id} className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 md:mb-3">
            {renderBlockContent(block.content)}
          </h2>
        );
      }
      if (block.type === "h3") {
        return (
          <h3 key={block.id} className="text-lg sm:text-xl md:text-2xl font-bold mb-2">
            {renderBlockContent(block.content)}
          </h3>
        );
      }
      if (block.type === "image" && block.attachmentData) {
        return (
          <div key={block.id} className="my-4">
            <img
              src={block.attachmentData}
              alt={block.content}
              className="w-full max-w-full h-auto rounded-lg border shadow-card"
            />
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">{block.content}</p>
          </div>
        );
      }
      if (block.type === "pdf" && block.attachmentData) {
        return (
          <div key={block.id} className="my-4 rounded-lg border bg-muted p-3 md:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base break-words">{block.content}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">PDF Document</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto flex-shrink-0"
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
        );
      }
      if (block.type === "video" && block.attachmentData) {
        return (
          <div key={block.id} className="my-4">
            <video
              controls
              className="w-full max-w-full h-auto rounded-lg border shadow-card"
              src={block.attachmentData}
            >
              Your browser does not support the video tag.
            </video>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">{block.content}</p>
          </div>
        );
      }
      if (block.type === "link") {
        return (
          <div key={block.id} className="my-4 rounded-lg border bg-muted p-3 md:p-4">
            <div className="flex items-start sm:items-center gap-3">
              <svg className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <a
                href={block.content}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-primary hover:underline break-all text-sm sm:text-base"
              >
                {block.content}
              </a>
            </div>
          </div>
        );
      }
      return (
        <p key={block.id} className="text-sm sm:text-base md:text-lg leading-6 md:leading-7 mb-3 md:mb-4 whitespace-pre-wrap break-words">
          {renderBlockContent(block.content)}
        </p>
      );
    });
  };

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
  const currentSection = allSections.find((s) => s.id === activeSection);
  const currentIndex = allSections.findIndex((s) => s.id === activeSection);
  const previousSection = currentIndex > 0 ? allSections[currentIndex - 1] : null;
  const nextSection = currentIndex < allSections.length - 1 ? allSections[currentIndex + 1] : null;

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

  const getIconForSection = (title: string): LucideIcon => {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes("intro") || lowerTitle.includes("home") || lowerTitle.includes("welcome")) return Home;
    if (lowerTitle.includes("about") || lowerTitle.includes("info")) return Info;
    if (lowerTitle.includes("team") || lowerTitle.includes("user") || lowerTitle.includes("people")) return Users;
    if (lowerTitle.includes("setting") || lowerTitle.includes("config")) return Settings;
    if (lowerTitle.includes("document") || lowerTitle.includes("guide") || lowerTitle.includes("manual")) return BookOpen;
    if (lowerTitle.includes("idea") || lowerTitle.includes("innovation")) return Lightbulb;
    if (lowerTitle.includes("goal") || lowerTitle.includes("objective") || lowerTitle.includes("target")) return Target;
    if (lowerTitle.includes("feature") || lowerTitle.includes("power")) return Zap;
    if (lowerTitle.includes("security") || lowerTitle.includes("privacy") || lowerTitle.includes("protect")) return Shield;
    if (lowerTitle.includes("award") || lowerTitle.includes("achievement")) return Award;
    if (lowerTitle.includes("work") || lowerTitle.includes("business") || lowerTitle.includes("career")) return Briefcase;
    if (lowerTitle.includes("global") || lowerTitle.includes("world")) return Globe;
    if (lowerTitle.includes("email") || lowerTitle.includes("mail")) return Mail;
    if (lowerTitle.includes("phone") || lowerTitle.includes("call") || lowerTitle.includes("contact")) return Phone;
    if (lowerTitle.includes("message") || lowerTitle.includes("chat")) return MessageSquare;
    if (lowerTitle.includes("calendar") || lowerTitle.includes("schedule") || lowerTitle.includes("event")) return Calendar;
    if (lowerTitle.includes("data") || lowerTitle.includes("storage")) return Database;
    if (lowerTitle.includes("code") || lowerTitle.includes("development") || lowerTitle.includes("api")) return Code;
    if (lowerTitle.includes("design") || lowerTitle.includes("layout") || lowerTitle.includes("ui")) return Layout;
    if (lowerTitle.includes("chart") || lowerTitle.includes("analytics") || lowerTitle.includes("report")) return PieChart;
    if (lowerTitle.includes("trend") || lowerTitle.includes("growth")) return TrendingUp;
    if (lowerTitle.includes("favorite") || lowerTitle.includes("love")) return Heart;
    if (lowerTitle.includes("star") || lowerTitle.includes("rating")) return Star;
    if (lowerTitle.includes("success") || lowerTitle.includes("complete")) return CheckCircle;
    if (lowerTitle.includes("alert") || lowerTitle.includes("warning") || lowerTitle.includes("important")) return AlertCircle;
    
    return FileText;
  };

  const renderSectionNav = (sectionList: Section[], depth = 0) => {
    return sectionList.map((section) => {
      const hasChildren = section.children && section.children.length > 0;
      const isExpanded = expandedSections.has(section.id);
      const Icon = depth === 0 ? getIconForSection(section.title) : null;

      return (
        <div key={section.id}>
          <button
            onClick={() => {
              setActiveSection(section.id);
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-start gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
              activeSection === section.id
                ? "bg-muted font-semibold text-primary"
                : "text-muted-foreground"
            }`}
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            {/* Icon on the left */}
            {Icon && <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />}
            
            {/* Section title - left aligned, wraps to multiple lines */}
            <span className="flex-1 text-left break-words">{section.title}</span>
            
            {/* Arrow on the right for expandable sections */}
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSection(section.id);
                }}
                className="p-1 hover:bg-muted-foreground/10 rounded flex-shrink-0 mt-0.5"
              >
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </button>
            )}
          </button>
          
          {hasChildren && isExpanded && (
            <div className="ml-2">
              {renderSectionNav(section.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-bold">{title}</h2>
                </div>
                <ScrollArea className="h-[calc(100vh-5rem)]">
                  <div className="p-4">
                    <nav className="space-y-1">
                      {renderSectionNav(sections)}
                    </nav>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
            
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="https://leapmile-website.blr1.digitaloceanspaces.com/leapmile.png" 
                alt="Leapmile Robotics" 
                className="h-7"
              />
            </Link>
          </div>

          <div className="flex items-center gap-2 md:gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <button onClick={() => window.location.reload()} className="transition-colors hover:text-primary">
                Home
              </button>
              <a href="https://www.leapmile.com" className="transition-colors hover:text-primary">
                Website
              </a>
              <a href="https://www.leapmile.com/#contact" className="transition-colors hover:text-primary">
                Contact Us
              </a>
            </nav>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search..."
                className="w-[140px] sm:w-[180px] md:w-[200px] lg:w-[300px] pl-8 pr-8 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute left-2 right-2 md:right-4 md:left-auto md:w-[400px] top-16 z-50">
            <Card className="max-h-[400px] overflow-y-auto p-2">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  className="w-full text-left p-3 rounded hover:bg-muted transition-colors"
                  onClick={() => {
                    setActiveSection(result.sectionId);
                    setSearchQuery("");
                    setMobileMenuOpen(false);
                  }}
                >
                  <div className="font-medium text-sm text-primary mb-1">{result.sectionTitle}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{result.matchText}</div>
                </button>
              ))}
            </Card>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Navigation - Hidden on mobile */}
        <aside className="hidden md:flex w-64 border-r bg-muted/30 flex-col h-[calc(100vh-4rem)]">
          <ScrollArea className="flex-1">
            <div className="p-4">
              <h2 className="mb-4 text-lg font-bold">{title}</h2>
              <nav className="space-y-1">
                {renderSectionNav(sections)}
              </nav>
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content Area - Scrollable */}
        <main className="flex-1 overflow-y-auto h-[calc(100vh-4rem)]">
          <div className="container max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-12">
            {currentSection && (
              <div>
                <h1 className="mb-4 md:mb-6 text-2xl sm:text-3xl md:text-4xl font-bold">{currentSection.title}</h1>
                <div className="prose prose-sm sm:prose-base md:prose-lg max-w-none dark:prose-invert">
                  {renderContent(currentSection.content)}
                </div>

                {/* Next/Previous Navigation */}
                <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t flex flex-col sm:flex-row gap-3 sm:gap-4">
                  {previousSection ? (
                    <Button
                      variant="outline"
                      onClick={() => setActiveSection(previousSection.id)}
                      className="gap-2 flex-1 h-auto py-3 md:py-4 w-full sm:w-auto"
                    >
                      <ChevronRight className="h-5 w-5 rotate-180 flex-shrink-0" />
                      <div className="text-left flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Previous</div>
                        <div className="font-medium truncate text-sm md:text-base">{previousSection.title}</div>
                      </div>
                    </Button>
                  ) : (
                    <div className="hidden sm:block flex-1" />
                  )}

                  {nextSection ? (
                    <Button
                      variant="outline"
                      onClick={() => setActiveSection(nextSection.id)}
                      className="gap-2 flex-1 h-auto py-3 md:py-4 w-full sm:w-auto"
                    >
                      <div className="text-right flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Next</div>
                        <div className="font-medium truncate text-sm md:text-base">{nextSection.title}</div>
                      </div>
                      <ChevronRight className="h-5 w-5 flex-shrink-0" />
                    </Button>
                  ) : (
                    <div className="hidden sm:block flex-1" />
                  )}
                </div>

                {/* Last Updated Date */}
                <div className="mt-6 md:mt-8 pt-4 text-xs sm:text-sm text-muted-foreground text-center border-t">
                  Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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