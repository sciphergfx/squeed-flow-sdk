interface WorkflowStep {
  name: string;
  type: string;
  config: Record<string, any>;
  id?: string;
  saveAs?: string;
  condition?: string;
  parallel?: boolean;
  earlyReturn?: boolean;
  queueAsJob?: boolean;
  dependsOn?: string[];
  input?: Record<string, any>;
  output?: string;
  optional?: boolean;
  defaultValue?: any;
  continueOnError?: boolean;
  executionTarget?: "local" | "server";
  cache?: boolean;
  cacheable?: boolean;
  files?: any[];
  images?: any[];
  pausePoint?: {
    requireApproval?: boolean;
    message?: string;
    metadata?: Record<string, any>;
    resourceAction?: {
      type: "oauth_connect" | "api_key_setup" | "webhook_setup" | "secret_setup";
      resourceType: string;
      resourceName: string;
      displayName?: string;
      description?: string;
      authType?: string;
      scopes?: string[];
      setupUrl?: string;
      checkEndpoint?: string;
    };
    notify?: {
      enabled: boolean;
      channels?: string[];
      priority?: string;
      email?: string;
      userName?: string;
      userId?: string;
    };
  };
  progressMessage?: string;
  retry?: {
    maxAttempts?: number;
    backoffMs?: number;
    backoffMultiplier?: number;
  };
}

interface WorkflowForm {
  name: string;
  id?: string;
  description?: string;
  trigger?: string;
  tools?: any[];
  steps: WorkflowStep[];
  isPublic?: boolean;
  tags?: string[];
  planOnly?: boolean;
  version?: number;
  executionMode?: string;
  maxRetries?: number;
  timeoutMs?: number;
  [key: string]: any;
  input?: Record<string, any>;
  cronExpression?: string;
  eventName?: string;
  eventFilter?: Record<string, any>;
  onError?: { notify?: boolean; retry?: { maxAttempts?: number; delayMs?: number } };
  agent?: any;
  context?: any;
  subscribable?: boolean;
  channel?: string;
  working_directory?: string;
  localMcpEndpoint?: string;
  monitoring?: any;
}

interface OutputConfig {
  "mapping": any;
}

interface HttpConfig {
  "url": any;
  "method": string;
  "headers"?: Record<string, any>;
  "body"?: any;
  "queryParams"?: Record<string, any>;
  "timeout"?: number;
}

interface BackflowToolConfig {
  "name": string;
  "params"?: any;
}

interface DatabaseConfig {
  "provider": string;
  "collection": any;
  "operation": string;
  "id"?: any;
  "where"?: any;
  "data"?: any;
  "single"?: boolean;
  "limit"?: number;
}

interface TransformConfig {
  "mode"?: string;
  "transform"?: string;
  "input"?: any;
  "expression"?: any;
}

interface LlmConfig {
  "prompt": any;
  "model"?: string;
  "provider"?: string;
  "temperature"?: number;
  "maxTokens"?: number;
  "streamPreview"?: boolean;
  "tools"?: string[];
  "memory"?: string[];
  "instructions"?: any;
  "webSearch"?: boolean;
  "webSearchProvider"?: string;
}

interface NotificationConfig {
  "channels"?: string[];
  "title"?: any;
  "body"?: any;
  "to"?: any;
  "userId"?: any;
  "template"?: any;
  "templateData"?: Record<string, any>;
  "priority"?: string;
}

interface StorageConfig {
  "operation": string;
  "bucket": any;
  "path"?: any;
  "prefix"?: any;
  "data"?: any;
}

interface FirebaseConfig {
  "collection": any;
  "operation"?: string;
  "documentId"?: any;
  "data"?: any;
  "where"?: any;
}

interface CacheConfig {
  "operation": string;
  "key": any;
  "value"?: any;
  "ttl"?: number;
  "pattern"?: any;
}

interface ConditionalConfig {
  "condition": any;
  "onTrue"?: any;
  "onFalse"?: any;
}

interface EmitEventConfig {
  "event": any;
  "data"?: any;
  "entity"?: string;
  "operation"?: string;
  "id"?: any;
}

interface BrowserConfig {
  "url"?: any;
  "action"?: string;
  "prompt"?: any;
  "maxSteps"?: number;
  "instructions"?: any;
  "record"?: any;
  "fps"?: any;
  "resolution"?: any;
  "entityType"?: any;
  "entityId"?: any;
  "selector"?: any;
  "waitMs"?: number;
  "streamPreview"?: boolean;
}

interface WebsocketCallConfig {
  "integration": string;
  "emitEvent"?: string;
  "request": any;
  "maxDurationMs"?: number;
  "subscribe"?: boolean;
}

interface DelayConfig {
  "seconds": number;
}

interface WebSearchConfig {
  "query": any;
  "maxResults"?: number;
}

interface SpawnWorkflowConfig {
  "config"?: any;
  "resultKey"?: any;
  "allowedActions"?: any;
  "timeout"?: number;
  "maxDepth"?: number;
  "weight"?: number;
  "allowedTools"?: any;
  "delegationConfig"?: any;
}

interface HandoffConfig {
  "config"?: any;
  "agent"?: any;
  "instructions"?: any;
  "context"?: any;
  "weight"?: number;
  "allowedTools"?: any;
  "timeout"?: number;
  "delegationConfig"?: any;
}

interface AwaitResultsConfig {
  "executionIds"?: any;
  "timeout"?: number;
  "retryOnFailure"?: boolean;
  "maxRetries"?: number;
  "retryDelay"?: number;
}

interface BulkImportConfig {
  "collection": any;
  "source"?: any;
  "format"?: string;
  "mode"?: string;
  "upsertKey"?: any;
  "batchSize"?: number;
}

interface BulkExportConfig {
  "collection": any;
  "format"?: string;
  "filters"?: any;
  "batchSize"?: number;
  "output"?: any;
}

interface WhileLoopConfig {
  "steps": any;
  "condition"?: any;
  "maxIterations"?: number;
  "accumulate"?: string;
}

interface RenderSceneConfig {
  "sceneName": any;
  "layout"?: string;
  "backgroundColor"?: any;
  "spacing"?: number;
  "align"?: string;
  "justify"?: string;
  "className"?: any;
  "components"?: any;
}

interface WriteToDiskConfig {
  "baseDir"?: any;
  "files": any;
}

interface ExecuteCodeConfig {
  "code": any;
  "language"?: string;
  "input"?: any;
  "timeout"?: number;
}

interface ShellCommandConfig {
  "command": any;
  "cwd"?: any;
  "env"?: any;
  "timeout"?: number;
}

interface CustomConfig { [key: string]: any }

interface Graph {
  "workflow": WorkflowForm;
  "step": WorkflowStep;
  "output": OutputConfig;
  "http": HttpConfig;
  "backflow_tool": BackflowToolConfig;
  "database": DatabaseConfig;
  "transform": TransformConfig;
  "llm": LlmConfig;
  "notification": NotificationConfig;
  "storage": StorageConfig;
  "firebase": FirebaseConfig;
  "cache": CacheConfig;
  "conditional": ConditionalConfig;
  "emit_event": EmitEventConfig;
  "browser": BrowserConfig;
  "websocket_call": WebsocketCallConfig;
  "delay": DelayConfig;
  "web_search": WebSearchConfig;
  "spawn_workflow": SpawnWorkflowConfig;
  "handoff": HandoffConfig;
  "await_results": AwaitResultsConfig;
  "bulk_import": BulkImportConfig;
  "bulk_export": BulkExportConfig;
  "while_loop": WhileLoopConfig;
  "render_scene": RenderSceneConfig;
  "write_to_disk": WriteToDiskConfig;
  "execute_code": ExecuteCodeConfig;
  "shell_command": ShellCommandConfig;
  "custom": CustomConfig;
}
