import { AlignLeft, PanelsTopLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NoteEditorMode } from "@/hooks/useNoteEditorMode";

export function NoteEditorModeControl({ mode, onChange }: {
  mode: NoteEditorMode;
  onChange: (mode: NoteEditorMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Write your way</p>
        <p className="text-xs text-muted-foreground">Same note. Your preferred view.</p>
      </div>
      <div className="inline-flex rounded-lg bg-background p-1 shadow-sm" role="group" aria-label="Note editor view">
        {([
          ["sections", "Sections", PanelsTopLeft],
          ["continuous", "One page", AlignLeft],
        ] as const).map(([value, label, Icon]) => (
          <Button key={value} type="button" variant={mode === value ? "secondary" : "ghost"}
            className="min-h-11 gap-2 rounded-md px-3 text-sm" aria-pressed={mode === value}
            onClick={() => onChange(value)}>
            <Icon className="h-4 w-4" aria-hidden="true" />{label}
          </Button>
        ))}
      </div>
    </div>
  );
}
