import * as React from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bot, Key, Eye, EyeOff, Info } from "lucide-react";
import { useSettings, type AIProviderKey } from "@/contexts/SettingsContext";
import { AVAILABLE_MODELS } from "@/services/llm/config";

const PROVIDERS = [
  { value: "" as AIProviderKey, label: "Default (env config)" },
  { value: "openai" as AIProviderKey, label: "OpenAI" },
  { value: "anthropic" as AIProviderKey, label: "Anthropic" },
  { value: "gemini" as AIProviderKey, label: "Google Gemini" },
  { value: "grok" as AIProviderKey, label: "Grok (xAI)" },
  { value: "glm" as AIProviderKey, label: "GLM (Zhipu)" },
  { value: "huggingface" as AIProviderKey, label: "HuggingFace" },
];

const CATEGORY_LABELS: Record<string, string> = {
  premium: "Premium",
  standard: "Standard",
  economy: "Economy",
  local: "Local/Open",
};

export function AISettingsPanel() {
  const {
    aiProvider,
    setAIProvider,
    aiModel,
    setAIModel,
    aiApiKeys,
    setAIApiKey,
  } = useSettings();

  const [showApiKey, setShowApiKey] = React.useState(false);

  // Filter models by selected provider
  const availableModels = React.useMemo(() => {
    if (!aiProvider) return [];
    return AVAILABLE_MODELS.filter((m) => m.provider === aiProvider);
  }, [aiProvider]);

  // Group models by category
  const groupedModels = React.useMemo(() => {
    const groups: Record<string, typeof availableModels> = {};
    for (const model of availableModels) {
      if (!groups[model.category]) groups[model.category] = [];
      groups[model.category].push(model);
    }
    return groups;
  }, [availableModels]);

  const handleProviderChange = (value: string) => {
    const provider = (value === "default" ? "" : value) as AIProviderKey;
    setAIProvider(provider);
    // Reset model when switching providers
    if (provider) {
      const firstModel = AVAILABLE_MODELS.find((m) => m.provider === provider);
      setAIModel(firstModel?.model || "");
    } else {
      setAIModel("");
    }
  };

  const currentApiKey = aiProvider ? aiApiKeys[aiProvider] || "" : "";

  return (
    <Card className="p-4 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Bot className="h-4 w-4" />
        AI Model
      </h3>

      <p className="text-xs text-muted-foreground">
        Choose an AI provider and model for clinical AI features. Leave as
        &ldquo;Default&rdquo; to use the server-configured model.
      </p>

      {/* Provider Selection */}
      <div className="space-y-2">
        <Label htmlFor="ai-provider" className="text-xs">
          Provider
        </Label>
        <Select value={aiProvider || "default"} onValueChange={handleProviderChange}>
          <SelectTrigger id="ai-provider" className="h-9">
            <SelectValue placeholder="Select provider..." />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value || "default"}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model Selection (only when a provider is selected) */}
      {aiProvider && (
        <div className="space-y-2">
          <Label htmlFor="ai-model" className="text-xs">
            Model
          </Label>
          <Select value={aiModel} onValueChange={setAIModel}>
            <SelectTrigger id="ai-model" className="h-9">
              <SelectValue placeholder="Select model..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(groupedModels).map(([category, models]) => (
                <React.Fragment key={category}>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {CATEGORY_LABELS[category] || category}
                  </div>
                  {models.map((m) => (
                    <SelectItem key={m.model} value={m.model}>
                      <div className="flex items-center gap-2">
                        <span>{m.label}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4"
                        >
                          {m.category}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </React.Fragment>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* API Key Input (only when a non-default provider is selected) */}
      {aiProvider && (
        <div className="space-y-2">
          <Label htmlFor="ai-api-key" className="text-xs flex items-center gap-1">
            <Key className="h-3 w-3" />
            API Key
          </Label>
          <div className="relative">
            <Input
              id="ai-api-key"
              type={showApiKey ? "text" : "password"}
              placeholder={`Enter ${PROVIDERS.find((p) => p.value === aiProvider)?.label || ""} API key...`}
              value={currentApiKey}
              onChange={(e) => setAIApiKey(aiProvider as Exclude<AIProviderKey, ''>, e.target.value)}
              className="h-9 pr-10 font-mono text-xs"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showApiKey ? "Hide API key" : "Show API key"}
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="flex items-start gap-1.5 p-2 bg-muted/50 rounded-md">
            <Info className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Your API key is stored locally in your browser and never sent to
              our servers. It is used only for direct API calls to the selected
              provider.
            </p>
          </div>
        </div>
      )}

      {/* Current config summary */}
      {!aiProvider && (
        <div className="flex items-start gap-1.5 p-2 bg-muted/50 rounded-md">
          <Info className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Using the default server-side AI configuration. Select a provider
            above to use your own API key and choose a specific model.
          </p>
        </div>
      )}
    </Card>
  );
}
