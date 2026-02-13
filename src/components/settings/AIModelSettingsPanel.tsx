import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AVAILABLE_MODELS, getLLMRouter, type LLMProviderName, type ModelOption } from '@/services/llm';
import { useSettings } from '@/contexts/SettingsContext';
import { DEFAULT_CONFIG } from '@/constants/config';

const PROVIDER_LABELS: Record<LLMProviderName, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google',
  grok: 'Grok',
  glm: 'GLM',
  huggingface: 'Hugging Face',
};

const providerOrder: LLMProviderName[] = ['openai', 'anthropic', 'gemini', 'grok', 'glm', 'huggingface'];

export function AIModelSettingsPanel() {
  const {
    aiProvider,
    aiModel,
    aiCredentials,
    setAiModel,
    resetAiModel,
    setAiCredential,
  } = useSettings();

  const [search, setSearch] = React.useState('');
  const [availableProviders, setAvailableProviders] = React.useState<LLMProviderName[]>([]);

  React.useEffect(() => {
    const router = getLLMRouter();
    setAvailableProviders(router.listProviders());
  }, [aiCredentials]);

  const filteredModels = React.useMemo(() => {
    if (!search.trim()) return AVAILABLE_MODELS;
    const query = search.toLowerCase();
    return AVAILABLE_MODELS.filter((model) =>
      model.label.toLowerCase().includes(query) || model.model.toLowerCase().includes(query)
    );
  }, [search]);

  const groupedModels = React.useMemo(() => {
    return filteredModels.reduce<Record<LLMProviderName, ModelOption[]>>((acc, model) => {
      if (!acc[model.provider]) acc[model.provider] = [];
      acc[model.provider].push(model);
      return acc;
    }, {} as Record<LLMProviderName, ModelOption[]>);
  }, [filteredModels]);

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

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle>AI Models</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose a model, set your default, and add provider credentials.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search models"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={resetAiModel}>
            Reset default
          </Button>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Select default model</Label>
          <ScrollArea className="max-h-80 rounded-md border">
            <div className="p-3 space-y-3">
              <RadioGroup value={selectedValue} onValueChange={handleModelChange}>
                <label className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm shadow-sm cursor-pointer">
                  <RadioGroupItem value="default" />
                  <div className="flex flex-col">
                    <span className="font-medium">Use system default</span>
                    <span className="text-xs text-muted-foreground">
                      {`${DEFAULT_CONFIG.DEFAULT_AI_PROVIDER} / ${DEFAULT_CONFIG.DEFAULT_AI_MODEL}`}
                    </span>
                  </div>
                </label>

                {providerOrder.map((provider) => {
                  const models = groupedModels[provider];
                  if (!models || models.length === 0) return null;
                  return (
                    <div key={provider} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span>{PROVIDER_LABELS[provider]}</span>
                        <Badge variant={availableProviders.includes(provider) ? 'default' : 'secondary'}>
                          {availableProviders.includes(provider) ? 'Connected' : 'Not connected'}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {models.map((model) => {
                          const value = `${model.provider}:${model.model}`;
                          return (
                            <label
                              key={value}
                              className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm shadow-sm cursor-pointer"
                            >
                              <RadioGroupItem value={value} />
                              <div className="flex flex-col">
                                <span className="font-medium">{model.label}</span>
                                <span className="text-xs text-muted-foreground">{model.model}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Provider credentials</Label>
          <p className="text-xs text-muted-foreground">
            Keys sync securely to your account and are cached locally for routing.
          </p>
          <div className="space-y-3">
            {providerOrder.map((provider) => (
              <div key={provider} className="space-y-1">
                <Label htmlFor={`cred-${provider}`} className="text-xs font-medium">
                  {PROVIDER_LABELS[provider]}
                </Label>
                <Input
                  id={`cred-${provider}`}
                  type="password"
                  placeholder="Enter API key"
                  value={aiCredentials[provider] || ''}
                  onChange={(e) => setAiCredential(provider, e.target.value.trim())}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
