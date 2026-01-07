import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Zap, 
  FileText, 
  Book, 
  Plus, 
  Trash2, 
  Search,
  Copy,
  Settings,
  Sparkles
} from "lucide-react";
import { 
  AutoText, 
  Template, 
  defaultAutotexts, 
  defaultTemplates, 
  medicalDictionary 
} from "@/data/autotexts";
import { useToast } from "@/hooks/use-toast";

interface AutotextManagerProps {
  onInsertText?: (text: string) => void;
}

const AUTOTEXTS_STORAGE_KEY = "medical-autotexts";
const TEMPLATES_STORAGE_KEY = "medical-templates";

export const AutotextManager = ({ onInsertText }: AutotextManagerProps) => {
  const [autotexts, setAutotexts] = useState<AutoText[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newShortcut, setNewShortcut] = useState("");
  const [newExpansion, setNewExpansion] = useState("");
  const [newCategory, setNewCategory] = useState("Custom");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateContent, setNewTemplateContent] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("Custom");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Load autotexts and templates from localStorage
  useEffect(() => {
    const savedAutotexts = localStorage.getItem(AUTOTEXTS_STORAGE_KEY);
    const savedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    
    if (savedAutotexts) {
      setAutotexts(JSON.parse(savedAutotexts));
    } else {
      setAutotexts(defaultAutotexts);
    }
    
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates));
    } else {
      setTemplates(defaultTemplates);
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    if (autotexts.length > 0) {
      localStorage.setItem(AUTOTEXTS_STORAGE_KEY, JSON.stringify(autotexts));
    }
  }, [autotexts]);

  useEffect(() => {
    if (templates.length > 0) {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    }
  }, [templates]);

  const addAutotext = () => {
    if (!newShortcut || !newExpansion) return;
    const exists = autotexts.some(a => a.shortcut.toLowerCase() === newShortcut.toLowerCase());
    if (exists) {
      toast({
        title: "Shortcut exists",
        description: "This shortcut already exists. Please use a different one.",
        variant: "destructive"
      });
      return;
    }
    setAutotexts(prev => [...prev, { shortcut: newShortcut.toLowerCase(), expansion: newExpansion, category: newCategory }]);
    setNewShortcut("");
    setNewExpansion("");
    toast({ title: "Autotext added", description: `"${newShortcut}" → "${newExpansion}"` });
  };

  const removeAutotext = (shortcut: string) => {
    setAutotexts(prev => prev.filter(a => a.shortcut !== shortcut));
    toast({ title: "Autotext removed" });
  };

  const addTemplate = () => {
    if (!newTemplateName || !newTemplateContent) return;
    const id = `custom-${Date.now()}`;
    setTemplates(prev => [...prev, { 
      id, 
      name: newTemplateName, 
      category: newTemplateCategory, 
      content: newTemplateContent 
    }]);
    setNewTemplateName("");
    setNewTemplateContent("");
    toast({ title: "Template added", description: newTemplateName });
  };

  const removeTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast({ title: "Template removed" });
  };

  const insertTemplate = (content: string) => {
    if (onInsertText) {
      onInsertText(content);
      setOpen(false);
      toast({ title: "Template inserted" });
    } else {
      navigator.clipboard.writeText(content);
      toast({ title: "Template copied to clipboard" });
    }
  };

  const resetToDefaults = () => {
    if (confirm("Reset all autotexts and templates to defaults?")) {
      setAutotexts(defaultAutotexts);
      setTemplates(defaultTemplates);
      localStorage.removeItem(AUTOTEXTS_STORAGE_KEY);
      localStorage.removeItem(TEMPLATES_STORAGE_KEY);
      toast({ title: "Reset to defaults" });
    }
  };

  const filteredAutotexts = autotexts.filter(a => 
    a.shortcut.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.expansion.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const autotextCategories = [...new Set(autotexts.map(a => a.category))];
  const templateCategories = [...new Set(templates.map(t => t.category))];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Autotexts & Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Autotexts, Templates & Dictionary
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search autotexts, templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={resetToDefaults}>
            <Settings className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>

        <Tabs defaultValue="autotexts" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="autotexts" className="gap-2">
              <Zap className="h-4 w-4" />
              Autotexts ({autotexts.length})
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Templates ({templates.length})
            </TabsTrigger>
            <TabsTrigger value="dictionary" className="gap-2">
              <Book className="h-4 w-4" />
              Dictionary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="autotexts" className="flex-1 overflow-hidden flex flex-col m-0 pt-4">
            {/* Add new autotext */}
            <Card className="p-3 mb-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1 block">Shortcut</label>
                  <Input
                    placeholder="e.g., vss"
                    value={newShortcut}
                    onChange={(e) => setNewShortcut(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="flex-[2]">
                  <label className="text-xs font-medium mb-1 block">Expansion</label>
                  <Input
                    placeholder="e.g., Vital signs stable"
                    value={newExpansion}
                    onChange={(e) => setNewExpansion(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs font-medium mb-1 block">Category</label>
                  <Input
                    placeholder="Category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="h-8"
                  />
                </div>
                <Button onClick={addAutotext} size="sm" className="h-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {autotextCategories.map(category => {
                  const categoryAutotexts = filteredAutotexts.filter(a => a.category === category);
                  if (categoryAutotexts.length === 0) return null;
                  return (
                    <div key={category}>
                      <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                        {category}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {categoryAutotexts.map(autotext => (
                          <div 
                            key={autotext.shortcut} 
                            className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 group"
                          >
                            <Badge variant="secondary" className="font-mono text-xs">
                              {autotext.shortcut}
                            </Badge>
                            <span className="flex-1 text-sm truncate">{autotext.expansion}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                              onClick={() => removeAutotext(autotext.shortcut)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              💡 Type the shortcut followed by a space or tab to auto-expand
            </div>
          </TabsContent>

          <TabsContent value="templates" className="flex-1 overflow-hidden flex flex-col m-0 pt-4">
            {/* Add new template */}
            <Card className="p-3 mb-4">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Template name"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="w-24">
                    <Input
                      placeholder="Category"
                      value={newTemplateCategory}
                      onChange={(e) => setNewTemplateCategory(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <Button onClick={addTemplate} size="sm" className="h-8">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  placeholder="Template content (supports HTML formatting)"
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  rows={2}
                />
              </div>
            </Card>

            <ScrollArea className="flex-1">
              <div className="space-y-3">
                {templateCategories.map(category => {
                  const categoryTemplates = filteredTemplates.filter(t => t.category === category);
                  if (categoryTemplates.length === 0) return null;
                  return (
                    <div key={category}>
                      <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        {category}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {categoryTemplates.map(template => (
                          <Card 
                            key={template.id} 
                            className="p-3 hover:shadow-md transition-shadow cursor-pointer group"
                            onClick={() => insertTemplate(template.content)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <span className="font-medium text-sm">{template.name}</span>
                              <div className="flex gap-1">
                                <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                {template.id.startsWith('custom-') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeTemplate(template.id);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div 
                              className="text-xs text-muted-foreground line-clamp-3"
                              dangerouslySetInnerHTML={{ __html: template.content.replace(/<[^>]*>/g, ' ').substring(0, 150) + '...' }}
                            />
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              💡 Click a template to insert it (or copy to clipboard)
            </div>
          </TabsContent>

          <TabsContent value="dictionary" className="flex-1 overflow-hidden flex flex-col m-0 pt-4">
            <div className="text-sm mb-3">
              Medical spelling dictionary with <strong>{Object.keys(medicalDictionary).length}</strong> autocorrect entries. 
              Common misspellings are automatically corrected as you type.
            </div>
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                {Object.entries(medicalDictionary)
                  .filter(([wrong, correct]) => 
                    wrong.includes(searchQuery.toLowerCase()) || 
                    correct.includes(searchQuery.toLowerCase())
                  )
                  .map(([wrong, correct]) => (
                    <div key={wrong} className="text-xs p-2 bg-muted/30 rounded">
                      <span className="text-destructive line-through">{wrong}</span>
                      <span className="mx-1">→</span>
                      <span className="text-success font-medium">{correct}</span>
                    </div>
                  ))
                }
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Hook to get autotexts for use in RichTextEditor
export const useAutotexts = () => {
  const [autotexts, setAutotexts] = useState<AutoText[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(AUTOTEXTS_STORAGE_KEY);
    if (saved) {
      setAutotexts(JSON.parse(saved));
    } else {
      setAutotexts(defaultAutotexts);
    }
  }, []);

  const getExpansion = (shortcut: string): string | null => {
    const autotext = autotexts.find(a => a.shortcut.toLowerCase() === shortcut.toLowerCase());
    return autotext?.expansion || null;
  };

  return { autotexts, getExpansion };
};

// Hook to get dictionary for autocorrect
export const useDictionary = () => {
  const correct = (word: string): string => {
    return medicalDictionary[word.toLowerCase()] || word;
  };

  return { dictionary: medicalDictionary, correct };
};
