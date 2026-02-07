import * as React from "react";
import { Button } from "@/components/ui/button";
import { 
  Bold, Italic, List, ImageIcon, Loader2, Maximize2, Highlighter,
  Indent, Outdent, Palette, Undo2, Redo2, FileText, ImagePlus, ClipboardList,
  Pencil, Eraser, Square, Circle, ArrowUpRight, Type
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Slider } from "@/components/ui/slider";

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

const updateImageAtIndex = (html: string, index: number, newUrl: string): string => {
  const container = document.createElement("div");
  container.innerHTML = html;
  const images = container.querySelectorAll("img");
  const target = images[index];
  if (!target) return html;
  target.setAttribute("src", newUrl);
  return container.innerHTML;
};

export const ImagePasteEditor = ({ 
  value, 
  onChange, 
  placeholder = "Enter text or paste images...", 
  className,
  autotexts = defaultAutotexts,
  fontSize = 14,
  changeTracking = null,
  patient,
  section
}: ImagePasteEditorProps) => {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isInternalUpdate = React.useRef(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  // Per-editor toggle: when true, marking is disabled for this editor
  const [localMarkingDisabled, setLocalMarkingDisabled] = React.useState(false);
  const [annotationOpen, setAnnotationOpen] = React.useState(false);
  const [annotationIndex, setAnnotationIndex] = React.useState<number | null>(null);
  const [annotationUrl, setAnnotationUrl] = React.useState<string | null>(null);
  const [annotationTool, setAnnotationTool] = React.useState<"pen" | "highlighter" | "arrow" | "rect" | "ellipse" | "text" | "eraser">("pen");
  const [annotationColor, setAnnotationColor] = React.useState("#ef4444");
  const [annotationWidth, setAnnotationWidth] = React.useState(4);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const isDrawingRef = React.useRef(false);
  const startPointRef = React.useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = React.useRef<ImageData | null>(null);
  const baseSnapshotRef = React.useRef<ImageData | null>(null);
  const historyRef = React.useRef<ImageData[]>([]);
  const redoRef = React.useRef<ImageData[]>([]);
  const [historySize, setHistorySize] = React.useState(0);
  const [redoSize, setRedoSize] = React.useState(0);
  
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

  // Extract images from current value
  const imageUrls = React.useMemo(() => extractImageUrls(value), [value]);
  const hasImages = imageUrls.length > 0;

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

  const execCommand = React.useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
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

  const handleInput = React.useCallback(() => {
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

  const handleUploadFiles = async (files: FileList | null) => {
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

    await handleUploadFiles(files);
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragActive(false);
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

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
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

  const openAnnotator = (index: number) => {
    setAnnotationIndex(index);
    setAnnotationUrl(imageUrls[index] ?? null);
    setAnnotationOpen(true);
  };

  const drawArrow = React.useCallback((context: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const headLength = Math.max(10, annotationWidth * 2);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.beginPath();
    context.moveTo(to.x, to.y);
    context.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
    context.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
    context.lineTo(to.x, to.y);
    context.fill();
  }, [annotationWidth]);

  const pushHistory = React.useCallback((context: CanvasRenderingContext2D) => {
    const snapshot = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    historyRef.current.push(snapshot);
    redoRef.current = [];
    setHistorySize(historyRef.current.length);
    setRedoSize(0);
  }, []);

  const loadAnnotationImage = React.useCallback((url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxWidth = 960;
      const maxHeight = 640;
      let width = img.naturalWidth || maxWidth;
      let height = img.naturalHeight || maxHeight;
      const scale = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, width, height);
      context.drawImage(img, 0, 0, width, height);
      const snapshot = context.getImageData(0, 0, width, height);
      baseSnapshotRef.current = snapshot;
      historyRef.current = [snapshot];
      redoRef.current = [];
      setHistorySize(1);
      setRedoSize(0);
    };
    img.src = url;
  }, []);

  const restoreSnapshot = (snapshot: ImageData | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.putImageData(snapshot, 0, 0);
  };

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);

    if (annotationTool === "text") {
      const text = window.prompt("Annotation text");
      if (text) {
        context.save();
        context.fillStyle = annotationColor;
        context.font = `${Math.max(14, annotationWidth * 4)}px ui-sans-serif`;
        context.fillText(text, point.x, point.y);
        context.restore();
        pushHistory(context);
      }
      return;
    }

    isDrawingRef.current = true;
    startPointRef.current = point;
    snapshotRef.current = context.getImageData(0, 0, canvas.width, canvas.height);

    if (annotationTool === "pen" || annotationTool === "highlighter" || annotationTool === "eraser") {
      context.beginPath();
      context.moveTo(point.x, point.y);
    }
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const point = getCanvasPoint(event);

    if (annotationTool === "pen" || annotationTool === "highlighter" || annotationTool === "eraser") {
      context.save();
      if (annotationTool === "eraser") {
        context.globalCompositeOperation = "destination-out";
        context.strokeStyle = "rgba(0,0,0,1)";
      } else {
        context.strokeStyle = annotationColor;
      }
      context.lineWidth = annotationWidth;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.globalAlpha = annotationTool === "highlighter" ? 0.3 : 1;
      context.lineTo(point.x, point.y);
      context.stroke();
      context.restore();
      return;
    }

    if (snapshotRef.current) {
      context.putImageData(snapshotRef.current, 0, 0);
    }
    context.save();
    context.strokeStyle = annotationColor;
    context.fillStyle = annotationColor;
    context.lineWidth = annotationWidth;
    context.globalAlpha = 1;
    const start = startPointRef.current;
    if (!start) return;

    if (annotationTool === "rect") {
      context.strokeRect(start.x, start.y, point.x - start.x, point.y - start.y);
    } else if (annotationTool === "ellipse") {
      const radiusX = Math.abs(point.x - start.x) / 2;
      const radiusY = Math.abs(point.y - start.y) / 2;
      const centerX = (point.x + start.x) / 2;
      const centerY = (point.y + start.y) / 2;
      context.beginPath();
      context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      context.stroke();
    } else if (annotationTool === "arrow") {
      drawArrow(context, start, point);
    }
    context.restore();
  };

  const handleCanvasPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const point = getCanvasPoint(event);
    const start = startPointRef.current;

    if (annotationTool === "rect" || annotationTool === "ellipse" || annotationTool === "arrow") {
      if (snapshotRef.current) {
        context.putImageData(snapshotRef.current, 0, 0);
      }
      context.save();
      context.strokeStyle = annotationColor;
      context.fillStyle = annotationColor;
      context.lineWidth = annotationWidth;
      if (start) {
        if (annotationTool === "rect") {
          context.strokeRect(start.x, start.y, point.x - start.x, point.y - start.y);
        } else if (annotationTool === "ellipse") {
          const radiusX = Math.abs(point.x - start.x) / 2;
          const radiusY = Math.abs(point.y - start.y) / 2;
          const centerX = (point.x + start.x) / 2;
          const centerY = (point.y + start.y) / 2;
          context.beginPath();
          context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          context.stroke();
        } else if (annotationTool === "arrow") {
          drawArrow(context, start, point);
        }
      }
      context.restore();
    }

    if (annotationTool !== "text") {
      pushHistory(context);
    }

    isDrawingRef.current = false;
    startPointRef.current = null;
    snapshotRef.current = null;
  };

  const handleAnnotationUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context || historyRef.current.length <= 1) return;
    const last = historyRef.current.pop();
    if (last) {
      redoRef.current.push(last);
      const previous = historyRef.current[historyRef.current.length - 1];
      if (previous) {
        context.putImageData(previous, 0, 0);
      }
      setHistorySize(historyRef.current.length);
      setRedoSize(redoRef.current.length);
    }
  };

  const handleAnnotationRedo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context || redoRef.current.length === 0) return;
    const snapshot = redoRef.current.pop();
    if (snapshot) {
      context.putImageData(snapshot, 0, 0);
      historyRef.current.push(snapshot);
      setHistorySize(historyRef.current.length);
      setRedoSize(redoRef.current.length);
    }
  };

  const handleAnnotationClear = () => {
    if (!baseSnapshotRef.current) return;
    restoreSnapshot(baseSnapshotRef.current);
    historyRef.current = [baseSnapshotRef.current];
    redoRef.current = [];
    setHistorySize(1);
    setRedoSize(0);
  };

  const handleAnnotationSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || annotationIndex === null) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const updated = updateImageAtIndex(value, annotationIndex, dataUrl);
      if (editorRef.current) {
        editorRef.current.innerHTML = updated;
      }
      isInternalUpdate.current = true;
      onChange(updated);
      setAnnotationOpen(false);
      toast({
        title: "Annotation saved",
        description: "Image has been updated in the imaging section.",
      });
    } catch (error) {
      console.error("Annotation save failed:", error);
      toast({
        title: "Annotation failed",
        description: "Unable to save this annotation.",
        variant: "destructive",
      });
    }
  };

  React.useEffect(() => {
    if (annotationOpen && annotationUrl) {
      loadAnnotationImage(annotationUrl);
    }
  }, [annotationOpen, annotationUrl, loadAnnotationImage]);

  // Sync external value changes
  React.useEffect(() => {
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
    <div
      className={cn(
        "border-2 border-border rounded-md bg-card relative h-auto transition-colors",
        isDragActive && "ring-2 ring-blue-400/40 bg-blue-50/20",
        className
      )}
    >
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-6 px-1.5 gap-1 text-[10px]"
          title="Upload images"
        >
          <ImagePlus className="h-3 w-3" />
          <span className="hidden sm:inline">Upload</span>
        </Button>
        {hasImages && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openLightbox(0)}
            className="h-6 px-1.5 gap-1 text-[10px]"
            title="Open image gallery"
          >
            <Maximize2 className="h-3 w-3" />
            <span className="hidden sm:inline">Gallery</span>
          </Button>
        )}
        {section === 'imaging' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertPhraseContent('<div>• <strong>Study</strong>: </div>')}
            className="h-6 px-1.5 gap-1 text-[10px]"
            title="Insert imaging study template"
          >
            <ClipboardList className="h-3 w-3" />
            <span className="hidden sm:inline">Template</span>
          </Button>
        )}
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleUploadFiles(event.target.files);
          if (event.target) {
            event.target.value = '';
          }
        }}
      />

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
                {section === "imaging" && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openAnnotator(index);
                    }}
                    className="absolute left-1 top-1 rounded-full bg-white/90 p-1 text-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    title="Annotate image"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
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
      
      {/* Editor with scroll container - relative positioning ensures proper document flow */}
      <div
        className="max-h-[300px] editor-scroll-container relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        {isDragActive && (
          <div className="absolute inset-2 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-blue-400/60 bg-blue-50/80 text-blue-700 text-sm font-medium pointer-events-none">
            Drop images to upload
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          className="p-2 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all prose prose-sm max-w-none min-h-[80px] relative"
          style={{ fontSize: `${fontSize}px` }}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      </div>

      {/* Lightbox */}
      <ImageLightbox
        images={imageUrls}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />

      <Dialog open={annotationOpen} onOpenChange={setAnnotationOpen}>
        <DialogContent className="max-w-4xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Annotate imaging</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: "pen", label: "Pen", icon: Pencil },
                  { id: "highlighter", label: "Highlighter", icon: Highlighter },
                  { id: "arrow", label: "Arrow", icon: ArrowUpRight },
                  { id: "rect", label: "Rectangle", icon: Square },
                  { id: "ellipse", label: "Ellipse", icon: Circle },
                  { id: "text", label: "Text", icon: Type },
                  { id: "eraser", label: "Eraser", icon: Eraser },
                ].map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Button
                      key={tool.id}
                      type="button"
                      size="sm"
                      variant={annotationTool === tool.id ? "default" : "outline"}
                      className="h-8 px-2"
                      onClick={() => setAnnotationTool(tool.id as typeof annotationTool)}
                    >
                      <Icon className="h-3.5 w-3.5 mr-1" />
                      <span className="text-xs">{tool.label}</span>
                    </Button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <div className="flex items-center gap-1">
                  {[
                    "#ef4444",
                    "#f97316",
                    "#eab308",
                    "#22c55e",
                    "#3b82f6",
                    "#8b5cf6",
                    "#111827",
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAnnotationColor(color)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-shadow",
                        annotationColor === color ? "border-foreground shadow-sm" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      title={`Color ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 min-w-[200px]">
                <span className="text-xs text-muted-foreground">Stroke</span>
                <Slider
                  value={[annotationWidth]}
                  min={2}
                  max={16}
                  step={1}
                  className="w-32"
                  onValueChange={([value]) => setAnnotationWidth(value)}
                />
                <span className="text-xs font-medium w-6">{annotationWidth}px</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleAnnotationUndo} disabled={historySize <= 1}>
                  Undo
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleAnnotationRedo} disabled={redoSize === 0}>
                  Redo
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleAnnotationClear}>
                  Reset
                </Button>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-2 flex justify-center">
              <canvas
                ref={canvasRef}
                className="max-h-[65vh] w-full max-w-3xl rounded-md border bg-white touch-none"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerLeave={handleCanvasPointerUp}
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setAnnotationOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleAnnotationSave}>
              Save annotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
