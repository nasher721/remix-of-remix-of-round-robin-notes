import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wand2,
  List,
  Stethoscope,
  MessageSquarePlus,
  Trash2,
  Plus,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useTextTransform, TransformType, CustomPrompt } from '@/hooks/useTextTransform';
import { toast } from 'sonner';

interface AITextToolsProps {
  getSelectedText: () => string | null;
  replaceSelectedText: (newText: string) => void;
  disabled?: boolean;
}

export const AITextTools = ({
  getSelectedText,
  replaceSelectedText,
  disabled,
}: AITextToolsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [customPromptText, setCustomPromptText] = useState('');
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptText, setNewPromptText] = useState('');

  const {
    transformText,
    isTransforming,
    customPrompts,
    addCustomPrompt,
    removeCustomPrompt,
  } = useTextTransform();

  const handleTransform = async (type: TransformType, customPrompt?: string) => {
    const selectedText = getSelectedText();
    if (!selectedText) {
      toast.error('Please select some text first');
      return;
    }

    const result = await transformText(selectedText, type, customPrompt);
    if (result) {
      replaceSelectedText(result);
      setIsOpen(false);
      setShowCustomDialog(false);
      toast.success('Text transformed');
    }
  };

  const handleCustomPromptSubmit = () => {
    if (!customPromptText.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    handleTransform('custom', customPromptText);
  };

  const handleSavePrompt = () => {
    if (!newPromptName.trim() || !newPromptText.trim()) {
      toast.error('Please fill in both fields');
      return;
    }
    addCustomPrompt(newPromptName.trim(), newPromptText.trim());
    setNewPromptName('');
    setNewPromptText('');
    setShowSaveDialog(false);
  };

  const handleSavedPromptClick = (prompt: CustomPrompt) => {
    handleTransform('custom', prompt.prompt);
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || isTransforming}
            className="h-8 w-8 p-0"
            title="AI Text Tools"
          >
            {isTransforming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">
              Transform Selected Text
            </p>
            
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => handleTransform('comma-list')}
              disabled={isTransforming}
            >
              <List className="h-4 w-4 mr-2" />
              To Comma List
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => handleTransform('medical-shorthand')}
              disabled={isTransforming}
            >
              <Stethoscope className="h-4 w-4 mr-2" />
              Medical Shorthand
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => {
                setCustomPromptText('');
                setShowCustomDialog(true);
                setIsOpen(false);
              }}
              disabled={isTransforming}
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              Custom Prompt...
            </Button>

            {customPrompts.length > 0 && (
              <>
                <Separator className="my-2" />
                <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center justify-between">
                  <span>Saved Prompts</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setShowSaveDialog(true);
                      setIsOpen(false);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </p>
                <ScrollArea className="max-h-32">
                  {customPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="flex items-center gap-1 group"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 justify-start h-8 text-sm"
                        onClick={() => handleSavedPromptClick(prompt)}
                        disabled={isTransforming}
                      >
                        <Sparkles className="h-3 w-3 mr-2 text-muted-foreground" />
                        {prompt.name}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCustomPrompt(prompt.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              </>
            )}

            {customPrompts.length === 0 && (
              <>
                <Separator className="my-2" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-9 text-muted-foreground"
                  onClick={() => {
                    setShowSaveDialog(true);
                    setIsOpen(false);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Save Custom Prompt
                </Button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Custom Prompt Dialog */}
      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5" />
              Custom AI Prompt
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your prompt... (e.g., 'Summarize this in 2 sentences' or 'Convert to bullet points')"
              value={customPromptText}
              onChange={(e) => setCustomPromptText(e.target.value)}
              className="min-h-[100px]"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              The selected text will be transformed according to your prompt.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCustomDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCustomPromptSubmit}
              disabled={isTransforming || !customPromptText.trim()}
            >
              {isTransforming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transforming...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Transform
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Prompt Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Save Custom Prompt
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt Name</label>
              <Input
                placeholder="e.g., Summarize, Simplify, Expand..."
                value={newPromptName}
                onChange={(e) => setNewPromptName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt Instructions</label>
              <Textarea
                placeholder="e.g., 'Summarize this text in 2-3 sentences'"
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePrompt}
              disabled={!newPromptName.trim() || !newPromptText.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Save Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
