import { useRef, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ImageIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { AutoText } from "@/types/autotext";
import { defaultAutotexts, medicalDictionary } from "@/data/autotexts";

interface ImagePasteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  autotexts?: AutoText[];
  fontSize?: number;
}

export const ImagePasteEditor = ({ 
  value, 
  onChange, 
  placeholder = "Enter text or paste images...", 
  className,
  minHeight = "60px",
  autotexts = defaultAutotexts,
  fontSize = 14
}: ImagePasteEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChange(editorRef.current.innerHTML);
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
    const textNode = document.createTextNode(replacement + " ");
    range.insertNode(textNode);
    
    const selection = window.getSelection();
    if (selection) {
      const newRange = document.createRange();
      newRange.setStartAfter(textNode);
      newRange.collapse(true);
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
        <div className="flex items-center gap-1 text-[10px] text-blue-600">
          <ImageIcon className="h-3 w-3" />
          <span>Paste or drop images</span>
        </div>
        {isUploading && (
          <div className="flex items-center gap-1 ml-auto text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Uploading...</span>
          </div>
        )}
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className="p-2 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all prose prose-sm max-w-none"
        style={{ minHeight, fontSize: `${fontSize}px` }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
};