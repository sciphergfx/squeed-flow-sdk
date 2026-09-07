/** @port output output */
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

/**
 * @port input input
 * @port output output
 */
interface LlmConfig {
  /** @port config TextConfig */
  promptId: string;
  /** @port config TextConfig */
  instructionIds?: string[];
  /** @port config ModelConfig */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  streamPreview?: boolean;
  /** @port config ToolConfig */
  tools?: string[];
  /** @port config MemoryConfig */
  memory?: string[];
  webSearch?: boolean;
}

/**
 * @port input input
 * @port output true
 * @port output false
 */
interface ConditionalConfig {
  condition: string;
  onTrue?: string;
  onFalse?: string;
}

/**
 * @port input input
 * @port output output
 */
interface HttpConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  body?: string;
}

/** @port output resource "output" */
interface ToolConfig {
  name: string;
  description?: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
}

/** @port output resource "output" */
interface ModelConfig {
  name: string;
  provider: string;
  model: string;
}

/** @port output resource "output" */
interface MemoryConfig {
  name: string;
  entityType: string;
}

/** @port output resource "output" */
interface TextConfig {
  name: string;
  content: string;
}
