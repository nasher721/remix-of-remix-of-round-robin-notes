import * as React from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Sparkles, Stethoscope, FileText, ListChecks, ClipboardCheck, Brain, Calendar, Activity, Pill, Mic, Wand2, Settings, Lightbulb } from 'lucide-react';
import { useStreamingAI } from '@/hooks/useStreamingAI';
import { useToast } from '@/hooks/use-toast';
import type { AIFeature, ClinicalContext } from '@/lib/openai-config';
import type { Patient } from '@/types/patient';

interface AICommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient;
  onInsertToField?: (field: string, content: string) => void;
}

// Define AI commands with their metadata
interface AICommand {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  feature: AIFeature;
  requiresTextInput?: boolean;
  placeholder?: string;
}

const AI_COMMANDS: AICommand[] = [
  // Clinical Assistant Commands
  {
    id: 'differential-diagnosis',
    name: 'Differential Diagnosis',
    description: 'Generate AI-powered differential diagnoses',
    icon: <Stethoscope className="mr-2 h-4 w-4" />,
    feature: 'differential_diagnosis',
  },
  {
    id: 'documentation-check',
    name: 'Documentation Check',
    description: 'Check documentation completeness',
    icon: <ClipboardCheck className="mr-2 h-4 w-4" />,
    feature: 'documentation_check',
  },
  {
    id: 'soap-format',
    name: 'Format as SOAP',
    description: 'Convert notes to SOAP format',
    icon: <FileText className="mr-2 h-4 w-4" />,
    feature: 'soap_format',
  },
  {
    id: 'assessment-plan',
    name: 'Generate Assessment & Plan',
    description: 'Create assessment and plan from clinical data',
    icon: <ListChecks className="mr-2 h-4 w-4" />,
    feature: 'assessment_plan',
  },
  {
    id: 'clinical-summary',
    name: 'Clinical Summary',
    description: 'Generate a concise clinical summary',
    icon: <Brain className="mr-2 h-4 w-4" />,
    feature: 'clinical_summary',
  },
  
  // Advanced Features
  {
    id: 'system-rounds',
    name: 'System-Based Rounds',
    description: 'Neuro ICU template output',
    icon: <Activity className="mr-2 h-4 w-4" />,
    feature: 'system_based_rounds',
  },
  {
    id: 'date-organizer',
    name: 'Date Organizer',
    description: 'Organize clinical timeline chronologically',
    icon: <Calendar className="mr-2 h-4 w-4" />,
    feature: 'date_organizer',
    requiresTextInput: true,
    placeholder: 'Paste clinical history to organize...',
  },
  {
    id: 'problem-list',
    name: 'Problem List A&P',
    description: 'Fellow-style Neuro ICU A&P',
    icon: <ListChecks className="mr-2 h-4 w-4" />,
    feature: 'problem_list',
  },
  {
    id: 'interval-events',
    name: 'Interval Events Generator',
    description: 'DAY/NIGHT structured summary',
    icon: <Calendar className="mr-2 h-4 w-4" />,
    feature: 'interval_events_generator',
    requiresTextInput: true,
    placeholder: 'Paste prior day + overnight events...',
  },
  {
    id: 'neuro-hpi',
    name: 'Neuro ICU HPI Generator',
    description: '3-paragraph admission/consult HPI',
    icon: <Brain className="mr-2 h-4 w-4" />,
    feature: 'neuro_icu_hpi',
    requiresTextInput: true,
    placeholder: 'Paste consult/admission details...',
  },
  
  // Smart Expand (text transformation)
  {
    id: 'smart-expand',
    name: 'Smart Expand',
    description: 'Expand shorthand to clinical text',
    icon: <Wand2 className="mr-2 h-4 w-4" />,
    feature: 'smart_expand',
    requiresTextInput: true,
    placeholder: 'Enter shorthand text to expand...',
  },
  
  // Transcription
  {
    id: 'transcription',
    name: 'Transcription Enhancement',
    description: 'Correct medical dictation',
    icon: <Mic className="mr-2 h-4 w-4" />,
    feature: 'transcription',
    requiresTextInput: true,
    placeholder: 'Paste transcribed text...',
  },
  
  // Medications
  {
    id: 'format-medications',
    name: 'Format Medications',
    description: 'Parse and categorize medications',
    icon: <Pill className="mr-2 h-4 w-4" />,
    feature: 'medical_correction',
    requiresTextInput: true,
    placeholder: 'Enter medication list...',
  },
  
  // Quick Actions
  {
    id: 'smart-draft',
    name: 'Smart Draft',
    description: 'AI-assisted note drafting',
    icon: <Lightbulb className="mr-2 h-4 w-4" />,
    feature: 'smart_draft',
  },
];

export const AICommandPalette: React.FC<AICommandPaletteProps> = ({
  open,
  onOpenChange,
  patient,
  onInsertToField,
}) => {
  const { toast } = useToast();
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [lastRun, setLastRun] = React.useState<{ command: AICommand; text?: string } | null>(null);
  const {
    streamWithAI,
    isStreaming,
    accumulatedResponse,
    error,
    cancel,
    reset,
  } = useStreamingAI({
    silent: true,
    onError: (msg) => setInlineError(msg),
  });

  const [selectedCommand, setSelectedCommand] = React.useState<AICommand | null>(null);
  const [textInput, setTextInput] = React.useState('');
  const outputRef = React.useRef<HTMLDivElement>(null);

  const hasResponse = Boolean(accumulatedResponse.trim());

  const startStreaming = React.useCallback(async (command: AICommand, inputText?: string) => {
    setInlineError(null);
    reset();
    setSelectedCommand(command.requiresTextInput ? command : null);

    if (!command.requiresTextInput && !patient) {
      setInlineError('Select a patient to run this command.');
      return;
    }

    setLastRun({ command, text: inputText });

    try {
      await streamWithAI(command.feature, {
        text: inputText,
        patient,
      });
    } catch (err) {
      console.error('AI command failed:', err);
    }
  }, [patient, streamWithAI, reset]);

  const handleCommandSelect = React.useCallback(async (command: AICommand) => {
    // If command requires text input, store it for later
    if (command.requiresTextInput) {
      setSelectedCommand(command);
      return;
    }

    await startStreaming(command);
  }, [startStreaming]);

  const handleTextSubmit = React.useCallback(async () => {
    if (!selectedCommand) return;
    if (!textInput.trim()) {
      setInlineError('Enter text to process.');
      return;
    }

    await startStreaming(selectedCommand, textInput);
  }, [selectedCommand, textInput, startStreaming]);

  const handleRetry = React.useCallback(() => {
    if (!lastRun) return;
    startStreaming(lastRun.command, lastRun.text);
  }, [lastRun, startStreaming]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedCommand(null);
      setTextInput('');
      setInlineError(null);
      reset();
    }
    onOpenChange(isOpen);
  };

  React.useEffect(() => {
    if (!outputRef.current) return;
    void accumulatedResponse;
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [accumulatedResponse]);

  return (
    <>
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <CommandInput 
          placeholder={selectedCommand?.placeholder || "Type an AI command or search..."} 
          disabled={isStreaming}
        />
        <CommandList>
          <CommandEmpty>
            {isStreaming ? (
              <div className="flex items-center justify-center py-4">
                <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                <span>Generating...</span>
              </div>
            ) : (
              'No AI commands found.'
            )}
          </CommandEmpty>

          {selectedCommand ? (
            // Text input mode for commands that require input
            <CommandGroup heading={selectedCommand.name}>
              <div className="p-2">
                <textarea
                  className="w-full min-h-[100px] p-2 text-sm border rounded-md bg-background resize-none"
                  placeholder={selectedCommand.placeholder}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.metaKey) {
                      handleTextSubmit();
                    }
                  }}
                />
                <div className="flex justify-between mt-2 items-center">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedCommand(null)}
                    disabled={isStreaming}
                  >
                    ← Back to commands
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setTextInput('');
                        reset();
                        setInlineError(null);
                      }}
                      disabled={isStreaming}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded-md"
                      onClick={handleTextSubmit}
                      disabled={!textInput.trim() || isStreaming}
                    >
                      {isStreaming ? 'Processing...' : 'Generate ⌘↵'}
                    </button>
                  </div>
                </div>
              </div>
            </CommandGroup>
          ) : (
            // Normal command mode
            <>
              <CommandGroup heading="Clinical Assistant">
                {AI_COMMANDS.slice(0, 5).map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={() => handleCommandSelect(cmd)}
                    disabled={isStreaming}
                  >
                    {cmd.icon}
                    <div className="flex flex-col">
                      <span>{cmd.name}</span>
                      <span className="text-xs text-muted-foreground">{cmd.description}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Advanced Features">
                {AI_COMMANDS.slice(5, 11).map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={() => handleCommandSelect(cmd)}
                    disabled={isStreaming}
                  >
                    {cmd.icon}
                    <div className="flex flex-col">
                      <span>{cmd.name}</span>
                      <span className="text-xs text-muted-foreground">{cmd.description}</span>
                    </div>
                    {cmd.requiresTextInput && (
                      <CommandShortcut>Input</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Text & Transcription">
                {AI_COMMANDS.slice(11).map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={() => handleCommandSelect(cmd)}
                    disabled={isStreaming}
                  >
                    {cmd.icon}
                    <div className="flex flex-col">
                      <span>{cmd.name}</span>
                      <span className="text-xs text-muted-foreground">{cmd.description}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Quick Actions">
                <CommandItem
                  onSelect={() => {
                    // Could open settings
                    toast({
                      title: 'AI Settings',
                      description: 'Configure AI models in Settings → AI',
                    });
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>AI Settings</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>

        {(inlineError || error || isStreaming || hasResponse) && (
          <div className="border-t bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className={`h-4 w-4 ${isStreaming ? 'animate-spin' : ''}`} />
                <span>{isStreaming ? 'Generating...' : hasResponse ? 'Response ready' : 'AI status'}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs rounded-md border px-3 py-1"
                  onClick={cancel}
                  disabled={!isStreaming}
                >
                  Stop
                </button>
                <button
                  type="button"
                  className="text-xs rounded-md border px-3 py-1"
                  onClick={() => {
                    reset();
                    setInlineError(null);
                  }}
                  disabled={isStreaming && !hasResponse}
                >
                  Reset
                </button>
              </div>
            </div>

            {(inlineError || error) && (
              <p className="text-sm text-destructive">{inlineError || error}</p>
            )}

            <div className="rounded-md border bg-background p-3 h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-sm">
              <div ref={outputRef}>
                {accumulatedResponse || (isStreaming ? 'Streaming response…' : 'No response yet.')}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {selectedCommand ? selectedCommand.name : 'Select a command to begin.'}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs rounded-md border px-3 py-1"
                  onClick={handleRetry}
                  disabled={!lastRun || isStreaming}
                >
                  Retry
                </button>
                <button
                  type="button"
                  className="text-xs rounded-md border px-3 py-1"
                  onClick={() => {
                    if (!hasResponse) return;
                    navigator.clipboard.writeText(accumulatedResponse).catch(() => {
                      toast({
                        title: 'Copy failed',
                        description: 'Could not copy to clipboard',
                        variant: 'destructive',
                      });
                    });
                  }}
                  disabled={!hasResponse}
                >
                  Copy
                </button>
                {onInsertToField && (
                  <button
                    type="button"
                    className="text-xs rounded-md border px-3 py-1 bg-primary text-primary-foreground"
                    onClick={() => onInsertToField('clinicalSummary', accumulatedResponse)}
                    disabled={!hasResponse}
                  >
                    Insert into note
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </CommandDialog>

      {/* Floating indicator when AI is processing */}
      {isStreaming && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-3 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
          <Sparkles className="h-4 w-4 animate-spin" />
          <span className="text-sm">AI Processing...</span>
        </div>
      )}
    </>
  );
};

// Hook to manage AI Command Palette state
export const useAICommandPalette = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Cmd+Shift+A to open AI command palette
      if (e.key === 'a' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return { isOpen, setIsOpen };
};
