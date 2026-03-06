import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export interface PatientAIPanelProps {
  visible: boolean;
  isStreaming: boolean;
  aiMode: string | null;
  output: string | null;
  error: string | null;
  onCancel: () => void;
  onReset: () => void;
  onCopy: () => void;
  onInsert: () => void;
  onCopyFailed: () => void;
}

/**
 * PatientAIPanel - AI output display panel for PatientCard
 * 
 * Displays streaming AI output with controls to:
 * - Stop generation
 * - Reset the panel
 * - Copy output to clipboard
 * - Insert into clinical summary
 */
export const PatientAIPanel = React.memo(function PatientAIPanel({
  visible,
  isStreaming,
  aiMode,
  output,
  error,
  onCancel,
  onReset,
  onCopy,
  onInsert,
  onCopyFailed,
}: PatientAIPanelProps) {
  const handleCopy = React.useCallback(() => {
    if (!output?.trim()) return;
    navigator.clipboard.writeText(output).catch(() => {
      onCopyFailed();
    });
  }, [output, onCopyFailed]);

  if (!visible && !isStreaming && !output && !error) {
    return null;
  }

  return (
    <div className="mx-5 mt-3 mb-1 rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 no-print">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className={`h-4 w-4 ${isStreaming ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isStreaming ? 'Generating…' : aiMode ? `AI ${aiMode}` : 'AI Output'}</span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={!isStreaming}
          >
            Stop
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={isStreaming}
          >
            Reset
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="rounded-lg border bg-background px-3 py-2 text-sm whitespace-pre-wrap break-words min-h-[52px]">
        {output?.trim() || (isStreaming ? 'Streaming response…' : 'No output yet.')}
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="text-xs text-muted-foreground">AI generated text.</div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!output?.trim()}
          >
            Copy
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onInsert}
            disabled={!output?.trim()}
          >
            Insert into summary
          </Button>
        </div>
      </div>
    </div>
  );
});
