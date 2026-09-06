/** @port output output */
interface CastWorkflow {
  name: string;
  description?: string;
  trigger: "manual" | "event" | "schedule" | "webhook";
  onError?: {
    notify?: boolean;
    retry?: { maxAttempts?: number; delayMs?: number };
  };
}

/**
 * @port input input
 * @port output output
 */
interface CastDatabaseConfig {
  collection: string;
  operation: string;
  provider?: string;
  id?: string;
  where?: CastFilterConfig[];
  limit?: number;
  orderBy?: CastSortConfig[];
  single?: boolean;
  data?: CastDataConfig;
}

/** @port output resource */
interface CastFilterConfig {
  field: string;
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=" | "in" | "contains";
  value: string | number | boolean;
}

/** @port output resource */
interface CastSortConfig {
  field: string;
  direction: "asc" | "desc";
}

/** @port output resource */
interface CastDataConfig {
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
interface CastBrowserConfig {
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
interface CastLlmConfig {
  prompt: string;
  /** @port config CastToolConfig */
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
interface CastTransformConfig {
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
interface CastEventConfig {
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
interface CastNotificationConfig {
  channels: string[];
  userId?: string;
  to?: string;
  title?: string;
  message?: string;
  template?: string;
  templateData?: Record<string, any>;
}

/** @port input input */
interface CastOutputConfig {
  expression?: string;
  mapping?: Record<string, any>;
}

/** @port output resource */
interface CastToolConfig {
  name: string;
}

interface CastToolRegistry {
  tools: Record<string, CastToolConfig>;
}
