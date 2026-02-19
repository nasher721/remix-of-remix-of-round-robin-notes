import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline, List, ListOrdered, Type, Sparkles, Highlighter,
  Indent, Outdent, Palette, Undo2, Redo2, FileText, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Link2, Minus,
  Superscript, Subscript, Search, Table as TableIcon
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { defaultAutotexts, medicalDictionary } from "@/data/autotexts";
import type { AutoText } from "@/types/autotext";
import { DictationButton } from "./DictationButton";
import { AITextTools } from "./AITextTools";
import { DocumentImport } from "./DocumentImport";
import { PhrasePicker, PhraseFormDialog } from "./phrases";
import { usePhraseExpansion } from "@/hooks/usePhraseExpansion";
import { useClinicalPhrases } from "@/hooks/useClinicalPhrases";
import { useEditorKeyboardShortcuts } from "@/hooks/useEditorKeyboardShortcuts";
import { EditorFindReplace } from "./EditorFindReplace";
import { EditorStatusBar } from "./EditorStatusBar";
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

const highlightColors = [
  { name: "None", value: "" },
  { name: "Yellow", value: "#fef08a" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Blue", value: "#bfdbfe" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Purple", value: "#e9d5ff" },
];

// Rich text editor with formatting, autotexts, and optional change tracking

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
  patient?: Patient;
  section?: string;
}

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = "Enter text...",
  className,
  autotexts = defaultAutotexts,
  fontSize = 14,
  changeTracking = null,
  patient,
  section
}: RichTextEditorProps) => {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fontSizeRef = React.useRef(fontSize);
  const [showAutocomplete, setShowAutocomplete] = React.useState(false);
  const [autocompleteOptions, setAutocompleteOptions] = React.useState<{ shortcut: string; expansion: string }[]>([]);
  const [autocompletePosition, setAutocompletePosition] = React.useState({ top: 0, left: 0 });
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const lastWordRef = React.useRef("");
  const isInternalUpdate = React.useRef(false);
  // Per-editor toggle: null means follow global setting, false means disabled for this editor
  const [localMarkingDisabled, setLocalMarkingDisabled] = React.useState(false);
  // Find & replace state
  const [findReplaceMode, setFindReplaceMode] = React.useState<"find" | "replace" | null>(null);
  // Table picker state
  const [showTablePicker, setShowTablePicker] = React.useState(false);
  const [tableHover, setTableHover] = React.useState({ rows: 0, cols: 0 });

  // Effective change tracking state - must be defined before any callbacks that use it
  const effectiveChangeTracking = localMarkingDisabled ? null : changeTracking;

  // Clinical phrase system
  const { folders } = useClinicalPhrases();

  // Insert phrase content handler
  const insertPhraseContent = React.useCallback((content: string) => {
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

  // Handle dictation transcript insertion
  const handleDictationTranscript = React.useCallback((text: string) => {
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

  const execCommand = React.useCallback((command: string, cmdValue?: string) => {
    document.execCommand(command, false, cmdValue);
    editorRef.current?.focus();
    if (editorRef.current) {
      isInternalUpdate.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Use native event listener for beforeinput (more reliable than React's onBeforeInput)
  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleBeforeInput = (e: InputEvent) => {
      if (!effectiveChangeTracking?.enabled || !e.data) return;

      // Handle both insertText and insertFromPaste
      if (e.inputType === 'insertText' || e.inputType === 'insertFromPaste') {
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

  // Handle paste separately for text content
  const handlePaste = React.useCallback((e: React.ClipboardEvent) => {
    if (!effectiveChangeTracking?.enabled) return;

    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;

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
  }, [effectiveChangeTracking, onChange]);

  const handleInput = React.useCallback(() => {
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

  // Insert link helper
  const handleInsertLink = React.useCallback(() => {
    const selection = window.getSelection();
    const selectedText = selection && !selection.isCollapsed ? selection.toString() : "";
    const url = window.prompt("Enter URL:", "https://");
    if (url) {
      if (selectedText) {
        execCommand("createLink", url);
      } else {
        const linkText = window.prompt("Link text:", url) || url;
        const link = `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
        execCommand("insertHTML", link);
      }
    }
  }, [execCommand]);

  // Insert table helper
  const insertTable = React.useCallback((rows: number, cols: number) => {
    if (!editorRef.current) return;
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        if (r === 0) {
          html += '<th>&nbsp;</th>';
        } else {
          html += '<td>&nbsp;</td>';
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table><br>';
    execCommand("insertHTML", html);
    setShowTablePicker(false);
  }, [execCommand]);

  // Keyboard shortcut hook
  const { handleShortcut } = useEditorKeyboardShortcuts({
    execCommand,
    onFindReplace: (mode) => setFindReplaceMode(mode),
    onInsertLink: handleInsertLink,
  });

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    // Check keyboard shortcuts first
    if (handleShortcut(e)) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAutocomplete, autocompleteOptions, selectedIndex, autotexts, handleShortcut]);

  const handleKeyUp = React.useCallback((e: React.KeyboardEvent) => {
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
  React.useEffect(() => {
    fontSizeRef.current = fontSize;
    if (editorRef.current) {
      editorRef.current.style.fontSize = `${fontSize}px`;
    }
  }, [fontSize]);

  // Sync external value changes - only when value actually changes externally
  React.useEffect(() => {
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
    <div className={cn("border-2 border-border rounded-md bg-card relative h-auto", className)}>
      {/* Find & Replace Panel */}
      {findReplaceMode && (
        <EditorFindReplace
          editorRef={editorRef as React.RefObject<HTMLDivElement>}
          mode={findReplaceMode}
          onClose={() => setFindReplaceMode(null)}
          onChange={() => {
            if (editorRef.current) {
              isInternalUpdate.current = true;
              onChange(editorRef.current.innerHTML);
            }
          }}
        />
      )}

      {/* Toolbar */}
      <div role="toolbar" aria-label="Text formatting" className="flex items-center gap-1 p-2 border-b border-border bg-muted/50 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('undo')}
          title="Undo (Ctrl+Z)"
          aria-label="Undo (Ctrl+Z)"
          className="h-7 w-7 p-0"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('redo')}
          title="Redo (Ctrl+Y)"
          aria-label="Redo (Ctrl+Y)"
          className="h-7 w-7 p-0"
        >
          <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Text formatting */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('bold')}
          title="Bold (Ctrl+B)"
          aria-label="Bold (Ctrl+B)"
          className="h-7 w-7 p-0"
        >
          <Bold className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('italic')}
          title="Italic (Ctrl+I)"
          aria-label="Italic (Ctrl+I)"
          className="h-7 w-7 p-0"
        >
          <Italic className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('underline')}
          title="Underline (Ctrl+U)"
          aria-label="Underline (Ctrl+U)"
          className="h-7 w-7 p-0"
        >
          <Underline className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('strikeThrough')}
          title="Strikethrough (Ctrl+Shift+X)"
          aria-label="Strikethrough (Ctrl+Shift+X)"
          className="h-7 w-7 p-0"
        >
          <Strikethrough className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('superscript')}
          title="Superscript"
          aria-label="Superscript"
          className="h-7 w-7 p-0"
        >
          <Superscript className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('subscript')}
          title="Subscript"
          aria-label="Subscript"
          className="h-7 w-7 p-0"
        >
          <Subscript className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Heading selector */}
        <select
          onChange={(e) => {
            const val = e.target.value;
            if (val === "p") {
              execCommand("formatBlock", "<p>");
            } else {
              execCommand("formatBlock", `<${val}>`);
            }
          }}
          defaultValue="p"
          aria-label="Heading level"
          className="h-7 px-1 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
          title="Heading level"
        >
          <option value="p">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>
        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertUnorderedList')}
          title="Bullet List (Ctrl+Shift+8)"
          aria-label="Bullet list (Ctrl+Shift+8)"
          className="h-7 w-7 p-0"
        >
          <List className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertOrderedList')}
          title="Numbered List (Ctrl+Shift+7)"
          aria-label="Numbered list (Ctrl+Shift+7)"
          className="h-7 w-7 p-0"
        >
          <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Indent */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('outdent')}
          title="Decrease Indent"
          aria-label="Decrease indent"
          className="h-7 w-7 p-0"
        >
          <Outdent className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('indent')}
          title="Increase Indent"
          aria-label="Increase indent"
          className="h-7 w-7 p-0"
        >
          <Indent className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Alignment */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyLeft')}
          title="Align Left"
          aria-label="Align left"
          className="h-7 w-7 p-0"
        >
          <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyCenter')}
          title="Align Center"
          aria-label="Align center"
          className="h-7 w-7 p-0"
        >
          <AlignCenter className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyRight')}
          title="Align Right"
          aria-label="Align right"
          className="h-7 w-7 p-0"
        >
          <AlignRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('justifyFull')}
          title="Justify"
          aria-label="Justify text"
          className="h-7 w-7 p-0"
        >
          <AlignJustify className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Text color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Text Color"
              aria-label="Text color"
              className="h-7 w-7 p-0"
            >
              <Palette className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-3 gap-1" role="group" aria-label="Text colors">
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
                  aria-label={`Text color ${color.name}`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: color.value || 'transparent' }}
                    aria-hidden="true"
                  />
                  <span className="text-foreground">{color.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Highlight / background color */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Highlight Color"
              aria-label="Highlight color"
              className="h-7 w-7 p-0"
            >
              <Highlighter className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="grid grid-cols-4 gap-1" role="group" aria-label="Highlight colors">
              {highlightColors.map((color) => (
                <button
                  key={color.name}
                  onClick={() => {
                    if (color.value) {
                      execCommand('hiliteColor', color.value);
                    } else {
                      execCommand('hiliteColor', 'transparent');
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors",
                    !color.value && "border border-dashed border-muted-foreground/30"
                  )}
                  title={color.name}
                  aria-label={`Highlight ${color.name}`}
                >
                  <span
                    className="w-4 h-4 rounded border border-border"
                    style={{ backgroundColor: color.value || 'transparent' }}
                    aria-hidden="true"
                  />
                  <span className="text-foreground">{color.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <div className="w-px h-5 bg-border mx-1" aria-hidden="true" />

        {/* Insert link */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleInsertLink}
          title="Insert Link (Ctrl+K)"
          aria-label="Insert link (Ctrl+K)"
          className="h-7 w-7 p-0"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>

        {/* Insert horizontal rule */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => execCommand('insertHorizontalRule')}
          title="Horizontal Rule"
          aria-label="Insert horizontal rule"
          className="h-7 w-7 p-0"
        >
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>

        {/* Insert table */}
        <Popover open={showTablePicker} onOpenChange={setShowTablePicker}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Insert Table"
              aria-label="Insert table"
              aria-haspopup="true"
              className="h-7 w-7 p-0"
            >
              <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="text-xs text-muted-foreground mb-1" aria-live="polite" aria-atomic="true">
              {tableHover.rows > 0 ? `${tableHover.rows} × ${tableHover.cols}` : "Select size"}
            </div>
            <div
              className="grid gap-0.5"
              style={{ gridTemplateColumns: "repeat(6, 1fr)" }}
              role="grid"
              aria-label="Table size picker"
            >
              {Array.from({ length: 6 }, (_, r) =>
                Array.from({ length: 6 }, (_, c) => (
                  <button
                    key={`${r}-${c}`}
                    aria-label={`${r + 1} rows by ${c + 1} columns`}
                    className={cn(
                      "w-5 h-5 border border-border rounded-[2px] transition-colors",
                      r < tableHover.rows && c < tableHover.cols
                        ? "bg-primary/30 border-primary/50"
                        : "bg-muted/30 hover:bg-muted/60"
                    )}
                    onMouseEnter={() => setTableHover({ rows: r + 1, cols: c + 1 })}
                    onMouseLeave={() => setTableHover({ rows: 0, cols: 0 })}
                    onClick={() => insertTable(r + 1, c + 1)}
                  />
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Find */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setFindReplaceMode(findReplaceMode ? null : "find")}
          title="Find & Replace (Ctrl+F)"
          aria-label="Find and replace (Ctrl+F)"
          aria-pressed={!!findReplaceMode}
          className="h-7 w-7 p-0"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />

        {/* Font size */}
        <div className="flex items-center gap-2">
          <Type className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <select
            value={fontSizeRef.current}
            onChange={(e) => handleFontSizeChange([parseInt(e.target.value)])}
            className="h-7 px-2 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
            title="Font size"
            aria-label="Font size"
          >
            {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24].map((size) => (
              <option key={size} value={size}>{size}px</option>
            ))}
          </select>
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
          <DocumentImport
            onImport={(content) => {
              if (editorRef.current) {
                // Append imported content to existing content
                const newContent = editorRef.current.innerHTML
                  ? `${editorRef.current.innerHTML}<br/><br/>${content}`
                  : content;
                editorRef.current.innerHTML = newContent;
                isInternalUpdate.current = true;
                onChange(newContent);
              }
            }}
          />
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
          />
          <div className="w-px h-5 bg-border" />
          <PhrasePicker
            phrases={phrases}
            folders={folders}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title="Insert clinical phrase"
                className="h-7 px-2 gap-1"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">Phrases</span>
              </Button>
            }
            onSelect={selectPhrase}
            context={{ section }}
          />
          {changeTracking?.enabled && (
            <Button
              type="button"
              variant={localMarkingDisabled ? "outline" : "ghost"}
              size="sm"
              onClick={() => setLocalMarkingDisabled(!localMarkingDisabled)}
              title={localMarkingDisabled ? "Enable marking for this field" : "Disable marking for this field"}
              className={cn(
                "h-7 px-2 gap-1",
                !localMarkingDisabled && "text-orange-600 hover:text-orange-700",
                localMarkingDisabled && "text-muted-foreground"
              )}
            >
              <Highlighter className="h-3 w-3" />
              <span className="hidden sm:inline text-xs">
                {localMarkingDisabled ? "Off" : "On"}
              </span>
            </Button>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span className="hidden sm:inline">Autotexts</span>
          </div>
        </div>
      </div>

      {/* Editor with scroll container - relative positioning ensures proper document flow */}
      <div className="max-h-[300px] editor-scroll-container relative">
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={section ? `${section} notes` : placeholder}
          contentEditable
          className="p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all prose prose-sm max-w-none min-h-[80px] relative whitespace-pre-wrap text-card-foreground"
          style={{ fontSize: `${fontSizeRef.current}px` }}
          onInput={handleInput}
          onPaste={handlePaste}
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
      </div>

      {/* Status bar */}
      <EditorStatusBar html={value} />

      {/* Autocomplete dropdown */}
      {showAutocomplete && autocompleteOptions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Autotext suggestions"
          className="absolute z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden list-none m-0 p-0"
          style={{ top: autocompletePosition.top, left: autocompletePosition.left, minWidth: 200 }}
        >
          {autocompleteOptions.map((option, index) => (
            <li
              key={option.shortcut}
              role="option"
              aria-selected={index === selectedIndex}
              id={`autotext-option-${index}`}
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
            </li>
          ))}
          <li className="px-3 py-1 text-xs text-muted-foreground border-t bg-muted/30" aria-hidden="true">
            Tab/Enter to insert • Esc to close
          </li>
        </ul>
      )}

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
