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
  where?: any;
  limit?: number;
  orderBy?: any;
  single?: boolean;
  data?: any;
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

/**
 * @port output browser_navigate_page
 * @port output browser_list_pages
 * @port output browser_select_page
 * @port output browser_close_page
 * @port output browser_wait_for
 * @port output browser_click
 * @port output browser_click_at
 * @port output browser_type_text
 * @port output browser_fill
 * @port output browser_fill_form
 * @port output browser_hover
 * @port output browser_drag
 * @port output browser_press_key
 * @port output browser_handle_dialog
 * @port output browser_evaluate_script
 * @port output browser_take_snapshot
 * @port output browser_take_screenshot
 * @port output browser_get_console_message
 * @port output browser_list_console_messages
 * @port output browser_list_network_requests
 * @port output browser_get_network_request
 * @port output browser_emulate
 * @port output browser_resize_page
 */
interface CastToolRegistry {
  tools: Record<string, CastToolConfig>;
}
