interface WorkflowStep {
  "name": string;
  "type": string;
  "id"?: string;
  "saveAs"?: string;
  "condition"?: string;
  "parallel"?: boolean;
  "earlyReturn"?: boolean;
  "queueAsJob"?: boolean;
  "dependsOn"?: string[];
  "output"?: string;
  "optional"?: boolean;
  "continueOnError"?: boolean;
  "executionTarget"?: "local" | "server";
  "cache"?: boolean;
  "cacheable"?: boolean;
  "pausePoint"?: { "requireApproval"?: boolean; "message"?: string; "resourceAction"?: { "type": "oauth_connect" | "api_key_setup" | "webhook_setup" | "secret_setup"; "resourceType": string; "resourceName": string; "displayName"?: string; "description"?: string; "authType"?: string; "scopes"?: string[]; "setupUrl"?: string; "checkEndpoint"?: string; }; "notify"?: { "enabled": boolean; "channels"?: string[]; "priority"?: string; "email"?: string; "userName"?: string; "userId"?: string; }; };
  "progressMessage"?: string;
  "retry"?: { "maxAttempts"?: number; "backoffMs"?: number; "backoffMultiplier"?: number; };
}

interface WorkflowForm {
  "name": string;
  "id"?: string;
  "description"?: string;
  "trigger"?: "manual" | "schedule" | "webhook" | "event";
  "steps": WorkflowStep[];
  "isPublic"?: boolean;
  "tags"?: string[];
  "planOnly"?: boolean;
  "version"?: number;
  "executionMode"?: string;
  "maxRetries"?: number;
  "timeoutMs"?: number;
  "cronExpression"?: string;
  "eventName"?: string;
  "onError"?: { "notify"?: boolean; "retry"?: { "maxAttempts"?: number; "delayMs"?: number; }; };
  "subscribable"?: boolean;
  "channel"?: string;
  "working_directory"?: string;
  "localMcpEndpoint"?: string;
}

interface OutputConfig {
  
}

interface HttpConfig {
  "method": string;
  "timeout"?: number;
}

interface BackflowToolConfig {
  "name": string;
}

interface DatabaseConfig {
  "provider": string;
  "operation": string;
  "single"?: boolean;
  "limit"?: number;
}

interface TransformConfig {
  "mode"?: string;
  "transform"?: string;
}

interface LlmConfig {
  "model"?: string;
  "provider"?: string;
  "temperature"?: number;
  "maxTokens"?: number;
  "streamPreview"?: boolean;
  "tools"?: string[];
  "memory"?: string[];
  "webSearch"?: boolean;
  "webSearchProvider"?: string;
}

interface NotificationConfig {
  "channels"?: string[];
  "priority"?: string;
}

interface StorageConfig {
  "operation": string;
}

interface FirebaseConfig {
  "operation"?: string;
}

interface CacheConfig {
  "operation": string;
  "ttl"?: number;
}

interface ConditionalConfig {
  
}

interface EmitEventConfig {
  "entity"?: string;
  "operation"?: string;
}

interface BrowserConfig {
  "action"?: string;
  "maxSteps"?: number;
  "waitMs"?: number;
  "streamPreview"?: boolean;
}

interface WebsocketCallConfig {
  "integration": string;
  "emitEvent"?: string;
  "maxDurationMs"?: number;
  "subscribe"?: boolean;
}

interface DelayConfig {
  "seconds": number;
}

interface WebSearchConfig {
  "maxResults"?: number;
}

interface SpawnWorkflowConfig {
  "timeout"?: number;
  "maxDepth"?: number;
  "weight"?: number;
}

interface HandoffConfig {
  "weight"?: number;
  "timeout"?: number;
}

interface AwaitResultsConfig {
  "timeout"?: number;
  "retryOnFailure"?: boolean;
  "maxRetries"?: number;
  "retryDelay"?: number;
}

interface BulkImportConfig {
  "format"?: string;
  "mode"?: string;
  "batchSize"?: number;
}

interface BulkExportConfig {
  "format"?: string;
  "batchSize"?: number;
}

interface WhileLoopConfig {
  "maxIterations"?: number;
  "accumulate"?: string;
}

interface RenderSceneConfig {
  "layout"?: string;
  "spacing"?: number;
  "align"?: string;
  "justify"?: string;
}

interface WriteToDiskConfig {
  
}

interface ExecuteCodeConfig {
  "language"?: string;
  "timeout"?: number;
}

interface ShellCommandConfig {
  "timeout"?: number;
}

interface CustomConfig {
  
}

interface Graph {
  samples: ValidationSamples;
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

interface ValidationSamples {
  text: string; count: number; flag: boolean; names: string[]; counts: number[];
  target: "local"; invalidTarget: "remote"; broadTarget: string;
  retry: { maxAttempts: number; backoffMs: number; backoffMultiplier: number };
  badRetry: { maxAttempts: string };
  approval: { requireApproval: boolean; resourceAction: { type: "oauth_connect"; resourceType: string; resourceName: string; scopes: string[] } };
  badApproval: { resourceAction: { type: "oauth_connect"; resourceType: string } };
}
