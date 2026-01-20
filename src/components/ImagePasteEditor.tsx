import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { 
  Bold, Italic, List, ImageIcon, Loader2, Maximize2, Highlighter, HighlighterIcon,
  Indent, Outdent, Palette, Undo2, Redo2, FileText
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { AutoText } from "@/types/autotext";
import { defaultAutotexts, medicalDictionary } from "@/data/autotexts";
import { ImageLightbox } from "./ImageLightbox";
import { DictationButton } from "./DictationButton";
import { AITextTools } from "./AITextTools";
import { PhrasePicker, PhraseFormDialog } from "./phrases";
import { usePhraseExpansion } from "@/hooks/usePhraseExpansion";
import { useClinicalPhrases } from "@/hooks/useClinicalPhrases";
import type { Patient } from "@/types/patient";

const textColors = [
  { name: "Default", value: "" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Gray", value: "#6b7280" },
];

interface ImagePasteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  autotexts?: AutoText[];
  fontSize?: number;
  changeTracking?: {
    enabled: boolean;
    wrapWithMarkup: (text: string) => string;
  } | null;
  patient?: Patient;
  section?: string;
}

// Extract image URLs from HTML content
const extractImageUrls = (html: string): string[] => {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const urls: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
};

// Apply underline formatting to text between # and :
const applyUnderlineFormatting = (html: string): string => {
  // Match #text: pattern but not inside HTML tags
  const regex = /#([^:#<>]+):/g;
  return html.replace(regex, '<u>#$1:</u>');
};

export const ImagePasteEditor = ({ 
  value, 
  onChange, 
  placeholder = "Enter text or paste images...", 
  className,
  minHeight = "60px",
  autotexts = defaultAutotexts,
  fontSize = 14,
  changeTracking = null,
  patient,
  section
}: ImagePasteEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  // Per-editor toggle: when true, marking is disabled for this editor
  const [localMarkingDisabled, setLocalMarkingDisabled] = useState(false);
  
  // Effective change tracking state - must be defined before any callbacks that use it
  const effectiveChangeTracking = localMarkingDisabled ? null : changeTracking;
  
  // Clinical phrase system
  const { folders } = useClinicalPhrases();
  
  // Insert phrase content handler
  const insertPhraseContent = useCallback((content: string) => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 
      ? selection.getRangeAt(0) 
      : null;
    
    let contentHtml = content;
    if (effectiveChangeTracking?.enabled) {
      contentHtml = effectiveChangeTracking.wrapWithMarkup(content);
    }
    
    if (range && editorRef.current.contains(range.startContainer)) {
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = contentHtml;
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      range.insertNode(fragment);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      editorRef.current.innerHTML += contentHtml;
    }
    
    isInternalUpdate.current = true;
    onChange(editorRef.current.innerHTML);
    editorRef.current.focus();
  }, [onChange, effectiveChangeTracking]);
  
  // Use phrase expansion hook
  const {
    phrases,
    selectedPhrase,
    phraseFields,
    showForm,
    handleFormInsert,
    handleLogUsage,
    closeForm,
    selectPhrase,
  } = usePhraseExpansion({
    patient,
    context: { section },
    onInsert: insertPhraseContent,
  });

  // Extract images from current value
  const imageUrls = useMemo(() => extractImageUrls(value), [value]);

  // Handle dictation transcript insertion
  const handleDictationTranscript = useCallback((text: string) => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 
      ? selection.getRangeAt(0) 
      : null;
    
    // Create content with optional change tracking
    let contentHtml = text;
    if (effectiveChangeTracking?.enabled) {
      contentHtml = effectiveChangeTracking.wrapWithMarkup(text);
    }
    
    if (range && editorRef.current.contains(range.startContainer)) {
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = contentHtml + ' ';
      const fragment = document.createDocumentFragment();
      while (temp.firstChild) {
        fragment.appendChild(temp.firstChild);
      }
      range.insertNode(fragment);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      // Insert at end if no selection
      editorRef.current.innerHTML += ' ' + contentHtml + ' ';
    }
    
    isInternalUpdate.current = true;
    onChange(editorRef.current.innerHTML);
    editorRef.current.focus();
  }, [effectiveChangeTracking, onChange]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Use native event listener for beforeinput (more reliable than React's onBeforeInput)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleBeforeInput = (e: InputEvent) => {
      if (!effectiveChangeTracking?.enabled || !e.data) return;
      
      // Handle insertText only - paste is handled separately
      if (e.inputType === 'insertText') {
        e.preventDefault();
        
        const markedHtml = effectiveChangeTracking.wrapWithMarkup(e.data);
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        const temp = document.createElement('div');
        temp.innerHTML = markedHtml;
        const fragment = document.createDocumentFragment();
        while (temp.firstChild) {
          fragment.appendChild(temp.firstChild);
        }
        range.insertNode(fragment);
        
        // Move cursor after inserted content
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        isInternalUpdate.current = true;
        onChange(editor.innerHTML);
      }
    };

    editor.addEventListener('beforeinput', handleBeforeInput);
    return () => editor.removeEventListener('beforeinput', handleBeforeInput);
  }, [effectiveChangeTracking, onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalUpdate.current = true;
      let html = editorRef.current.innerHTML;
      
      // Apply underline formatting for #text: pattern
      const formattedHtml = applyUnderlineFormatting(html);
      if (formattedHtml !== html) {
        const selection = window.getSelection();
        
        editorRef.current.innerHTML = formattedHtml;
        html = formattedHtml;
        
        if (selection && editorRef.current.childNodes.length > 0) {
          const newRange = document.createRange();
          newRange.selectNodeContents(editorRef.current);
          newRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }
      
      onChange(html);
    }
  }, [onChange]);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please sign in to upload images.",
        variant: "destructive",
      });
      return null;
    }

    try {
      setIsUploading(true);
      
      // Create unique filename
      const fileExt = file.type.split('/')[1] || 'png';
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('patient-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        toast({
          title: "Upload failed",
          description: error.message,
          variant: "destructive",
        });
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('patient-images')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const insertImage = (url: string) => {
    if (!editorRef.current) return;
    
    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '200px';
    img.style.borderRadius = '4px';
    img.style.margin = '4px 0';
    img.className = 'inline-block';
    
    // Insert at cursor or at end
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editorRef.current.appendChild(img);
    }
    
    isInternalUpdate.current = true;
    onChange(editorRef.current.innerHTML);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // Check for images first
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const url = await uploadImage(file);
          if (url) {
            insertImage(url);
            toast({
              title: "Image uploaded",
              description: "Image has been added to the imaging field.",
            });
          }
        }
        return;
      }
    }

    // Handle text paste with change tracking
    if (effectiveChangeTracking?.enabled) {
      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        e.preventDefault();
        
        const markedHtml = effectiveChangeTracking.wrapWithMarkup(text);
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        const temp = document.createElement('div');
        temp.innerHTML = markedHtml;
        const fragment = document.createDocumentFragment();
        while (temp.firstChild) {
          fragment.appendChild(temp.firstChild);
        }
        range.insertNode(fragment);
        
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        if (editorRef.current) {
          isInternalUpdate.current = true;
          onChange(editorRef.current.innerHTML);
        }
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const url = await uploadImage(file);
        if (url) {
          insertImage(url);
          toast({
            title: "Image uploaded",
            description: "Image has been added to the imaging field.",
          });
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const getCurrentWord = (): { word: string; range: Range | null } => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return { word: "", range: null };
    
    const range = selection.getRangeAt(0);
    if (!range.collapsed) return { word: "", range: null };
    
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return { word: "", range: null };
    
    const text = node.textContent || "";
    const offset = range.startOffset;
    
    let start = offset;
    while (start > 0 && /\S/.test(text[start - 1])) start--;
    
    const word = text.substring(start, offset);
    
    const wordRange = document.createRange();
    wordRange.setStart(node, start);
    wordRange.setEnd(node, offset);
    
    return { word, range: wordRange };
  };

  const replaceCurrentWord = (replacement: string) => {
    const { range } = getCurrentWord();
    if (!range) return;
    
    range.deleteContents();
    
    // Apply change tracking markup if enabled
    let content: Node;
    if (effectiveChangeTracking?.enabled) {
      const markedHtml = effectiveChangeTracking.wrapWithMarkup(replacement);
      const temp = document.createElement('div');
      temp.innerHTML = markedHtml + " ";
      content = document.createDocumentFragment();
      while (temp.firstChild) {
        content.appendChild(temp.firstChild);
      }
    } else {
      content = document.createTextNode(replacement + " ");
    }
    
    range.insertNode(content);
    
    const selection = window.getSelection();
    if (selection) {
      const newRange = document.createRange();
      newRange.selectNodeContents(editorRef.current!);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    
    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Tab") {
      const { word } = getCurrentWord();
      if (word) {
        const autotext = autotexts.find(a => a.shortcut.toLowerCase() === word.toLowerCase());
        if (autotext) {
          e.preventDefault();
          replaceCurrentWord(autotext.expansion);
          return;
        }
        
        if (e.key === " ") {
          const corrected = medicalDictionary[word.toLowerCase()];
          if (corrected) {
            e.preventDefault();
            replaceCurrentWord(corrected);
            return;
          }
        }
      }
    }
  }, [autotexts]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Sync external value changes
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      const selection = window.getSelection();
      const hadFocus = document.activeElement === editorRef.current;
      
      editorRef.current.innerHTML = value;
      
      if (hadFocus && selection && editorRef.current.childNodes.length > 0) {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [value]);

  return (
    <div className={cn("border-2 border-border rounded-md bg-card overflow-hidden relative", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1.5 border-b border-border bg-blue-50/50 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('undo')}
          title="Undo"
          className="h-6 w-6 p-0"
        >
          <Undo2 className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('redo')}
          title="Redo"
          className="h-6 w-6 p-0"
        >
          <Redo2 className="h-3 w-3" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          title="Bold"
          className="h-6 w-6 p-0"
        >
          <Bold className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('italic')}
          title="Italic"
          className="h-6 w-6 p-0"
        >
          <Italic className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          title="Bullet List"
          className="h-6 w-6 p-0"
        >
          <List className="h-3 w-3" />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('outdent')}
          title="Decrease Indent"
          className="h-6 w-6 p-0"
        >
          <Outdent className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('indent')}
          title="Increase Indent"
          className="h-6 w-6 p-0"
        >
          <Indent className="h-3 w-3" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Text Color"
              className="h-6 w-6 p-0"
            >
              <Palette className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-3 gap-1">
              {textColors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => {
                    if (color.value) {
                      execCommand('foreColor', color.value);
                    } else {
                      execCommand('removeFormat');
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors",
                    !color.value && "border border-dashed border-muted-foreground/30"
                  )}
                  title={color.name}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: color.value || 'transparent' }}
                  />
                  <span className="text-foreground">{color.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="w-px h-4 bg-border mx-1" />
        <div className="flex items-center gap-1 text-[10px] text-blue-600">
          <ImageIcon className="h-3 w-3" />
          <span>Paste or drop images</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <AITextTools
            getSelectedText={() => {
              const selection = window.getSelection();
              if (!selection || selection.isCollapsed || !editorRef.current?.contains(selection.anchorNode)) {
                return null;
              }
              return selection.toString();
            }}
            replaceSelectedText={(newText) => {
              const selection = window.getSelection();
              if (!selection || selection.rangeCount === 0 || !editorRef.current?.contains(selection.anchorNode)) {
                return;
              }
              const range = selection.getRangeAt(0);
              range.deleteContents();
              
              let content: Node;
              if (effectiveChangeTracking?.enabled) {
                const markedHtml = effectiveChangeTracking.wrapWithMarkup(newText);
                const temp = document.createElement('div');
                temp.innerHTML = markedHtml;
                content = document.createDocumentFragment();
                while (temp.firstChild) {
                  content.appendChild(temp.firstChild);
                }
              } else {
                content = document.createTextNode(newText);
              }
              
              range.insertNode(content);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
              
              isInternalUpdate.current = true;
              onChange(editorRef.current!.innerHTML);
            }}
          />
          <DictationButton 
            onTranscript={handleDictationTranscript}
            size="sm"
            className="h-6 w-6"
          />
          <PhrasePicker
            phrases={phrases}
            folders={folders}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title="Insert clinical phrase"
                className="h-6 px-1.5 gap-1"
              >
                <FileText className="h-3 w-3" />
                <span className="hidden sm:inline text-[10px]">Phrases</span>
              </Button>
            }
            onSelect={selectPhrase}
            context={{ section }}
          />
          {isUploading && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Uploading...</span>
              </div>
            </>
          )}
          {changeTracking?.enabled && !isUploading && (
            <Button
              type="button"
              variant={localMarkingDisabled ? "outline" : "ghost"}
              size="sm"
              onClick={() => setLocalMarkingDisabled(!localMarkingDisabled)}
              title={localMarkingDisabled ? "Enable marking" : "Disable marking"}
              className={cn(
                "h-6 px-1.5 gap-1",
                !localMarkingDisabled && "text-orange-600 hover:text-orange-700",
                localMarkingDisabled && "text-muted-foreground"
              )}
            >
              <Highlighter className="h-3 w-3" />
              <span className="text-[10px]">{localMarkingDisabled ? "Off" : "On"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Thumbnail Gallery */}
      {imageUrls.length > 0 && (
        <div className="p-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-1 mb-1.5">
            <Maximize2 className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-medium">
              {imageUrls.length} image{imageUrls.length > 1 ? 's' : ''} - Click to enlarge
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {imageUrls.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => openLightbox(index)}
                className="relative group rounded-md overflow-hidden border-2 border-border hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <img
                  src={url}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-16 h-16 object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Maximize2 className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[9px] px-1 rounded-tl">
                  {index + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className="p-2 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all prose prose-sm max-w-none overflow-y-auto"
        style={{ minHeight, maxHeight: '300px', fontSize: `${fontSize}px` }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Lightbox */}
      <ImageLightbox
        images={imageUrls}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />

      {/* Phrase Form Dialog */}
      {selectedPhrase && (
        <PhraseFormDialog
          phrase={selectedPhrase}
          fields={phraseFields}
          patient={patient}
          open={showForm}
          onOpenChange={(open) => !open && closeForm()}
          onInsert={handleFormInsert}
          onLogUsage={handleLogUsage}
        />
      )}
    </div>
  );
};