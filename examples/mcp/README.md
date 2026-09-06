# SDK Test MCP Map

The command catalog contains 72 actions. `provision.ts` generates the Squeed manifest: one authenticated, uncached POST route per command, two legacy workflows, and one shared `emit_event` workflow. No backend or SDK runtime changes are required.

| Group | Commands |
| --- | --- |
| Nodes | view, label, content, collapse, colors, icon, outline, border style/width/radius, animation/variant, select/create/delete |
| Edges | color, type, icon, label, style, animation variant, select/create/delete |
| Diagram | theme, edge mode/radius/type, spacing, background, compact layout, direction, color mode, node alignment, selection and interaction modes |
| Viewport | fit, center, center-fit, zoom, zoom-at, pan, focus/isolate node/branch/connections, restore, edge visibility, coordinate conversion |
| Forms | validated field edit, options lookup, schema import/clear, connection contract import/clear |
| Documents | JSON/state replacement, document/state export, SVG export, configuration package replacement/export |
| Inspection | graph IDs/aliases/selection/viewport, node data/geometry, edge data |

## Delivery

Subscribe SDK Test to `workflow:<executionId>` using a dedicated demo ID. POST to `/squeed/<command-name>` with `executionId` and the catalog fields. Use current graph IDs or mapped node aliases. Edges use current renderer IDs or explicit edge aliases. Requests are limited to 1 MB; hidden/deleted targets, unsupported types and invalid form values are rejected client-side.

New commands use `mcp_sdk_command` with `data: { executionId, command, payload }`. Legacy node-view/node-animation event formats remain supported. Optional `requestId` prevents duplicate application within the most recent 256 successful commands in a mounted bridge. Commands execute serially. Explicit animation commands take precedence over lifecycle animation updates until disconnect.

## Results And Limits

HTTP/MCP responses confirm publication only. They do not confirm browser delivery, and inspection/export data is **not returned synchronously to the MCP caller**. The browser emits `window` CustomEvents named `squeed:mcp-result` with `{ executionId, requestId, command, status, result?, error? }`; hosts can also consume the bridge `onResult` callback. These results are not persisted or broadcast back to the server.

Document/configuration operations use SDK Test's existing validators and callbacks. Configuration operations require a configured dataset; state and form operations require the corresponding dataset support. Read-only diagrams reject edits. Custom JavaScript/renderers, arbitrary callback invocation, authentication and lifecycle notifications are deliberately not executable commands. Local draft persistence remains an explicit host/UI action, not an SDK operation.

## Form Suggestions

`form-set` and `form-options` accept a field relative to the selected form (such as `collection`) or a full JSON address (`root.workflow.steps.0.config.collection`). Full addresses must remain inside that form. SDK Test reuses `STEP_CONFIG_SCHEMAS` from the workflow editor: action/type is resolved from the form's source ancestors, not from hardcoded step IDs. Database collection suggestions reuse the existing entity selector's `/tenant/entities` lookup. This lists tenant-defined collections, not an unbounded database scan.

For arbitrary source shapes, pass `formSuggestions` to SDK Test as `{ "root.custom.table": { action: "database", field: "collection" } }`. Lookups use the authenticated host API and a tenant-plus-URL React Query key with a 30-second freshness window. Existing resource selectors take precedence. Missing permissions and malformed responses remain errors; they do not become fabricated options.

The optional `runSqueedAgentLoop` adapter in SDK Test's `squeedAgentLoop.ts` takes a connected MCP client and a `requestAgent` callback for `/agent/tool-call`. It supplies all 72 schemas using `squeedAgentTools(executionId)`, appends the assistant message and every tool reply, rejects cross-session/unknown calls, deduplicates repeated call IDs, and limits rounds (default 8, maximum 16). It is not automatically attached to a chat UI or an MCP connection. No live LLM request is made by the tests.

Restricted server MCP discovery currently returns tool names without their input fields. The adapter supplies the schemas from the same catalog instead of granting configuration-read permissions. Collection suggestions use the browser's existing authenticated API, not the route-only MCP key. Do not treat a Squeed publication response as browser state or an LLM answer.

An `applied` browser event means the handler completed, not that asynchronous layout has settled. Use the SDK's `onLayoutComplete` callback before making geometry-dependent follow-up operations.

## Regeneration

Bundle `examples/mcp/provision.ts` with esbuild, call `createSqueedProvision()`, and serialize its result into the Squeed provisioning manifest. The unit test asserts exact catalog/manifest parity. `squeedResourceScopes()` produces exact write-only route scopes; it never grants wildcard, workflow-administration or tenant-administration access.