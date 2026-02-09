import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { BookOpen, Stethoscope, FileText, X, Search, ChevronRight, Heart, Activity, TestTube, Pill, Brain, Bone, Baby, Utensils } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";
import { IBCC_DATA } from "@/data/ibcc";
import { CLINICAL_GUIDELINES } from "@/data/guidelines";
import { AUTOTEXTS } from "@/data/autotexts";

interface QuickReferencePanelProps {
  onChapterSelect?: (chapterId: string) => void;
  onGuidelineSelect?: (guidelineId: string) => void;
}

export function QuickReferencePanel({ onChapterSelect, onGuidelineSelect }: QuickReferencePanelProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const categoryIcons: Record<string, React.ElementType> = {
    'Cardiovascular': Heart,
    'Pulmonary': Activity,
    'Renal/Electrolyte': TestTube,
    'Infectious Disease': Stethoscope,
    'Neurology': Brain,
    'Hematology': Baby,
    'Endocrine/Metabolic': Pill,
    'GI/Nutrition': Utensils,
    'General': BookOpen,
  };

  const searchResults = React.useMemo(() => {
    if (!debouncedSearch) return [];

    const query = debouncedSearch.toLowerCase();
    const results: Array<{ type: 'ibcc' | 'guideline' | 'autotext'; id: string; title: string; category?: string; snippet?: string }> = [];

    Object.entries(IBCC_DATA).forEach(([id, chapter]) => {
      if (
        chapter.title.toLowerCase().includes(query) ||
        chapter.content?.toLowerCase().includes(query)
      ) {
        results.push({
          type: 'ibcc',
          id,
          title: chapter.title,
          category: chapter.category,
          snippet: chapter.content?.substring(0, 150),
        });
      }
    });

    CLINICAL_GUIDELINES.forEach(guideline => {
      if (
        guideline.title.toLowerCase().includes(query) ||
        guideline.recommendations?.some(r => r.toLowerCase().includes(query))
      ) {
        results.push({
          type: 'guideline',
          id: guideline.id,
          title: guideline.title,
          category: guideline.category,
        });
      }
    });

    AUTOTEXTS.forEach(autotext => {
      if (
        autotext.shortcut.toLowerCase().includes(query) ||
        autotext.expansion.toLowerCase().includes(query)
      ) {
        results.push({
          type: 'autotext',
          id: autotext.shortcut,
          title: autotext.shortcut,
          snippet: autotext.expansion.substring(0, 100),
        });
      }
    });

    return results.slice(0, 20);
  }, [debouncedSearch]);

  const handleSearchKeyDown = React.useCallback((e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setOpen(prev => !prev);
    }
    if (e.key === 'Escape') {
      setOpen(prev => {
        if (prev) {
          return false;
        }
        return prev;
      });
    }
  }, []);

  React.useEffect(() => {
    document.addEventListener('keydown', handleSearchKeyDown);
    return () => document.removeEventListener('keydown', handleSearchKeyDown);
  }, [handleSearchKeyDown]);

  const handleResultClick = (result: typeof searchResults[0]) => {
    if (result.type === 'ibcc' && onChapterSelect) {
      onChapterSelect(result.id);
    } else if (result.type === 'guideline' && onGuidelineSelect) {
      onGuidelineSelect(result.id);
    }

    if (result.type === 'autotext') {
      navigator.clipboard.writeText(AUTOTEXTS.find(a => a.shortcut === result.id)?.expansion || '');
      toast.success('Copied to clipboard');
    }

    setOpen(false);
    setSearchQuery('');
  };

  const groupedChapters = React.useMemo(() => {
    const groups: Record<string, typeof IBCC_DATA> = {};
    Object.entries(IBCC_DATA).forEach(([id, chapter]) => {
      const category = chapter.category || 'General';
      if (!groups[category]) {
        groups[category] = {};
      }
      groups[category][id] = chapter;
    });
    return groups;
  }, []);

  const groupedGuidelines = React.useMemo(() => {
    const groups: Record<string, typeof CLINICAL_GUIDELINES> = {};
    CLINICAL_GUIDELINES.forEach(guideline => {
      const category = guideline.category || 'General';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(guideline);
    });
    return groups;
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 relative group"
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Quick Ref</span>
        <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-60 group-hover:opacity-100 transition-opacity">
          <span className="text-[9px]">⌘</span>K
        </kbd>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[500px] sm:w-[600px] flex flex-col">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Quick Reference</SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SheetDescription>
              Quick access to IBCC, guidelines, and clinical references
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center gap-2 my-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search IBCC, guidelines, shortcuts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <kbd className="hidden sm:inline-flex h-9 select-none items-center gap-1 rounded border bg-muted px-3 font-mono text-xs">
              ESC
            </kbd>
          </div>

          {debouncedSearch ? (
            <ScrollArea className="flex-1 pr-4">
              <Command className="border-0 shadow-none">
                <CommandList>
                  {searchResults.length === 0 ? (
                    <CommandEmpty>No results found</CommandEmpty>
                  ) : (
                    <>
                      <CommandGroup heading="Results">
                        {searchResults.map((result) => {
                          const Icon = result.type === 'ibcc' ? BookOpen :
                                      result.type === 'guideline' ? Stethoscope :
                                      FileText;
                          return (
                            <CommandItem
                              key={`${result.type}-${result.id}`}
                              onSelect={() => handleResultClick(result)}
                              className="py-3 px-2"
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="mt-0.5">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium truncate">{result.title}</span>
                                    {result.category && (
                                      <Badge variant="outline" className="text-[10px]">
                                        {result.category}
                                      </Badge>
                                    )}
                                  </div>
                                  {result.snippet && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {result.snippet}
                                    </p>
                                  )}
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </ScrollArea>
          ) : (
            <Tabs defaultValue="ibcc" className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ibcc">IBCC</TabsTrigger>
                <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
                <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 pr-4 mt-4">
                <TabsContent value="ibcc" className="m-0">
                  <div className="space-y-4">
                    {Object.entries(groupedChapters).map(([category, chapters]) => {
                      const Icon = categoryIcons[category] || BookOpen;
                      return (
                        <div key={category}>
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-medium text-sm">{category}</h3>
                          </div>
                          <div className="space-y-1 ml-6">
                            {Object.entries(chapters).map(([id, chapter]) => (
                              <Button
                                key={id}
                                variant="ghost"
                                className="w-full justify-start text-sm h-8"
                                onClick={() => {
                                  onChapterSelect?.(id);
                                  setOpen(false);
                                }}
                              >
                                <span className="truncate">{chapter.title}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="guidelines" className="m-0">
                  <div className="space-y-4">
                    {Object.entries(groupedGuidelines).map(([category, guidelines]) => {
                      const Icon = categoryIcons[category] || Stethoscope;
                      return (
                        <div key={category}>
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-medium text-sm">{category}</h3>
                          </div>
                          <div className="space-y-1 ml-6">
                            {guidelines.map((guideline) => (
                              <Button
                                key={guideline.id}
                                variant="ghost"
                                className="w-full justify-start text-sm h-8"
                                onClick={() => {
                                  onGuidelineSelect?.(guideline.id);
                                  setOpen(false);
                                }}
                              >
                                <span className="truncate">{guideline.title}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="shortcuts" className="m-0">
                  <div className="space-y-2">
                    {AUTOTEXTS.map((autotext) => (
                      <div
                        key={autotext.shortcut}
                        className="p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => {
                          navigator.clipboard.writeText(autotext.expansion);
                          toast.success(`Copied "${autotext.shortcut}" to clipboard`);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <Badge variant="secondary" className="mb-1 text-xs">
                              {autotext.shortcut}
                            </Badge>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {autotext.expansion}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Copy({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}
