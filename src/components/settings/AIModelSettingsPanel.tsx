import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AVAILABLE_MODELS, getLLMRouter, type LLMProviderName, type ModelOption } from '@/services/llm';
import { useSettings } from '@/contexts/SettingsContext';
import { DEFAULT_CONFIG, AI_FEATURE_CATEGORIES, GATEWAY_MODELS } from '@/constants/config';
import { Brain, Zap, Clock, Sparkles, ShieldCheck, Search, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

const PROVIDER_LABELS: Record<LLMProviderName, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google',
  grok: 'Grok',
  glm: 'GLM',
  huggingface: 'Hugging Face',
};

const CATEGORY_METADATA: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; description: string }> = {
  premium: {
    label: 'Max Capability',
    icon: Sparkles,
    color: 'text-purple-500 bg-purple-500/10',
    description: 'Best for complex reasoning & deep analysis'
  },
  standard: {
    label: 'Balanced',
    icon: Brain,
    color: 'text-blue-500 bg-blue-500/10',
    description: 'Great mix of speed and intelligence'
  },
  economy: {
    label: 'Fast',
    icon: Zap,
    color: 'text-yellow-500 bg-yellow-500/10',
    description: 'Near-instant responses for simple tasks'
  },
  local: {
    label: 'Private/Local',
    icon: ShieldCheck,
    color: 'text-green-500 bg-green-500/10',
    description: 'Runs locally or on private infrastructure'
  },
};

const providerOrder: LLMProviderName[] = ['openai', 'anthropic', 'gemini', 'grok', 'glm', 'huggingface'];

export function AIModelSettingsPanel() {
  const {
    aiProvider,
    aiModel,
    aiCredentials,
    aiFeatureModels,
    setAiModel,
    resetAiModel,
    setAiCredential,
    setAiFeatureModel,
    nexusMode,
    setNexusMode,
  } = useSettings();

  const [search, setSearch] = React.useState('');
  const [availableProviders, setAvailableProviders] = React.useState<LLMProviderName[]>([]);
  const [viewMode, setViewMode] = React.useState<'category' | 'provider'>('category');

  React.useEffect(() => {
    const router = getLLMRouter();
    setAvailableProviders(router.listProviders());
  }, [aiCredentials]);

  const filteredModels = React.useMemo(() => {
    if (!search.trim()) return AVAILABLE_MODELS;
    const query = search.toLowerCase();
    return AVAILABLE_MODELS.filter((model) =>
      model.label.toLowerCase().includes(query) ||
      model.model.toLowerCase().includes(query) ||
      model.description?.toLowerCase().includes(query)
    );
  }, [search]);

  const groupedModels = React.useMemo(() => {
    return filteredModels.reduce<Record<string, ModelOption[]>>((acc, model) => {
      const key = viewMode === 'category' ? model.category : model.provider;
      if (!acc[key]) acc[key] = [];
      acc[key].push(model);
      return acc;
    }, {} as Record<string, ModelOption[]>);
  }, [filteredModels, viewMode]);

  const handleModelChange = (value: string) => {
    if (value === 'default') {
      resetAiModel();
      return;
    }

    const [provider, model] = value.split(':');
    if (provider && model) {
      setAiModel(provider as LLMProviderName, model);
    }
  };

  const selectedValue =
    aiProvider === DEFAULT_CONFIG.DEFAULT_AI_PROVIDER && aiModel === DEFAULT_CONFIG.DEFAULT_AI_MODEL
      ? 'default'
      : `${aiProvider}:${aiModel}`;

  const renderModelCard = (model: ModelOption) => {
    const value = `${model.provider}:${model.model}`;
    const isSelected = selectedValue === value;
    const isConnected = availableProviders.includes(model.provider);
    const meta = CATEGORY_METADATA[model.category];
    const Icon = meta.icon;

    return (
      <label
        key={value}
        className={cn(
          "relative flex flex-col gap-2 rounded-xl border-2 p-4 transition-all hover:bg-muted/50 cursor-pointer",
          isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border shadow-sm",
          !isConnected && "opacity-80 grayscale-[0.5]"
        )}
      >
        <RadioGroupItem value={value} className="sr-only" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", meta.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold flex items-center gap-2">
                {model.label}
                {!isConnected && (
                  <Badge variant="outline" className="h-4 text-[10px] px-1 bg-background">
                    Not Connected
                  </Badge>
                )}
              </div>
              <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-tight">
                {PROVIDER_LABELS[model.provider]} • {model.model}
              </div>
            </div>
          </div>
          {isSelected && (
            <Badge className="bg-primary text-primary-foreground text-[10px] h-4">Default</Badge>
          )}
        </div>

        {model.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 px-1 border-l-2 border-muted pl-3">
            {model.description}
          </p>
        )}

        {model.bestFor && (
          <div className="mt-1 flex items-center gap-1.5 px-1 py-0.5 rounded-md bg-muted/40 text-[10px] text-muted-foreground w-fit">
            <Info className="h-3 w-3" />
            <span>Best for: {model.bestFor}</span>
          </div>
        )}
      </label>
    );
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl">AI Model Gateway</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Select your default intelligence engine or customize per-feature.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted p-1 rounded-lg">
              <Button
                variant={viewMode === 'category' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-3 rounded-md"
                onClick={() => setViewMode('category')}
              >
                Intelligence
              </Button>
              <Button
                variant={viewMode === 'provider' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-3 rounded-md"
                onClick={() => setViewMode('provider')}
              >
                Provider
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0 space-y-6">
        <div className="flex items-center gap-3 bg-muted/30 p-2 rounded-xl border border-border/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by name, description, or provider..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-background border-none shadow-none ring-0 placeholder:text-muted-foreground/60"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetAiModel}
            className="text-xs text-muted-foreground hover:text-foreground hover:bg-background h-10 px-4 rounded-lg"
          >
            Reset Default
          </Button>
        </div>

        <ScrollArea className="h-[500px] pr-4">
          <RadioGroup value={selectedValue} onValueChange={handleModelChange} className="space-y-8">
            {/* System Default Option */}
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Preferred Configuration</Label>
              <label className={cn(
                "relative flex items-center justify-between gap-4 rounded-xl border-2 p-4 transition-all hover:bg-muted/50 cursor-pointer",
                selectedValue === 'default' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-dashed border-border"
              )}>
                <RadioGroupItem value="default" className="sr-only" />
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <span className="font-semibold block">System Managed Default</span>
                    <span className="text-xs text-muted-foreground">
                      Currently routed to {DEFAULT_CONFIG.DEFAULT_AI_PROVIDER} / {DEFAULT_CONFIG.DEFAULT_AI_MODEL}
                    </span>
                  </div>
                </div>
                {selectedValue === 'default' && <Badge>Active</Badge>}
              </label>
            </div>

            {/* Grouped Models */}
            {(viewMode === 'category' ? ['premium', 'standard', 'economy', 'local'] : providerOrder).map((groupKey: string) => {
              const models = groupedModels[groupKey];
              if (!models || models.length === 0) return null;

              const meta = viewMode === 'category' ? CATEGORY_METADATA[groupKey] : null;
              const label = viewMode === 'category' ? meta?.label : PROVIDER_LABELS[groupKey as LLMProviderName];

              return (
                <div key={groupKey} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">{label}</div>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>
                  {viewMode === 'category' && meta && (
                    <p className="text-[11px] text-muted-foreground -mt-3 mb-1">{meta.description}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {models.map(renderModelCard)}
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        </ScrollArea>

        <div className="pt-2">
          <div className={cn(
            "relative overflow-hidden rounded-2xl border transition-all duration-300",
            nexusMode
              ? "border-primary/40 bg-gradient-to-br from-primary/10 via-purple-500/5 to-background shadow-lg shadow-primary/10"
              : "border-border bg-muted/30"
          )}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center transition-transform duration-500",
                  nexusMode ? "bg-primary text-primary-foreground scale-110 rotate-3 shadow-xl" : "bg-muted text-muted-foreground"
                )}>
                  <Sparkles className={cn("h-6 w-6", nexusMode && "animate-pulse")} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Label htmlFor="nexus-mode" className="text-lg font-bold tracking-tight">
                      NEXUS-Full Orchestration
                    </Label>
                    {nexusMode && (
                      <Badge variant="outline" className="animate-in fade-in zoom-in duration-500 bg-primary/20 text-primary border-primary/30 text-[10px] font-bold uppercase tracking-widest px-2 py-0">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                    Activate the 5-phase clinical orchestration pipeline:
                    <span className="font-semibold text-foreground/80"> Normalization, Extraction, Execution, Utilization, Synthesis.</span>
                    Uses multi-agent consensus for critical medical decisions.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 self-end md:self-center">
                <div className="flex items-center gap-3 bg-background/50 backdrop-blur-sm px-4 py-2 rounded-full border border-border/50 shadow-inner">
                  <span className={cn("text-xs font-bold transition-colors", nexusMode ? "text-primary" : "text-muted-foreground")}>
                    {nexusMode ? 'MAX INTELLIGENCE' : 'STANDARD MODE'}
                  </span>
                  <Switch
                    id="nexus-mode"
                    checked={nexusMode}
                    onCheckedChange={setNexusMode}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </div>
            </div>

            {/* Animated background element for active state */}
            {nexusMode && (
              <div className="absolute -right-8 -bottom-8 h-32 w-32 bg-primary/10 blur-3xl rounded-full" />
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-border/60">
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label className="text-base font-semibold">Per-feature overrides</Label>
              <p className="text-xs text-muted-foreground font-normal">
                Optimize routing based on task complexity
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {AI_FEATURE_CATEGORIES.map((cat) => (
              <div key={cat.key} className="flex flex-col gap-1.5 pb-3 border-b border-border/30 last:border-0 md:border-0">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`feat-${cat.key}`} className="text-xs font-medium">
                    {cat.label}
                  </Label>
                  <span className="text-[10px] text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded leading-none">
                    {cat.description.split(',')[0]}
                  </span>
                </div>
                <Select
                  value={aiFeatureModels[cat.key] || '__default__'}
                  onValueChange={(v) => setAiFeatureModel(cat.key, v === '__default__' ? '' : v)}
                >
                  <SelectTrigger id={`feat-${cat.key}`} className="h-8 text-xs bg-muted/30 border-none shadow-none hover:bg-muted/50 transition-colors">
                    <SelectValue placeholder="Use default" />
                  </SelectTrigger>
                  <SelectContent>
                    {GATEWAY_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-border/60">
          <Label className="text-base font-semibold block mb-1">Provider Credentials</Label>
          <p className="text-xs text-muted-foreground mb-4">
            API keys are encrypted and stored in your account.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providerOrder.map((provider: LLMProviderName) => (
              <div key={provider} className="bg-muted/30 p-3 rounded-xl border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor={`cred-${provider}`} className="text-xs font-semibold">
                    {PROVIDER_LABELS[provider]}
                  </Label>
                  <Badge variant={availableProviders.includes(provider) ? 'default' : 'secondary'} className="h-4 text-[9px] px-1.5 py-0">
                    {availableProviders.includes(provider) ? 'Active' : 'Missing Key'}
                  </Badge>
                </div>
                <div className="relative group">
                  <Input
                    id={`cred-${provider}`}
                    type="password"
                    placeholder="sk-..."
                    value={aiCredentials[provider] || ''}
                    onChange={(e) => setAiCredential(provider, e.target.value.trim())}
                    className="h-8 text-xs bg-background border-border/50 group-hover:border-primary/50 transition-colors pl-8"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
