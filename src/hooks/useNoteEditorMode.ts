import { useCallback, useEffect, useState } from "react";
import { safeLocalStorage } from "@/utils/safeStorage";

export type NoteEditorMode = "sections" | "continuous";
const KEY = "rr-note-editor-mode";
const EVENT = "rr:note-editor-mode";
const readMode = (): NoteEditorMode => safeLocalStorage.getItem(KEY) === "continuous" ? "continuous" : "sections";

/** Device preference only; clinical content never goes into preference storage. */
export function useNoteEditorMode() {
  const [mode, setMode] = useState<NoteEditorMode>(readMode);
  useEffect(() => {
    const sync = () => setMode(readMode());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const changeMode = useCallback((next: NoteEditorMode) => {
    safeLocalStorage.setItem(KEY, next);
    setMode(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [mode, changeMode] as const;
}
