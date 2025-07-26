import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "./ui/sheet";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Alert, AlertDescription } from "./ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Separator } from "./ui/separator";
import {
  X,
  Info,
  Download,
  Upload,
  RotateCcw,
  Monitor,
  Sun,
  Moon,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Settings,
  Cpu,
  Palette,
  Zap,
  Terminal,
  Wrench,
} from "lucide-react";
import { useState, useEffect } from "react";
import { ApiKeyValidator, ConfigValidator } from "../utils/validation";
import { ConfigManager, useOpenRouterModels } from "../utils/config";
import { ModelInfo } from "../services/openrouter";
import { ChatSettings } from "../types/settings";
import { useSettings } from "../utils/use-settings";
import { AccessibilitySettings } from "./AccessibilitySettings";
import {
  AccessibilityConfig,
  DEFAULT_ACCESSIBILITY_CONFIG,
} from "../utils/accessibility";

interface SettingsPanelProps {
  settings: ChatSettings;
  onSettingsChange: (settings: ChatSettings) => void;
  onClose: () => void;
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  onClose,
}: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<
    "idle" | "validating" | "valid" | "invalid"
  >("idle");
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("api");
  const [accessibilityConfig, setAccessibilityConfig] =
    useState<AccessibilityConfig>(() => {
      const saved = localStorage.getItem("accessibility-config");
      return saved ? JSON.parse(saved) : DEFAULT_ACCESSIBILITY_CONFIG;
    });

  const { getModels, clearModelCache, isCacheValid } = useOpenRouterModels();
  const {
    exportSettings: exportSettingsHook,
    importSettings: importSettingsHook,
    resetSettings,
  } = useSettings();

  const languages = [
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
    { value: "fr", label: "Français" },
    { value: "de", label: "Deutsch" },
    { value: "it", label: "Italiano" },
    { value: "pt", label: "Português" },
    { value: "ru", label: "Русский" },
    { value: "ja", label: "日本語" },
    { value: "ko", label: "한국어" },
    { value: "zh", label: "中文" },
  ];

  // Load API key and models on component mount
  useEffect(() => {
    const storedApiKey = settings.openRouter?.apiKey || "";
    if (storedApiKey) {
      setApiKey(storedApiKey);
      setApiKeyStatus("valid");
      loadModels();
    }
  }, [settings.openRouter?.apiKey]);

  const loadModels = async (forceRefresh = false) => {
    if (!settings.openRouter?.apiKey) {
      setModels([]);
      return;
    }

    setModelsLoading(true);
    setModelsError(null);

    try {
      const fetchedModels = await getModels(forceRefresh);
      setModels(fetchedModels);
    } catch (error) {
      setModelsError(
        error instanceof Error ? error.message : "Failed to load models",
      );
      // Set default models as fallback
      setModels([
        {
          id: "openai/gpt-4",
          name: "GPT-4",
          description: "Most capable model",
          contextLength: 8192,
          pricing: { prompt: 0.03, completion: 0.06 },
          capabilities: ["chat"],
          provider: "openai",
        },
        {
          id: "openai/gpt-3.5-turbo",
          name: "GPT-3.5 Turbo",
          description: "Fast and efficient",
          contextLength: 4096,
          pricing: { prompt: 0.001, completion: 0.002 },
          capabilities: ["chat"],
          provider: "openai",
        },
      ]);
    } finally {
      setModelsLoading(false);
    }
  };

  const updateSetting = <K extends keyof ChatSettings>(
    key: K,
    value: ChatSettings[K],
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const updateNestedSetting = (
    parentKey: keyof ChatSettings,
    childKey: string,
    value: unknown,
  ) => {
    const parent = settings[parentKey] as unknown;
    onSettingsChange({
      ...settings,
      [parentKey]: {
        ...parent,
        [childKey]: value,
      },
    });
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setApiKeyError(null);

    if (!value.trim()) {
      setApiKeyStatus("idle");
      return;
    }

    // Validate format first
    const formatError = ApiKeyValidator.getValidationError(value);
    if (formatError) {
      setApiKeyStatus("invalid");
      setApiKeyError(formatError);
      return;
    }

    setApiKeyStatus("validating");

    // Simulate API validation (in real app, this would make an actual API call)
    setTimeout(() => {
      setApiKeyStatus("valid");
    }, 1000);
  };

  const saveApiKey = () => {
    if (apiKeyStatus === "valid" && apiKey.trim()) {
      try {
        updateNestedSetting("openRouter", "apiKey", apiKey.trim());
        // Load models after saving API key
        loadModels(true);
      } catch (error) {
        setApiKeyError(
          error instanceof Error ? error.message : "Failed to save API key",
        );
        setApiKeyStatus("invalid");
      }
    }
  };

  const removeApiKey = () => {
    updateNestedSetting("openRouter", "apiKey", "");
    setApiKey("");
    setApiKeyStatus("idle");
    setApiKeyError(null);
  };

  const testApiKey = async () => {
    if (!apiKey.trim()) return;

    setApiKeyStatus("validating");
    try {
      // Test the API key by attempting to fetch models
      const testConfig = { ...settings.openRouter, apiKey: apiKey.trim() };
      const validation = ConfigValidator.validateOpenRouterConfig(testConfig);

      if (validation.isValid) {
        setApiKeyStatus("valid");
        setApiKeyError(null);
      } else {
        setApiKeyStatus("invalid");
        setApiKeyError(validation.errors.join(", "));
      }
    } catch (error) {
      setApiKeyStatus("invalid");
      setApiKeyError(
        error instanceof Error ? error.message : "Failed to validate API key",
      );
    }
  };

  const handleExportSettings = () => {
    exportSettingsHook("Manual export from settings panel");
  };

  const handleImportSettings = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          await importSettingsHook(file);
        } catch (error) {
          console.error("Failed to import settings:", error);
        }
      }
    };
    input.click();
  };

  const handleResetToDefaults = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all settings to defaults? This cannot be undone.",
      )
    ) {
      const newSettings = resetSettings();
      onSettingsChange(newSettings);
    }
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-[500px] overflow-y-auto bg-background border-l border-border/60 shadow-xl"
      >
        <SheetHeader className="border-b border-border/40 pb-4 mb-6">
          <SheetTitle className="text-xl font-semibold text-foreground">
            Settings
          </SheetTitle>
          <SheetClose className="absolute right-4 top-4 rounded-md opacity-70 ring-offset-background transition-all duration-200 hover:opacity-100 hover:bg-accent/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary h-8 w-8 flex items-center justify-center">
            <X className="h-4 w-4" />
          </SheetClose>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API
            </TabsTrigger>
            <TabsTrigger value="model" className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Model
            </TabsTrigger>
            <TabsTrigger value="ui" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Interface
            </TabsTrigger>
            <TabsTrigger
              value="accessibility"
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              Accessibility
            </TabsTrigger>
          </TabsList>

          {/* API Configuration Tab */}
          <TabsContent value="api" className="space-y-6">
            {/* API Key Configuration */}
            <div className="space-y-4 bg-card/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <Key className="h-4 w-4 text-primary" />
                </div>
                <Label className="text-base font-semibold text-foreground">
                  OpenRouter API Key
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors duration-200" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-background border border-border/60">
                      <p>
                        Your OpenRouter API key is required to use AI models.
                        Get one from openrouter.ai
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="sk-or-..."
                    className={`pr-20 ${
                      apiKeyStatus === "valid"
                        ? "border-green-500"
                        : apiKeyStatus === "invalid"
                          ? "border-red-500"
                          : ""
                    }`}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {apiKeyStatus === "validating" && (
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    )}
                    {apiKeyStatus === "valid" && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {apiKeyStatus === "invalid" && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                {apiKeyError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{apiKeyError}</AlertDescription>
                  </Alert>
                )}

                {apiKeyStatus === "valid" && !apiKeyError && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      API key is valid and ready to use
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={saveApiKey}
                    disabled={apiKeyStatus !== "valid" || !apiKey.trim()}
                    className="flex-1"
                  >
                    Save API Key
                  </Button>
                  <Button
                    variant="outline"
                    onClick={testApiKey}
                    disabled={!apiKey.trim() || apiKeyStatus === "validating"}
                  >
                    Test
                  </Button>
                  {settings.openRouter?.apiKey && (
                    <Button variant="outline" onClick={removeApiKey}>
                      Remove
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Your API key is stored securely in your browser and never
                  shared with third parties.
                </p>
              </div>
            </div>

            {/* API Configuration */}
            <div className="space-y-4 bg-card/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-blue-500/10 rounded-md">
                  <Settings className="h-4 w-4 text-blue-500" />
                </div>
                <Label className="text-base font-semibold text-foreground">
                  API Configuration
                </Label>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Base URL</Label>
                  <Input
                    value={settings.openRouter?.baseUrl || ""}
                    onChange={(e) =>
                      updateNestedSetting(
                        "openRouter",
                        "baseUrl",
                        e.target.value,
                      )
                    }
                    placeholder="https://openrouter.ai/api/v1"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={settings.openRouter?.timeout || 30000}
                    onChange={(e) =>
                      updateNestedSetting(
                        "openRouter",
                        "timeout",
                        parseInt(e.target.value),
                      )
                    }
                    min={1000}
                    max={120000}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Retry Attempts</Label>
                  <Input
                    type="number"
                    value={settings.openRouter?.retryAttempts || 3}
                    onChange={(e) =>
                      updateNestedSetting(
                        "openRouter",
                        "retryAttempts",
                        parseInt(e.target.value),
                      )
                    }
                    min={0}
                    max={10}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Model Configuration Tab */}
          <TabsContent value="model" className="space-y-6">
            {/* Model Selection */}
            <div className="space-y-4 bg-card/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-start gap-2">
                  <div className="p-1.5 bg-primary/10 rounded-md mt-0.5">
                    <Cpu className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <Label className="text-base font-semibold text-foreground">
                      AI Model
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose the AI model for your conversations
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadModels(true)}
                  disabled={modelsLoading || !settings.openRouter?.apiKey}
                >
                  {modelsLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>

              {modelsError && (
                <Alert variant="destructive" className="mb-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{modelsError}</AlertDescription>
                </Alert>
              )}

              <Select
                value={settings.model}
                onValueChange={(value) => updateSetting("model", value)}
                disabled={modelsLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      modelsLoading ? "Loading models..." : "Select a model"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {models.length > 0 ? (
                    models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span>{model.name}</span>
                            {model.description && (
                              <span className="text-xs text-muted-foreground">
                                {model.description}
                              </span>
                            )}
                          </div>
                          <Badge variant="secondary">{model.provider}</Badge>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-models" disabled>
                      {settings.openRouter?.apiKey
                        ? "No models available"
                        : "API key required"}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {isCacheValid() && (
                <p className="text-xs text-muted-foreground mt-2">
                  Models cached •{" "}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => clearModelCache()}
                  >
                    Clear cache
                  </Button>
                </p>
              )}
            </div>

            {/* Model Parameters */}
            <div className="space-y-4 bg-card/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-orange-500/10 rounded-md">
                  <Wrench className="h-4 w-4 text-orange-500" />
                </div>
                <Label className="text-base font-semibold text-foreground">
                  Model Parameters
                </Label>
              </div>

              <div className="space-y-6">
                {/* Temperature */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Label className="text-sm font-medium">Temperature</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            Controls randomness. Lower = focused, Higher =
                            creative
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Slider
                    value={[settings.temperature]}
                    onValueChange={([value]) =>
                      updateSetting("temperature", value)
                    }
                    max={2}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Focused (0)</span>
                    <span>{settings.temperature.toFixed(1)}</span>
                    <span>Creative (2)</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Label className="text-sm font-medium">Max Tokens</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Maximum length of AI responses</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Slider
                    value={[settings.maxTokens]}
                    onValueChange={([value]) =>
                      updateSetting("maxTokens", value)
                    }
                    max={4000}
                    min={100}
                    step={100}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Short (100)</span>
                    <span>{settings.maxTokens} tokens</span>
                    <span>Long (4000)</span>
                  </div>
                </div>

                {/* Top P */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Label className="text-sm font-medium">Top P</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Controls diversity of word choices</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Slider
                    value={[settings.topP || 1.0]}
                    onValueChange={([value]) => updateSetting("topP", value)}
                    max={1}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Focused (0)</span>
                    <span>{(settings.topP || 1.0).toFixed(1)}</span>
                    <span>Diverse (1)</span>
                  </div>
                </div>

                {/* Frequency Penalty */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Label className="text-sm font-medium">
                      Frequency Penalty
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Reduces repetition of frequent words</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Slider
                    value={[settings.frequencyPenalty || 0.0]}
                    onValueChange={([value]) =>
                      updateSetting("frequencyPenalty", value)
                    }
                    max={2}
                    min={-2}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Repetitive (-2)</span>
                    <span>{(settings.frequencyPenalty || 0.0).toFixed(1)}</span>
                    <span>Varied (2)</span>
                  </div>
                </div>

                {/* Presence Penalty */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Label className="text-sm font-medium">
                      Presence Penalty
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Encourages talking about new topics</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Slider
                    value={[settings.presencePenalty || 0.0]}
                    onValueChange={([value]) =>
                      updateSetting("presencePenalty", value)
                    }
                    max={2}
                    min={-2}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Repetitive (-2)</span>
                    <span>{(settings.presencePenalty || 0.0).toFixed(1)}</span>
                    <span>Novel (2)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div className="bg-card/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-blue-500/10 rounded-md">
                  <Terminal className="h-4 w-4 text-blue-500" />
                </div>
                <Label className="text-base font-semibold text-foreground">
                  System Prompt
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors duration-200" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs bg-background border border-border/60">
                      <p>
                        Define how the AI should behave and respond. This sets
                        the personality and guidelines for the conversation.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Textarea
                value={settings.systemPrompt}
                onChange={(e) => updateSetting("systemPrompt", e.target.value)}
                placeholder="You are a helpful AI assistant..."
                className="min-h-[100px]"
              />
            </div>
          </TabsContent>

          {/* UI Configuration Tab */}
          <TabsContent value="ui" className="space-y-6">
            {/* Theme Settings */}
            <div className="space-y-4 bg-card/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-primary/10 rounded-md">
                  <Monitor className="h-4 w-4 text-primary" />
                </div>
                <Label className="text-base font-semibold text-foreground">
                  Theme
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Choose your preferred color scheme
              </p>
              <Select
                value={settings.theme}
                onValueChange={(value: "light" | "dark" | "system") =>
                  updateSetting("theme", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      System
                      <Badge variant="secondary">Auto</Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Language */}
            <div className="bg-card/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-green-500/10 rounded-md">
                  <div className="h-4 w-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full"></div>
                </div>
                <Label className="text-base font-semibold text-foreground">
                  Language
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors duration-200" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-background border border-border/60">
                      <p>Preferred language for AI responses</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select
                value={settings.language}
                onValueChange={(value) => updateSetting("language", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Font Size */}
            <div className="bg-card/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-purple-500/10 rounded-md">
                  <div className="h-4 w-4 bg-gradient-to-br from-purple-400 to-pink-500 rounded"></div>
                </div>
                <Label className="text-base font-semibold text-foreground">
                  Font Size
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors duration-200" />
                    </TooltipTrigger>
                    <TooltipContent className="bg-background border border-border/60">
                      <p>Adjust text size for better readability</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="space-y-3">
                <Slider
                  value={[settings.fontSize]}
                  onValueChange={([value]) => updateSetting("fontSize", value)}
                  max={20}
                  min={10}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Small</span>
                  <span>{settings.fontSize}px</span>
                  <span>Large</span>
                </div>
              </div>
            </div>

            {/* Feature Settings */}
            <div className="bg-card/30 rounded-lg p-4 border border-border/40">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-cyan-500/10 rounded-md">
                  <Zap className="h-4 w-4 text-cyan-500" />
                </div>
                <Label className="text-base font-semibold text-foreground">
                  Features
                </Label>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">
                      Response Streaming
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Real-time AI responses
                    </p>
                  </div>
                  <Switch
                    checked={settings.streamingEnabled}
                    onCheckedChange={(checked) =>
                      updateSetting("streamingEnabled", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Auto Save</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically save conversations
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoSave || true}
                    onCheckedChange={(checked) =>
                      updateSetting("autoSave", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Sound Effects</Label>
                    <p className="text-xs text-muted-foreground">
                      Play notification sounds
                    </p>
                  </div>
                  <Switch
                    checked={settings.soundEnabled || false}
                    onCheckedChange={(checked) =>
                      updateSetting("soundEnabled", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Browser notifications
                    </p>
                  </div>
                  <Switch
                    checked={settings.notificationsEnabled ?? true}
                    onCheckedChange={(checked) =>
                      updateSetting("notificationsEnabled", checked)
                    }
                  />
                </div>
              </div>
            </div>

            {/* Import/Export & Reset */}
            <div className="bg-card/30 rounded-lg p-4 border border-border/40 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-slate-500/10 rounded-md">
                  <Settings className="h-4 w-4 text-slate-500" />
                </div>
                <Label className="text-base font-semibold text-foreground">
                  Settings Management
                </Label>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleExportSettings}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleImportSettings}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResetToDefaults}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </Button>
            </div>
          </TabsContent>

          {/* Accessibility Configuration Tab */}
          <TabsContent value="accessibility" className="space-y-6">
            <AccessibilitySettings
              config={accessibilityConfig}
              onConfigChange={(config) => {
                setAccessibilityConfig(config);
                localStorage.setItem(
                  "accessibility-config",
                  JSON.stringify(config),
                );
              }}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
