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
import { Sparkles, Stethoscope, FileText, ListChecks, ClipboardCheck, Brain, Calendar, Activity, Pill, Mic, Wand2, Settings, Lightbulb, Info, Zap, ArrowRight } from 'lucide-react';
import { useStreamingAI } from '@/hooks/useStreamingAI';
import { useToast } from '@/hooks/use-toast';
import { AITransparencyPanel } from '@/components/ai/AITransparencyPanel';
import type { AIFeature, ClinicalContext } from '@/lib/openai-config';
import type { Patient } from '@/types/patient';
import { Button } from '@/components/ui/button';

// Example prompts for the "Try these" section
const EXAMPLE_PROMPTS = [
  { id: 'soap-note', label: "Draft today's SOAP note", icon: FileText },
  { id: 'interval-events', label: 'Summarize interval events', icon: Calendar },
  { id: 'format-meds', label: 'Format medications list', icon: Pill },
];

// Contextual suggestions when patient is selected
const getContextualSuggestions = (patient?: Patient): string[] => {
  if (!patient) return [];
  const suggestions: string[] = [];
  
  if (patient.name) {
    suggestions.push(`Draft note for ${patient.name}`);
    suggestions.push(`Summarize ${patient.name}'s overnight events`);
  }
  if (patient.systems?.neuro) {
    suggestions.push('Generate neuro exam');
  }
  if (patient.medications) {
    const hasMeds = 
      (patient.medications.infusions?.length ?? 0) > 0 ||
      (patient.medications.scheduled?.length ?? 0) > 0 ||
      (patient.medications.prn?.length ?? 0) > 0;
    if (hasMeds) {
      suggestions.push('Format medication list');
    }
  }
  
  return suggestions.slice(0, 3);
};

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
  const { streamWithAI, isStreaming, accumulatedResponse } = useStreamingAI({
    onComplete: (response) => {
      toast({
        title: 'AI Complete',
        description: 'Response generated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'AI Error',
        description: error,
        variant: 'destructive',
      });
    },
  });

  const [selectedCommand, setSelectedCommand] = React.useState<AICommand | null>(null);
  const [textInput, setTextInput] = React.useState('');
  const [transparencyOpen, setTransparencyOpen] = React.useState(false);
  const [selectedExample, setSelectedExample] = React.useState<string | null>(null);

  const contextualSuggestions = getContextualSuggestions(patient);

  const handleExampleClick = (exampleId: string) => {
    setSelectedExample(exampleId);
    const exampleMap: Record<string, string> = {
      'soap-note': "Draft today's SOAP note",
      'interval-events': 'Summarize interval events',
      'format-meds': 'Format medications list',
    };
    setTextInput(exampleMap[exampleId] || '');
  };

  const handleQuickAction = async (action: string) => {
    if (!patient) {
      toast({
        title: 'No Patient Selected',
        description: 'Please select a patient to use AI features',
        variant: 'destructive',
      });
      return;
    }

    const featureMap: Record<string, AIFeature> = {
      'soap': 'soap_format',
      'summarize': 'interval_events_generator',
      'format-meds': 'medical_correction',
    };

    try {
      const result = await streamWithAI(featureMap[action] || 'clinical_summary', {
        patient,
      });
      
      if (result && onInsertToField) {
        onInsertToField('clinicalSummary', result);
      }
    } catch (error) {
      console.error('Quick action failed:', error);
    }
    
    onOpenChange(false);
  };

  const handleCommandSelect = React.useCallback(async (command: AICommand) => {
    // If command requires text input, store it for later
    if (command.requiresTextInput) {
      setSelectedCommand(command);
      return;
    }

    // Execute command with patient context
    if (patient) {
      try {
        const result = await streamWithAI(command.feature, {
          patient,
        });
        
        if (result && onInsertToField) {
          // For now, show result in toast - could be enhanced to insert directly
          onInsertToField('clinicalSummary', result);
        }
      } catch (error) {
        console.error('AI command failed:', error);
      }
    } else {
      toast({
        title: 'No Patient Selected',
        description: 'Please select a patient to use AI features',
        variant: 'destructive',
      });
    }
    
    onOpenChange(false);
  }, [patient, streamWithAI, onInsertToField, onOpenChange, toast]);

  const handleTextSubmit = React.useCallback(async () => {
    if (!selectedCommand || !textInput.trim()) return;

    try {
      const result = await streamWithAI(selectedCommand.feature, {
        text: textInput,
        patient,
      });
      
      if (result && onInsertToField) {
        onInsertToField('clinicalSummary', result);
      }
    } catch (error) {
      console.error('AI command with text failed:', error);
    }

    setSelectedCommand(null);
    setTextInput('');
    onOpenChange(false);
  }, [selectedCommand, textInput, patient, streamWithAI, onInsertToField, onOpenChange]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedCommand(null);
      setTextInput('');
    }
    onOpenChange(isOpen);
  };

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

          {/* Example Prompts Section - visible when no command selected */}
          {!selectedCommand && !isStreaming && (
            <CommandGroup heading="Try these prompts">
              <div className="px-2 py-2 flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example.id}
                    type="button"
                    onClick={() => handleExampleClick(example.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-secondary/60 hover:bg-secondary border border-border/40 rounded-full transition-colors"
                  >
                    <example.icon className="h-3 w-3 text-muted-foreground" />
                    <span>{example.label}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground ml-1" />
                  </button>
                ))}
              </div>
            </CommandGroup>
          )}

          {/* Quick Action Buttons - visible when patient is selected */}
          {!selectedCommand && !isStreaming && patient && contextualSuggestions.length > 0 && (
            <CommandGroup heading="Quick Actions">
              <div className="px-2 py-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('soap')}
                  className="text-xs"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  SOAP Note
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('summarize')}
                  className="text-xs"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Summarize
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction('format-meds')}
                  className="text-xs"
                >
                  <Pill className="h-3 w-3 mr-1" />
                  Format Meds
                </Button>
              </div>
            </CommandGroup>
          )}

          {/* Contextual Suggestions - when patient is selected */}
          {!selectedCommand && !isStreaming && contextualSuggestions.length > 0 && (
            <CommandGroup heading="Suggestions for this patient">
              {contextualSuggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion}
                  onSelect={() => {
                    setTextInput(suggestion);
                  }}
                >
                  <Zap className="mr-2 h-4 w-4 text-amber-500" />
                  <span className="text-sm">{suggestion}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

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
                <div className="flex justify-between mt-2">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedCommand(null)}
                  >
                    ← Back to commands
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
                    toast({
                      title: 'AI Settings',
                      description: 'Configure AI models in Settings → AI',
                    });
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>AI Settings</span>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    setTransparencyOpen(true);
                  }}
                >
                  <Info className="mr-2 h-4 w-4" />
                  <span>AI Transparency</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>

      {/* Floating indicator when AI is processing */}
      {isStreaming && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-3 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
          <Sparkles className="h-4 w-4 animate-spin" />
          <span className="text-sm">AI Processing...</span>
        </div>
      )}

      <AITransparencyPanel
        open={transparencyOpen}
        onOpenChange={setTransparencyOpen}
      />
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
