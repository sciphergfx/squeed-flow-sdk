interface TriggerConfig {
  type:
    | "manual"
    | "event"
    | "schedule"
    | "webhook"
    | "api"
    | "auto"
    | "on_violation";
  event?: string;
  cron?: string;
}

interface LlmConfig {
  promptId: string;
  instructionIds?: string[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  streamPreview?: boolean;
  tools?: string[];
  memory?: string[];
  webSearch?: boolean;
}

interface ConditionalConfig {
  condition: string;
  onTrue?: string;
  onFalse?: string;
}

interface HttpConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: string;
}

interface ToolConfig {
  name: string;
  description?: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
}
