/** @port output output */
interface Workflow {
  name: string;
  description?: string;
  trigger: "manual" | "event" | "schedule" | "webhook";
  subscribable?: boolean;
  onError?: {
    notify?: boolean;
    retry?: { maxAttempts?: number; delayMs?: number };
  };
}

/**
 * @port input input
 * @port output output
 */
interface DatabaseConfig {
  collection: string;
  operation: string;
  provider?: string;
  id?: string;
  where?: FilterConfig[];
  limit?: number;
  orderBy?: SortConfig[];
  single?: boolean;
  data?: DataConfig;
}

/** @port output resource "output" */
interface FilterConfig {
  field: string;
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "contains";
  value: string | number | boolean;
}

/** @port output resource "output" */
interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

/** @port output resource "output" */
interface DataConfig {
  [key: string]: any;
  status?: string;
  execution_id?: string;
  summary?: string;
  asset_id?: string;
}

/**
 * @port input input
 * @port output output
 */
interface BrowserConfig {
  action: string;
  url?: string;
  mouseEnabled?: boolean | string;
  streamPreview?: boolean;
  record?: boolean;
  fps?: number | string;
  resolution?: string;
  entityType?: string;
  entityId?: string;
  captureSeconds?: number | string;
}

/**
 * @port input input
 * @port output output
 */
interface LlmConfig {
  prompt: string;
  /** @port config ToolConfig */
  tools?: string[];
  model?: string;
  provider?: string;
  maxToolRounds?: number;
  maxTokens?: number;
  temperature?: number;
  timeout?: number | string;
  webSearchProvider?: string;
}

/**
 * @port input input
 * @port output output
 */
interface TransformConfig {
  mode?: string;
  transform?: string;
  value?: any;
  allow?: string[];
  fallback?: string;
  expression?: string;
}

/**
 * @port input input
 * @port output output
 */
interface EventConfig {
  event: string;
  payload?: any;
  entity?: string;
  operation?: string;
  id?: string;
}

/**
 * @port input input
 * @port output output
 */
interface NotificationConfig {
  channels: string[];
  userId?: string;
  to?: string;
  title?: string;
  message?: string;
  template?: string;
  templateData?: Record<string, any>;
}

/** @port input input */
interface OutputConfig {
  expression?: string;
  mapping?: Record<string, any>;
}

/** @port output resource "output" */
interface ToolConfig {
  name: string;
}

interface ToolRegistry {
  tools: Record<string, ToolConfig>;
}
