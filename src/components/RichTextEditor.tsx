import { useRef, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Bold, Italic, Underline, List, ListOrdered, Type, Sparkles, Highlighter } from "lucide-react";
import { cn } from "@/lib/utils";
import { defaultAutotexts, medicalDictionary } from "@/data/autotexts";
import type { AutoText } from "@/types/autotext";

interface RichTextEditorProps {
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
}

export const RichTextEditor = ({ 
  value, 
  onChange, 
  placeholder = "Enter text...", 
  className,
  minHeight = "80px",
  autotexts = defaultAutotexts,
  fontSize = 14,
  changeTracking = null
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fontSizeRef = useRef(fontSize);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = useState<{shortcut: string; expansion: string}[]>([]);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const lastWordRef = useRef("");
  const isInternalUpdate = useRef(false);

  const execCommand = useCallback((command: string, cmdValue?: string) => {
    document.execCommand(command, false, cmdValue);
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

  const handleFontSizeChange = (newSize: number[]) => {
    fontSizeRef.current = newSize[0];
    if (editorRef.current) {
      editorRef.current.style.fontSize = `${newSize[0]}px`;
    }
  };

  const applyFontSizeToSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = `${fontSizeRef.current}px`;
      range.surroundContents(span);
      editorRef.current?.focus();
      if (editorRef.current) {
        isInternalUpdate.current = true;
        onChange(editorRef.current.innerHTML);
      }
    }
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
    
    // Find word boundaries
    let start = offset;
    
    while (start > 0 && /\S/.test(text[start - 1])) start--;
    
    const word = text.substring(start, offset);
    
    // Create range for the word
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
    if (changeTracking?.enabled) {
      const markedHtml = changeTracking.wrapWithMarkup(replacement);
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
    
    // Move cursor after inserted text
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
    
    setShowAutocomplete(false);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle autocomplete navigation
    if (showAutocomplete && autocompleteOptions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % autocompleteOptions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + autocompleteOptions.length) % autocompleteOptions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        replaceCurrentWord(autocompleteOptions[selectedIndex].expansion);
        return;
      }
      if (e.key === "Escape") {
        setShowAutocomplete(false);
        return;
      }
    }

    // Handle autotext expansion on space/tab
    if (e.key === " " || e.key === "Tab") {
      const { word } = getCurrentWord();
      if (word) {
        const autotext = autotexts.find(a => a.shortcut.toLowerCase() === word.toLowerCase());
        if (autotext) {
          e.preventDefault();
          replaceCurrentWord(autotext.expansion);
          return;
        }
        
        // Autocorrect on space
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
  }, [showAutocomplete, autocompleteOptions, selectedIndex, autotexts]);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    // Don't show autocomplete for navigation/modifier keys
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift", "Control", "Alt", "Meta", "Escape", "Enter", "Tab"].includes(e.key)) {
      return;
    }

    const { word } = getCurrentWord();
    lastWordRef.current = word;

    if (word.length >= 2) {
      const matches = autotexts.filter(a => 
        a.shortcut.toLowerCase().startsWith(word.toLowerCase())
      ).slice(0, 5);

      if (matches.length > 0) {
        // Get caret position
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const editorRect = editorRef.current?.getBoundingClientRect();
          
          if (editorRect) {
            setAutocompletePosition({
              top: rect.bottom - editorRect.top + 4,
              left: rect.left - editorRect.left
            });
          }
        }
        
        setAutocompleteOptions(matches);
        setSelectedIndex(0);
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  }, [autotexts]);

  // Sync fontSize prop with ref
  useEffect(() => {
    fontSizeRef.current = fontSize;
    if (editorRef.current) {
      editorRef.current.style.fontSize = `${fontSize}px`;
    }
  }, [fontSize]);

  // Sync external value changes - only when value actually changes externally
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      // Save cursor position
      const selection = window.getSelection();
      const hadFocus = document.activeElement === editorRef.current;
      
      editorRef.current.innerHTML = value;
      
      // Restore cursor to end if we had focus
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
      <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/50 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          title="Bold (Ctrl+B)"
          className="h-7 w-7 p-0"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('italic')}
          title="Italic (Ctrl+I)"
          className="h-7 w-7 p-0"
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('underline')}
          title="Underline (Ctrl+U)"
          className="h-7 w-7 p-0"
        >
          <Underline className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          title="Bullet List"
          className="h-7 w-7 p-0"
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertOrderedList')}
          title="Numbered List"
          className="h-7 w-7 p-0"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <div className="flex items-center gap-2 ml-2">
          <Type className="h-3.5 w-3.5 text-muted-foreground" />
          <Slider
            defaultValue={[14]}
            min={10}
            max={24}
            step={1}
            className="w-20"
            onValueChange={handleFontSizeChange}
          />
          <span className="text-xs text-muted-foreground w-6">{fontSizeRef.current}px</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={applyFontSizeToSelection}
            title="Apply size to selection"
            className="h-6 text-xs px-2"
          >
            Apply
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {changeTracking?.enabled && (
            <div className="flex items-center gap-1 text-xs text-orange-600">
              <Highlighter className="h-3 w-3" />
              <span className="hidden sm:inline">Marking</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">Autotexts</span>
          </div>
        </div>
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className="p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all prose prose-sm max-w-none"
        style={{ minHeight, fontSize: `${fontSizeRef.current}px` }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        data-placeholder={placeholder}
        onFocus={(e) => {
          if (e.currentTarget.innerHTML === '' || e.currentTarget.innerHTML === '<br>') {
            e.currentTarget.dataset.empty = 'true';
          }
        }}
        onBlur={(e) => {
          delete e.currentTarget.dataset.empty;
          setShowAutocomplete(false);
        }}
        suppressContentEditableWarning
      />

      {/* Autocomplete dropdown */}
      {showAutocomplete && autocompleteOptions.length > 0 && (
        <div 
          className="absolute z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
          style={{ top: autocompletePosition.top, left: autocompletePosition.left, minWidth: 200 }}
        >
          {autocompleteOptions.map((option, index) => (
            <div
              key={option.shortcut}
              className={cn(
                "px-3 py-2 cursor-pointer text-sm flex items-center gap-2",
                index === selectedIndex ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                replaceCurrentWord(option.expansion);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="font-mono text-xs bg-muted/50 px-1 rounded">{option.shortcut}</span>
              <span className="truncate">{option.expansion}</span>
            </div>
          ))}
          <div className="px-3 py-1 text-xs text-muted-foreground border-t bg-muted/30">
            Tab/Enter to insert • Esc to close
          </div>
        </div>
      )}
    </div>
  );
};
