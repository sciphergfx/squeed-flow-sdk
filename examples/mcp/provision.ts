import { FLOW_COMMANDS, commandSchema } from "./commands";
import { generationRoute, generationWorkflow } from "./generation";

export function createSqueedProvision() {
  const workflowId = "squeed-sdk-command";
  const workflows = [
    ...["view", "animation"].map((kind) => ({
      id: `squeed-node-${kind}`,
      name: `Squeed Node ${kind}`,
      trigger: { type: "manual" },
      steps: [
        {
          id: `publish_${kind}`,
          action: "emit_event",
          params: {
            event: `mcp_node_${kind}`,
            data: {
              executionId: "{{input.executionId}}",
              documentId: "{{input.documentId}}",
              requestId: "{{input.requestId}}",
              node: "{{input.node}}",
              [kind === "view" ? "mode" : "animated"]:
                `{{input.${kind === "view" ? "mode" : "animated"}}}`,
            },
          },
        },
      ],
    })),
    {
      id: workflowId,
      name: "Squeed SDK Command",
      trigger: { type: "manual" },
      steps: [
        {
          id: "publish_command",
          action: "emit_event",
          params: {
            event: "mcp_sdk_command",
            data: {
              executionId: "{{input.executionId}}",
              command: "{{input.command}}",
              payload: "{{input.payload}}",
            },
          },
        },
      ],
    },
  ];
  const routes = FLOW_COMMANDS.map((command) => {
    const legacy =
      command.name === "node-view" || command.name === "node-animation";
    const schema = commandSchema(command);
    const input = legacy
      ? Object.fromEntries(
          [
            "executionId",
            "documentId",
            "requestId",
            "node",
            ...Object.keys(command.fields),
          ].map((field) => [field, `{{body.${field}}}`]),
        )
      : {
          executionId: "{{body.executionId}}",
          command: command.name,
          payload: Object.fromEntries(
            Object.keys(schema.properties).map((field) => [
              field,
              `{{body.${field}}}`,
            ]),
          ),
        };
    return {
      path: `/squeed/${command.name}`,
      method: "post",
      requireAuth: true,
      authMode: "either",
      mcpEnabled: true,
      cache: { enabled: false },
      description: `${command.description} Send body with required fields: ${schema.required.join(", ")}. Use a dedicated SDK Test executionId subscribed to workflow:<executionId>. Node/edge IDs must exist in the current diagram; node aliases are also accepted. Optional requestId deduplicates new commands. This route only publishes; results/errors are browser CustomEvents named squeed:mcp-result, not returned to MCP.`,
      request: { body: schema.properties },
      response: {
        description:
          "Workflow publication result only; not browser acknowledgement or query data.",
        mcpEnabled: true,
      },
      integrations: {
        actions: [
          {
            type: "workflow",
            workflowId: legacy ? `squeed-${command.name}` : workflowId,
            input,
          },
        ],
      },
    };
  });
  return {
    permissions: ["workflow:read", "workflow:execute"],
    workflows: [...workflows, generationWorkflow],
    routes: [...routes, generationRoute],
  };
}

export function squeedResourceScopes() {
  return [
    ...FLOW_COMMANDS.map((command) => ({
      resourceType: "route",
      resourceId: `/squeed/${command.name}`,
      access: "write",
    })),
    {
      resourceType: "route",
      resourceId: generationRoute.path,
      access: "write",
    },
  ];
}
