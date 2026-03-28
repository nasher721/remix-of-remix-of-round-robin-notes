import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useSettings } from '@/contexts/SettingsContext';
import {
  Shield,
  Lock,
  Info,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sparkles,
  FileText,
  ListChecks,
  Stethoscope,
} from 'lucide-react';

interface AITransparencyPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXAMPLE_PROMPTS = [
  {
    id: 'summary',
    title: 'Generate Clinical Summary',
    prompt: 'Summarize this patient\'s overnight course and current status',
    icon: FileText,
  },
  {
    id: 'assessment',
    title: 'Create Assessment & Plan',
    prompt: 'Generate an assessment and plan based on the current clinical data',
    icon: ListChecks,
  },
  {
    id: 'ddx',
    title: 'Differential Diagnosis',
    prompt: 'Suggest possible diagnoses based on the current presentation',
    icon: Stethoscope,
  },
];

const AI_CAPABILITIES = [
  { id: 'soap', text: 'Format and structure clinical notes in SOAP format' },
  { id: 'summarize', text: 'Summarize patient information concisely' },
  { id: 'ddx', text: 'Suggest differential diagnoses based on clinical data' },
  { id: 'transform', text: 'Transform rough notes into professional documentation' },
  { id: 'organize', text: 'Organize clinical timelines and events' },
  { id: 'meds', text: 'Parse and categorize medication lists' },
  { id: 'transcribe', text: 'Enhance transcribed dictation with medical terminology' },
  { id: 'plan', text: 'Generate assessment and plan recommendations' },
];

const AI_LIMITATIONS = [
  { id: 'no-dx', text: 'Provide definitive medical diagnoses or treatment decisions' },
  { id: 'no-db', text: 'Access external medical databases or references in real-time' },
  { id: 'no-replace', text: 'Replace clinical judgment or physician expertise' },
  { id: 'no-guarantee', text: 'Guarantee 100% accuracy in medical terminology' },
  { id: 'no-store', text: 'Store or retain patient data between sessions' },
  { id: 'no-internet', text: 'Access the internet for current medical guidelines' },
  { id: 'no-tx', text: 'Make treatment recommendations without physician review' },
];

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'glm-4-flash': 'GLM-4 Flash',
  'glm-4': 'GLM-4',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4-turbo-preview': 'GPT-4 Turbo',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'grok-2': 'Grok 2',
};

const getProviderName = (model: string): string => {
  if (model.includes('glm')) return 'Zhipu AI';
  if (model.includes('gpt')) return 'OpenAI';
  if (model.includes('claude')) return 'Anthropic';
  if (model.includes('gemini')) return 'Google';
  if (model.includes('grok')) return 'xAI';
  return 'AI Provider';
};

export const AITransparencyPanel: React.FC<AITransparencyPanelProps> = ({
  open,
  onOpenChange,
}) => {
  const { getModelForFeature } = useSettings();
  const currentModel = getModelForFeature('clinical_assistant');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <SheetTitle>AI Transparency</SheetTitle>
          </div>
          <SheetDescription>
            Understanding how AI assists your clinical workflow
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Current Model Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Info className="h-4 w-4" />
              Current AI Model
            </h3>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{MODEL_DISPLAY_NAMES[currentModel] || currentModel}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Powered by {currentModel.includes('glm') ? 'Zhipu AI' : 
                                   currentModel.includes('gpt') ? 'OpenAI' : 
                                   currentModel.includes('claude') ? 'Anthropic' :
                                   currentModel.includes('gemini') ? 'Google' : 
                                   currentModel.includes('grok') ? 'xAI' : 'AI Provider'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Model</p>
                  <p className="text-sm font-mono">{currentModel}</p>
                </div>
              </div>
            </div>
          </section>

          {/* PHI & Data Handling Section */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              Data & Privacy
            </h3>
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 border border-green-200 dark:border-green-900">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Lock className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">End-to-End Encryption</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      All data is encrypted in transit using TLS 1.3
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <XCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">No Persistent Storage</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      PHI is never stored on AI provider servers
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">HIPAA Aware</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Designed to support healthcare compliance workflows
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* What AI Can Do */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              What AI Can Do
            </h3>
            <ul className="space-y-2">
              {AI_CAPABILITIES.map((capability) => (
                <li key={capability.id} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>{capability.text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* What AI Cannot Do */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              What AI Cannot Do
            </h3>
            <ul className="space-y-2">
              {AI_LIMITATIONS.map((limitation) => (
                <li key={limitation.id} className="flex items-start gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{limitation.text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Example Prompts */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Try These Prompts
            </h3>
            <div className="space-y-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <div
                  key={example.id}
                  className="bg-muted/30 rounded-lg p-3 border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <example.icon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium">{example.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    "{example.prompt}"
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Usage & Limits */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Info className="h-4 w-4" />
              Usage & Limits
            </h3>
            <div className="bg-muted/30 rounded-lg p-4 border text-sm space-y-2">
              <p>
                <strong>Rate Limits:</strong> AI requests are rate-limited to ensure 
                fair access for all users. Limits vary by subscription tier.
              </p>
              <p>
                <strong>Context Window:</strong> AI responses are optimized for the 
                current patient context. Very long documents may be summarized.
              </p>
              <p>
                <strong>Output Review:</strong> All AI-generated content should be 
                reviewed by a qualified clinician before clinical use.
              </p>
            </div>
          </section>

          {/* Privacy Policy Link */}
          <section className="pt-4 border-t">
            <a
              href="https://roundrobinnotes.app/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline w-full py-2"
            >
              <ExternalLink className="h-4 w-4" />
              View Full Privacy Policy
            </a>
          </section>

          {/* Disclaimer */}
          <section className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200 dark:border-amber-900">
            <p className="text-xs text-amber-800 dark:text-amber-200 text-center">
              <strong>Clinical Disclaimer:</strong> AI-generated suggestions are 
              for reference only and do not constitute medical advice. 
              Always exercise professional clinical judgment.
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const useAITransparencyPanel = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  const open = React.useCallback(() => setIsOpen(true), []);
  const close = React.useCallback(() => setIsOpen(false), []);
  const toggle = React.useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, setIsOpen, open, close, toggle };
};
