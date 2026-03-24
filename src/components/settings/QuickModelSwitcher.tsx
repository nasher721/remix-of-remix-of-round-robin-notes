import React from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import { AVAILABLE_MODELS, type LLMProviderName } from '@/services/llm';
import { Brain, Zap, Sparkles, ShieldCheck, ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
    premium: Sparkles,
    standard: Brain,
    economy: Zap,
    local: ShieldCheck,
};

const CATEGORY_LABELS: Record<string, string> = {
    premium: 'Max Capability',
    standard: 'Balanced',
    economy: 'Fast',
    local: 'Private/Local',
};

const PROVIDER_LABELS: Record<LLMProviderName, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Google',
    grok: 'Grok',
    glm: 'GLM',
    huggingface: 'Hugging Face',
};

export function QuickModelSwitcher({ className }: { className?: string }) {
    const { aiProvider, aiModel, setAiModel, aiCredentials } = useSettings();

    const currentModel = AVAILABLE_MODELS.find(m => m.provider === aiProvider && m.model === aiModel);
    const Icon = currentModel ? CATEGORY_ICONS[currentModel.category] : Brain;
    const connectedProviders = Object.keys(aiCredentials) as LLMProviderName[];

    const groupedModels = React.useMemo(() => {
        return AVAILABLE_MODELS.reduce<Record<string, typeof AVAILABLE_MODELS>>((acc, model) => {
            if (!acc[model.category]) acc[model.category] = [];
            acc[model.category].push(model);
            return acc;
        }, {});
    }, []);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    title={`AI model for editor tools: ${currentModel?.label || 'Select model'}. Open to switch.`}
                    aria-label={`AI model: ${currentModel?.label || 'Select model'}. Open menu to change model.`}
                    className={cn("h-8 gap-2 px-2 bg-background/50 backdrop-blur-sm border-border/50 hover:bg-muted/80 transition-all", className)}
                >
                    <div className={cn(
                        "p-1 rounded-sm",
                        currentModel?.category === 'premium' ? "text-purple-500 bg-purple-500/10" :
                            currentModel?.category === 'standard' ? "text-blue-500 bg-blue-500/10" :
                                currentModel?.category === 'economy' ? "text-yellow-500 bg-yellow-500/10" :
                                    "text-green-500 bg-green-500/10"
                    )}>
                        <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-medium truncate max-w-[120px]">
                        {currentModel?.label || 'Select Model'}
                    </span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[240px] p-1 shadow-2xl border-border/40 backdrop-blur-md">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                    Intelligence Engines
                </DropdownMenuLabel>

                {['premium', 'standard', 'economy', 'local'].map((cat) => {
                    const models = groupedModels[cat];
                    if (!models || models.length === 0) return null;

                    return (
                        <DropdownMenuGroup key={cat}>
                            <DropdownMenuSeparator className="bg-muted/50" />
                            <div className="px-2 py-1 flex items-center gap-1.5">
                                {React.createElement(CATEGORY_ICONS[cat], { className: "h-3 w-3 text-muted-foreground/60" })}
                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">{CATEGORY_LABELS[cat]}</span>
                            </div>
                            {models.map((m) => {
                                const isSelected = aiProvider === m.provider && aiModel === m.model;
                                const isConnected = connectedProviders.includes(m.provider);

                                return (
                                    <DropdownMenuItem
                                        key={`${m.provider}:${m.model}`}
                                        onClick={() => setAiModel(m.provider, m.model)}
                                        className={cn(
                                            "flex flex-col items-start gap-0.5 px-2 py-1.5 cursor-pointer rounded-md transition-colors",
                                            isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                        )}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-xs font-semibold">{m.label}</span>
                                            {!isConnected && (
                                                <span className="text-[8px] px-1 py-0 rounded bg-muted text-muted-foreground">Key Missing</span>
                                            )}
                                        </div>
                                        <span className="text-[9px] text-muted-foreground">
                                            {PROVIDER_LABELS[m.provider]} • {m.model}
                                        </span>
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuGroup>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
