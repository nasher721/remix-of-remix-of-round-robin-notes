import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Keyboard, Command, Plus, X, Save, Search, Copy, HelpCircle } from "lucide-react";
import { toast } from "sonner";

interface Shortcut {
  id: string;
  name: string;
  defaultKeys: string;
  customKeys?: string;
  description: string;
  category: 'navigation' | 'actions' | 'editing' | 'panels' | 'other';
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  {
    id: 'quick-search',
    name: 'Quick Search',
    defaultKeys: 'Cmd+K',
    description: 'Open patient quick search',
    category: 'navigation',
  },
  {
    id: 'quick-reference',
    name: 'Quick Reference',
    defaultKeys: 'Cmd+R',
    description: 'Open IBCC and guidelines',
    category: 'panels',
  },
  {
    id: 'add-patient',
    name: 'Add Patient',
    defaultKeys: 'Cmd+N',
    description: 'Create new patient card',
    category: 'actions',
  },
  {
    id: 'save',
    name: 'Save',
    defaultKeys: 'Cmd+S',
    description: 'Save current changes',
    category: 'actions',
  },
  {
    id: 'find',
    name: 'Find in Page',
    defaultKeys: 'Cmd+F',
    description: 'Search within current page',
    category: 'navigation',
  },
  {
    id: 'next-patient',
    name: 'Next Patient',
    defaultKeys: 'Cmd+]',
    description: 'Navigate to next patient',
    category: 'navigation',
  },
  {
    id: 'prev-patient',
    name: 'Previous Patient',
    defaultKeys: 'Cmd+[',
    description: 'Navigate to previous patient',
    category: 'navigation',
  },
  {
    id: 'toggle-sidebar',
    name: 'Toggle Sidebar',
    defaultKeys: 'Cmd+B',
    description: 'Show/hide sidebar',
    category: 'panels',
  },
  {
    id: 'copy',
    name: 'Copy',
    defaultKeys: 'Cmd+C',
    description: 'Copy selected text',
    category: 'editing',
  },
  {
    id: 'paste',
    name: 'Paste',
    defaultKeys: 'Cmd+V',
    description: 'Paste from clipboard',
    category: 'editing',
  },
  {
    id: 'cut',
    name: 'Cut',
    defaultKeys: 'Cmd+X',
    description: 'Cut selected text',
    category: 'editing',
  },
  {
    id: 'undo',
    name: 'Undo',
    defaultKeys: 'Cmd+Z',
    description: 'Undo last action',
    category: 'editing',
  },
  {
    id: 'redo',
    name: 'Redo',
    defaultKeys: 'Cmd+Shift+Z',
    description: 'Redo last action',
    category: 'editing',
  },
  {
    id: 'bold',
    name: 'Bold',
    defaultKeys: 'Cmd+B',
    description: 'Format text as bold',
    category: 'editing',
  },
  {
    id: 'italic',
    name: 'Italic',
    defaultKeys: 'Cmd+I',
    description: 'Format text as italic',
    category: 'editing',
  },
  {
    id: 'help',
    name: 'Help',
    defaultKeys: '?',
    description: 'Show keyboard shortcuts',
    category: 'other',
  },
];

export function KeyboardShortcutSystem() {
  const [open, setOpen] = React.useState(false);
  const [customShortcuts, setCustomShortcuts] = React.useState<Record<string, string>>({});
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [newShortcut, setNewShortcut] = React.useState('');

  const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
    if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
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
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSaveShortcut = (id: string) => {
    if (!newShortcut) {
      setCustomShortcuts(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEditingId(null);
      setNewShortcut('');
      toast.success('Shortcut reset to default');
      return;
    }

    setCustomShortcuts(prev => ({ ...prev, [id]: newShortcut }));
    setEditingId(null);
    setNewShortcut('');
    toast.success('Shortcut saved');
  };

  const getShortcutDisplay = (shortcut: Shortcut): string => {
    return customShortcuts[shortcut.id] || shortcut.defaultKeys;
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'navigation': return 'Navigation';
      case 'actions': return 'Actions';
      case 'editing': return 'Editing';
      case 'panels': return 'Panels';
      case 'other': return 'Other';
    }
  };

  const groupedShortcuts = React.useMemo(() => {
    const groups: Record<string, Shortcut[]> = {};
    DEFAULT_SHORTCUTS.forEach(shortcut => {
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = [];
      }
      groups[shortcut.category].push(shortcut);
    });
    return groups;
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Customize keyboard shortcuts for faster navigation
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
              <div key={category}>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {shortcuts.length}
                  </Badge>
                  {getCategoryLabel(category)}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map(shortcut => (
                    <Card key={shortcut.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{shortcut.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {shortcut.description}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingId === shortcut.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={newShortcut}
                                onChange={(e) => setNewShortcut(e.target.value)}
                                placeholder="Cmd+K"
                                className="w-32 h-8 text-sm"
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleSaveShortcut(shortcut.id)}
                              >
                                <Save className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingId(null);
                                  setNewShortcut('');
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">
                                {getShortcutDisplay(shortcut)}
                              </Badge>
                              {customShortcuts[shortcut.id] && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Custom
                                </Badge>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingId(shortcut.id);
                                  setNewShortcut(customShortcuts[shortcut.id] || '');
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-6" />

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>• Use <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">?</kbd> to open this dialog</p>
              <p>• Customize shortcuts by clicking the copy icon</p>
              <p>• Reset to default by clearing the custom key</p>
              <p>• Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> to close</p>
            </CardContent>
          </Card>
        </ScrollArea>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setCustomShortcuts({});
              toast.success('All shortcuts reset to defaults');
            }}
          >
            Reset All
          </Button>
          <Button
            onClick={() => {
              localStorage.setItem('customShortcuts', JSON.stringify(customShortcuts));
              toast.success('Shortcuts saved');
              setOpen(false);
            }}
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
