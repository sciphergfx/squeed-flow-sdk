export const GENERATION_WORKFLOW_ID = "squeed-generate-diagram";
export const GENERATION_TOOL_NAME = "route_post_squeed_generate_diagram";
export const generationInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["executionId", "requestId", "prompt"],
  properties: {
    executionId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" },
    requestId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" },
    prompt: { type: "string", minLength: 1, maxLength: 16000 },
  },
};
export const generationDescription =
  "Generate a Squeed diagram with the tenant's Backflow model. Uses model credits, separate from bridge pricing. First select AI Diagram in SDK Test and subscribe to a fresh dedicated executionId. One generation per executionId; never run concurrently. Streams repaired previews to that viewer; completion commits strictly valid JSON. Returns backend completion, not browser acknowledgement.";
export const generationWorkflow = {
  id: GENERATION_WORKFLOW_ID,
  name: "Squeed Generate Diagram",
  trigger: { type: "manual" },
  steps: [
    {
      id: "start",
      action: "emit_event",
      params: {
        event: "squeed_generation_started",
        data: {
          executionId: "{{input.executionId}}",
          requestId: "{{input.requestId}}",
        },
      },
    },
    {
      id: "generate",
      action: "llm",
      dependsOn: ["start"],
      params: {
        prompt: "{{input.prompt}}",
        temperature: 0.2,
        maxTokens: 8192,
        timeout: 120000,
        streamPreview: true,
        systemPrompt:
          'Return ONLY one complete JSON object for a Squeed diagram. No markdown fences, prose, ui_step or flow_diagram tags. Top-level keys are stable node IDs. Each node is an object. Use $label for text, $icon for react-icons Pi names, $bgColor for colors, $content for optional Markdown, $target for a connection address such as root.finish, $targetLabel for its label. Use $parent to group nodes. Never use __proto__, constructor or prototype keys. Do not emit JavaScript, credentials, media URLs or workflow execution instructions. Example: {"start":{"$label":"Start","$icon":"PiPlay","$target":"root.finish"},"finish":{"$label":"Finish","$icon":"PiCheck"}}',
      },
    },
    {
      id: "complete",
      action: "emit_event",
      dependsOn: ["generate"],
      params: {
        event: "squeed_generation_completed",
        data: {
          executionId: "{{input.executionId}}",
          requestId: "{{input.requestId}}",
        },
      },
    },
  ],
};
export const generationRoute = {
  path: "/squeed/generate-diagram",
  method: "post",
  requireAuth: true,
  authMode: "either",
  mcpEnabled: true,
  cache: { enabled: false },
  description: generationDescription,
  request: { body: generationInputSchema.properties },
  response: {
    description:
      "Model generation completion; viewer preview and commit status are reported in the browser.",
    mcpEnabled: true,
  },
  integrations: {
    actions: [
      {
        type: "workflow",
        workflowId: GENERATION_WORKFLOW_ID,
        input: {
          executionId: "{{body.executionId}}",
          requestId: "{{body.requestId}}",
          prompt: "{{body.prompt}}",
        },
      },
    ],
  },
};
