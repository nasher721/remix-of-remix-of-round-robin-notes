import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Bold, Italic, Underline, List, ListOrdered, Type } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export const RichTextEditor = ({ 
  value, 
  onChange, 
  placeholder = "Enter text...", 
  className,
  minHeight = "80px"
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fontSizeRef = useRef(14);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    // Trigger onChange after formatting
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

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
        onChange(editorRef.current.innerHTML);
      }
    }
  };

  return (
    <div className={cn("border-2 border-border rounded-md bg-card overflow-hidden", className)}>
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
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className="p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all prose prose-sm max-w-none"
        style={{ minHeight, fontSize: `${fontSizeRef.current}px` }}
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={handleInput}
        data-placeholder={placeholder}
        onFocus={(e) => {
          if (e.currentTarget.innerHTML === '' || e.currentTarget.innerHTML === '<br>') {
            e.currentTarget.dataset.empty = 'true';
          }
        }}
        onBlur={(e) => {
          delete e.currentTarget.dataset.empty;
        }}
      />
    </div>
  );
};
