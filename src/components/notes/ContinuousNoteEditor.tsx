import * as React from "react";
import { ArrowDownToLine, Bold, Check, Clipboard, Clock3, List, ListPlus, Redo2, Type, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeHtml, sanitizePastedHtml } from "@/lib/sanitize";
import { buildNoteSections, copyableNote, hasNoteContent, noteText, readNoteUpdates, type NoteSection } from "@/lib/continuousNote";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types/patient";
import type { AutoText } from "@/types/autotext";

interface ContinuousNoteEditorProps {
  patient: Patient;
  systems: readonly { key: string; label: string }[];
  onUpdate: (id: string, field: string, value: unknown) => void;
  autotexts?: AutoText[];
  changeTracking?: {
    enabled: boolean;
    wrapWithMarkup: (text: string) => string;
    wrapHtmlWithMarkup?: (html: string) => string;
  } | null;
}

/** One editing surface, with protected headings that map directly to existing chart fields. */
export function ContinuousNoteEditor(props: ContinuousNoteEditorProps) {
  // A patient change always gets a fresh DOM and selection history.
  return <NoteDocument key={props.patient.id} {...props} />;
}

function NoteDocument({ patient, systems, onUpdate, autotexts = [], changeTracking }: ContinuousNoteEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const selectionRef = React.useRef<Range | null>(null);
  const lastValidHtml = React.useRef("");
  const [activeKey, setActiveKey] = React.useState("clinicalSummary");
  const [largeText, setLargeText] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [revision, setRevision] = React.useState(0);
  const headingId = React.useId();
  const helpId = React.useId();
  const systemSignature = JSON.stringify(systems.map(({ key, label }) => ({ key, label })));
  const sections = React.useMemo(() => buildNoteSections(patient, JSON.parse(systemSignature)), [patient, systemSignature]);
  const snapshot = React.useRef<NoteSection[]>(sections);
  const previousIncoming = React.useRef<NoteSection[]>([]);
  const history = React.useRef({ undo: [] as string[], redo: [] as string[], lastInputAt: 0, lastKey: "" });
  const restoringHistory = React.useRef(false);
  const historyAction = React.useRef<(action: "undo" | "redo") => void>(() => {});

  React.useLayoutEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const structureChanged = sections.map((s) => s.key + s.label).join("|") !== previousIncoming.current.map((s) => s.key + s.label).join("|");
    let externalEdit = structureChanged;
    if (structureChanged) {
      root.replaceChildren();
      for (const section of sections) {
        const wrapper = document.createElement("div");
        wrapper.dataset.noteSection = section.key;
        wrapper.dataset.documentationSection = section.group;
        const heading = document.createElement("h2");
        heading.contentEditable = "false";
        heading.textContent = section.label;
        const body = document.createElement("div");
        body.dataset.noteBody = section.key;
        body.innerHTML = sanitizeHtml(section.html || "<p><br></p>");
        wrapper.append(heading, body);
        root.append(wrapper);
      }
      selectionRef.current = null;
    } else {
      // Update only fields changed by incoming chart state. Other fields retain their caret/undo history.
      sections.forEach((section, index) => {
        if (section.html === previousIncoming.current[index]?.html) return;
        const body = root.children[index]?.children[1] as HTMLElement | undefined;
        const html = sanitizeHtml(section.html || "<p><br></p>");
        const matches = body && (section.key.startsWith("medications.")
          ? noteText(body.innerHTML) === noteText(html)
          : sanitizeHtml(body.innerHTML) === html);
        if (body && !matches) {
          body.innerHTML = html;
          externalEdit = true;
        }
      });
    }
    if (externalEdit) {
      history.current = { undo: [], redo: [], lastInputAt: 0, lastKey: "" };
      setRevision((value) => value + 1);
    }
    snapshot.current = sections.map((section, index) => ({ ...section, html: (root.children[index].children[1] as HTMLElement).innerHTML }));
    previousIncoming.current = sections;
    lastValidHtml.current = root.innerHTML;
  }, [sections]);

  const bodyForNode = React.useCallback((node: Node | null): HTMLElement | null => {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node?.parentElement;
    const body = element?.closest<HTMLElement>("[data-note-body]") ?? null;
    return body && editorRef.current?.contains(body) ? body : null;
  }, []);

  const selectionIsInSection = React.useCallback(() => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return false;
    const range = selection.getRangeAt(0);
    const start = bodyForNode(range.startContainer);
    return Boolean(start && start === bodyForNode(range.endContainer));
  }, [bodyForNode]);

  const protectHeadings = React.useCallback(() => {
    setMessage("Section headings stay in place. Select text within one section to edit it.");
  }, []);

  const publish = React.useCallback(() => {
    const root = editorRef.current;
    if (!root) return;
    const updates = readNoteUpdates(root, snapshot.current, patient.medications);
    if (!updates) {
      root.innerHTML = lastValidHtml.current;
      selectionRef.current = null;
      protectHeadings();
      return;
    }
    if (root.innerHTML !== lastValidHtml.current && !restoringHistory.current) {
      const now = Date.now();
      if (now - history.current.lastInputAt > 750 || history.current.lastKey !== activeKey) {
        history.current.undo.push(lastValidHtml.current);
        if (history.current.undo.length > 60) history.current.undo.shift();
      }
      history.current.redo = [];
      history.current.lastInputAt = now;
      history.current.lastKey = activeKey;
    }
    snapshot.current = snapshot.current.map((section, index) => ({ ...section, html: (root.children[index].children[1] as HTMLElement).innerHTML }));
    lastValidHtml.current = root.innerHTML;
    setRevision((value) => value + 1);
    setMessage("");
    updates.forEach(({ field, value }) => onUpdate(patient.id, field, value));
  }, [patient.id, patient.medications, onUpdate, protectHeadings, activeKey]);

  const insertHtmlAtSelection = React.useCallback((html: string) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selectionIsInSection()) return;
    const range = selection.getRangeAt(0);
    const template = document.createElement("template");
    template.innerHTML = sanitizeHtml(html);
    const last = template.content.lastChild;
    if (!last) return;
    range.deleteContents();
    range.insertNode(template.content);
    range.setStartAfter(last);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    selectionRef.current = range.cloneRange();
    publish();
  }, [publish, selectionIsInSection]);

  React.useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const beforeInput = (event: InputEvent) => {
      if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
        event.preventDefault();
        historyAction.current(event.inputType === "historyUndo" ? "undo" : "redo");
        return;
      }
      const ranges = event.getTargetRanges?.() ?? [];
      const crossesBoundary = ranges.some((range) => {
        const start = bodyForNode(range.startContainer);
        return !start || start !== bodyForNode(range.endContainer);
      });
      if (!selectionIsInSection() || crossesBoundary) {
        event.preventDefault();
        protectHeadings();
        return;
      }
      if (changeTracking?.enabled && event.inputType === "insertText" && event.data && !event.isComposing) {
        event.preventDefault();
        const text = sanitizePastedHtml("", event.data);
        const marked = changeTracking.wrapHtmlWithMarkup?.(text) ?? changeTracking.wrapWithMarkup(event.data);
        insertHtmlAtSelection(marked);
      }
    };
    const rememberSelection = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || !selectionIsInSection()) return;
      selectionRef.current = selection.getRangeAt(0).cloneRange();
      const body = bodyForNode(selection.anchorNode);
      if (body?.dataset.noteBody) setActiveKey(body.dataset.noteBody);
    };
    root.addEventListener("beforeinput", beforeInput);
    document.addEventListener("selectionchange", rememberSelection);
    return () => {
      root.removeEventListener("beforeinput", beforeInput);
      document.removeEventListener("selectionchange", rememberSelection);
    };
  }, [bodyForNode, selectionIsInSection, protectHeadings, changeTracking, insertHtmlAtSelection]);

  const jump = React.useCallback((key: string) => {
    const root = editorRef.current;
    const body = Array.from(root?.querySelectorAll<HTMLElement>("[data-note-body]") ?? []).find((node) => node.dataset.noteBody === key);
    if (!root || !body) return;
    root.focus({ preventScroll: true });
    const range = document.createRange();
    let end: Node = body;
    while (end.lastChild && !["BR", "IMG"].includes(end.lastChild.nodeName)) end = end.lastChild;
    range.selectNodeContents(end);
    range.collapse(false);
    if (end.lastChild?.nodeName === "BR") range.setStartBefore(end.lastChild);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    selectionRef.current = range.cloneRange();
    setActiveKey(key);
    body.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, []);

  historyAction.current = (action) => {
    const root = editorRef.current;
    const target = history.current[action].pop();
    if (!root || target === undefined) return;
    history.current[action === "undo" ? "redo" : "undo"].push(lastValidHtml.current);
    history.current.lastInputAt = 0;
    root.innerHTML = target;
    restoringHistory.current = true;
    try { publish(); } finally { restoringHistory.current = false; }
    jump(activeKey);
  };

  // Existing desktop chart navigation also works while the one-page editor is mounted.
  React.useEffect(() => {
    const root = editorRef.current;
    const handleJump = (event: Event) => {
      const target = (event as CustomEvent<string>).detail;
      const section = snapshot.current.find((item) => item.group === target);
      if (section) jump(section.key);
    };
    root?.addEventListener("rr:jump-note-section", handleJump);
    return () => root?.removeEventListener("rr:jump-note-section", handleJump);
  }, [jump]);

  const restoreSelection = () => {
    const root = editorRef.current;
    root?.focus({ preventScroll: true });
    const range = selectionRef.current;
    if (range && root?.contains(range.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else jump(activeKey);
  };

  const command = (name: string, value?: string) => {
    if (name === "undo" || name === "redo") { historyAction.current(name); return; }
    restoreSelection();
    if (!selectionIsInSection()) { protectHeadings(); return; }
    history.current.lastInputAt = 0;
    document.execCommand(name, false, value);
    publish();
    history.current.lastInputAt = 0;
  };

  const insert = (html: string) => {
    restoreSelection();
    if (!selectionIsInSection()) { protectHeadings(); return; }
    const safeHtml = sanitizeHtml(html);
    const marked = changeTracking?.enabled
      ? changeTracking.wrapHtmlWithMarkup?.(safeHtml) ?? changeTracking.wrapWithMarkup(noteText(safeHtml))
      : safeHtml;
    history.current.lastInputAt = 0;
    insertHtmlAtSelection(marked);
    history.current.lastInputAt = 0;
  };

  // revision makes locally edited content available before asynchronous persistence completes.
  void revision;
  const liveSections = snapshot.current;
  const filled = liveSections.filter((section) => hasNoteContent(section.html));
  const wordCount = liveSections.map((section) => noteText(section.html)).join(" ").trim().split(/\s+/).filter(Boolean).length;
  const nextEmpty = () => {
    const index = liveSections.findIndex((section) => section.key === activeKey);
    const ordered = [...liveSections.slice(index + 1), ...liveSections.slice(0, index + 1)];
    const next = ordered.find((section) => !hasNoteContent(section.html));
    if (next) jump(next.key);
    else setMessage("Every section has text. Review the note for accuracy before handoff.");
  };
  const activeSection = liveSections.find((section) => section.key === activeKey);
  const isMedicationSection = activeKey.startsWith("medications.");

  return (
    <section className="continuous-note relative overflow-hidden rounded-xl border border-border bg-background shadow-sm" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <h3 id={headingId} className="text-base font-semibold text-foreground">Rounding note</h3>
          <p id={helpId} className="text-xs text-muted-foreground">One page, all sections. Edits use your chart’s autosave.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" className="min-h-11 gap-2" onClick={nextEmpty}>
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />Next empty
          </Button>
          <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={async () => {
            try { await navigator.clipboard.writeText(copyableNote(snapshot.current)); setMessage("Note copied. Empty sections are omitted; image attachments stay in the chart."); }
            catch { setMessage("Could not copy. Select the note and use your device’s Copy command."); }
          }}><Clipboard className="h-4 w-4" aria-hidden="true" />Copy note</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-2" role="group" aria-label="Note writing tools">
        {([["undo", "Undo", Undo2], ["redo", "Redo", Redo2], ["bold", "Bold", Bold], ["insertUnorderedList", "Bullet list", List]] as const).map(([action, label, Icon]) => (
          <Button key={action} type="button" variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={label} title={label}
            disabled={(action === "undo" && history.current.undo.length === 0) || (action === "redo" && history.current.redo.length === 0)}
            onMouseDown={(event) => event.preventDefault()} onClick={() => command(action)}><Icon className="h-4 w-4" aria-hidden="true" /></Button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button type="button" variant="ghost" className="min-h-11 gap-2" onMouseDown={(event) => event.preventDefault()}
          onClick={() => insert(sanitizePastedHtml("", `[${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}] `))}>
          <Clock3 className="h-4 w-4" aria-hidden="true" />Timestamp
        </Button>
        <Button type="button" variant="ghost" className="min-h-11 gap-2" disabled={isMedicationSection || Boolean(activeSection && hasNoteContent(activeSection.html))}
          title="Add blank prompts to an empty section" onClick={() => insert("<p>Assessment: </p><p>Plan: </p><p>Follow-up: </p>")}>
          <ListPlus className="h-4 w-4" aria-hidden="true" />Add outline
        </Button>
        {autotexts.length > 0 && <select aria-label="Insert saved phrase" className="min-h-11 min-w-0 max-w-[200px] rounded-md border border-input bg-background px-2 text-sm" defaultValue=""
          onChange={(event) => {
            const phrase = autotexts[Number(event.target.value)];
            if (phrase) insert(sanitizePastedHtml("", phrase.expansion));
            event.target.value = "";
          }}>
          <option value="" disabled>Insert saved phrase…</option>
          {autotexts.map((phrase, index) => <option key={`${phrase.shortcut}-${index}`} value={index}>{phrase.shortcut} · {phrase.expansion.slice(0, 65)}</option>)}
        </select>}
        <Button type="button" variant="ghost" className="ml-auto min-h-11 gap-2" aria-pressed={largeText} onClick={() => setLargeText((value) => !value)}>
          <Type className="h-4 w-4" aria-hidden="true" />Larger text
        </Button>
      </div>
      <div className="flex flex-col lg:flex-row">
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-muted/20 p-2 lg:w-44 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r" aria-label="Jump within note">
          {liveSections.map((section) => <button key={section.key} type="button" onClick={() => jump(section.key)}
            aria-label={`${section.label}, ${hasNoteContent(section.html) ? "has text" : "empty"}`}
            className={cn("flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeKey === section.key ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            aria-current={activeKey === section.key ? "location" : undefined}>
            {hasNoteContent(section.html) ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <span className="mx-0.5 h-2.5 w-2.5 shrink-0 rounded-full border border-current" aria-hidden="true" />}
            {section.label}
          </button>)}
        </nav>
        <div className="min-w-0 flex-1">
          {liveSections.some((section) => /<img\b/i.test(section.html)) && <p className="border-b border-border bg-muted/30 px-5 py-2 text-xs text-muted-foreground">Image attachments are retained. Open Sections to view or manage images.</p>}
          <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground sm:px-5">
            <span className="font-medium text-foreground">{activeSection?.label}</span>
            <span className="ml-2">{isMedicationSection ? "One medication per line." : "Alt + ↓ next section · Alt + ↑ previous section"}</span>
          </div>
          <div ref={editorRef} className={cn("note-document", largeText && "note-document-large")} contentEditable suppressContentEditableWarning
            role="textbox" aria-label="Combined clinical note" aria-describedby={helpId} aria-multiline="true" spellCheck
            onInput={publish}
            onPaste={(event) => {
              event.preventDefault();
              if (!selectionIsInSection()) { protectHeadings(); return; }
              selectionRef.current = window.getSelection()!.getRangeAt(0).cloneRange();
              insert(sanitizePastedHtml(event.clipboardData.getData("text/html"), event.clipboardData.getData("text/plain")));
            }}
            onCut={(event) => { if (!selectionIsInSection()) { event.preventDefault(); protectHeadings(); } }}
            onDrop={(event) => { event.preventDefault(); setMessage("Paste text into a section, or use Sections to attach an image."); }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && !event.altKey && ["z", "y"].includes(event.key.toLowerCase())) {
                event.preventDefault();
                historyAction.current(event.key.toLowerCase() === "y" || event.shiftKey ? "redo" : "undo");
                return;
              }
              if (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault();
                const index = liveSections.findIndex((section) => section.key === activeKey);
                jump(liveSections[(index + (event.key === "ArrowDown" ? 1 : -1) + liveSections.length) % liveSections.length].key);
              }
            }} />
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <span>{wordCount} words · {filled.length}/{liveSections.length} sections with text</span>
        <span>Text coverage only · review before handoff</span>
      </div>
      <p role="status" aria-live="polite" className={cn("text-sm text-foreground", message ? "border-t border-border bg-muted/30 px-4 py-3" : "sr-only")}>{message}</p>
    </section>
  );
}
