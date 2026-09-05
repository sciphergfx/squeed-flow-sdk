type TriggerType =
  | "manual"
  | "event"
  | "schedule"
  | "webhook"
  | "api"
  | "auto"
  | "on_violation";

interface Retry {
  maxAttempts?: number;
  backoffMs?: number;
  backoffMultiplier?: number;
}

interface ForEach {
  items: string;
  as: string;
  maxConcurrency?: number;
}

interface Prefetch {
  type: "r2" | "db" | "cache" | "embedding";
  key: string;
  as: string;
  maxTokens?: number;
  required?: boolean;
}

interface PausePoint {
  requireApproval?: boolean;
  message?: string;
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
    channels?: ("email" | "sms" | "whatsapp" | "push" | "slack")[];
    priority?: "low" | "normal" | "high" | "urgent";
    userId?: string;
    email?: string;
    userName?: string;
  };
}

interface WorkflowStep {
  id?: string;
  name?: string;
  description?: string;
  action?: string;
  type?: string;
  progressMessage?: string;
  output?: string;
  saveAs?: string;
  condition?: string;
  workflowId?: string;
  files?: { mimeType: string }[];
  images?: { url: string }[];
  dependsOn?: string[];
  parallel?: boolean;
  earlyReturn?: boolean;
  queueAsJob?: boolean;
  executionTarget?: "local" | "server";
  pausePoint?: PausePoint;
  optional?: boolean;
  continueOnError?: boolean;
  retry?: Retry;
  forEach?: ForEach;
  subworkflow?: string;
  prefetch?: Prefetch[];
}

interface Workflow {
  id?: string;
  name: string;
  description?: string;
  eventName?: string;
  trigger?: TriggerType;
  steps: WorkflowStep[];
}

interface WorkflowForm {
  id: string;
  name: string;
  description?: string;
  eventName?: string;
  working_directory?: string;
  agent?: {
    id?: string;
    name?: string;
    role?: string;
    llm_prompt?: string;
  };
  workflows?: Workflow[];
  steps?: WorkflowStep[];
  trigger?: TriggerType;
  planOnly?: boolean;
  subscribable?: boolean;
  timeoutMs?: number;
  goalConfig?: {
    minPassRate?: number;
    onGoalFailed?: "pause" | "continue";
    onGoalMet?: "continue" | "emit_event";
  };
  allowPause?: boolean;
  executionMode?: "local" | "server" | "hybrid";
  localMcpEndpoint?: string;
  channel?: string;
  executionId?: string;
  maxRetries?: number;
  contextManagement?: {
    bouncer?: {
      enabled?: boolean;
      strategy?: "sliding_window" | "priority" | "summarize";
      maxInputTokens?: number;
      preserveLastN?: number;
    };
    rag?: {
      enabled: boolean;
      mode?: "documents" | "entities" | "auto";
      entityTypes?: string[];
      documentIds?: string[];
    };
  };
}
