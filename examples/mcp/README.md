# SDK Test MCP Map

The command catalog contains 77 viewer actions plus a separate model-generation route. `provision.ts` generates 78 authenticated, uncached POST routes and four workflows: two legacy workflows, one shared `emit_event` workflow, and one Backflow model-generation workflow. No backend or SDK runtime changes are required.

| Group      | Commands                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Nodes      | view, label, content, collapse, colors, icon, outline, border style/width/radius, animation/variant, select/create/delete                 |
| Edges      | color, type, icon, label, style, animation variant, select/create/delete                                                                  |
| Diagram    | theme, edge mode/radius/type, spacing, background, compact layout, direction, color mode, node alignment, selection and interaction modes |
| Viewport   | fit, center, center-fit, zoom, zoom-at, pan, focus/isolate node/branch/connections, restore, edge visibility, coordinate conversion       |
| Forms      | validated field edit, options lookup, schema import/clear, connection contract import/clear                                               |
| Documents  | JSON/state replacement, document/state export, SVG export, configuration package replacement/export                                       |
| Inspection | graph IDs/aliases/selection/viewport, node data/geometry, edge data                                                                       |
| Grid       | collision-mode (Fill/gaps/columns/padding), node-grid, grid-swap, collision-detect, collision-resolve                                    |

## Collision Grid

POST `/squeed/collision-mode` to enter or leave the reversible grid mode:

```json
{
  "executionId": "grid-demo",
  "requestId": "fill-1",
  "enabled": true,
  "fill": true,
  "gaps": 0,
  "padding": 0,
  "animate": false
}
```

`columns`, `margin`, `gaps` (number or `{ "x": 10, "y": 20 }`), `fill`,
`padding`, and `animate` are optional. Omitted fields retain the current mode's
options; `enabled: false` restores the graph. `spacing` remains general graph
spacing, not grid gaps. No document mutation or persistent pinning is introduced.

- `/squeed/node-grid`: one-shot arrangement, with the same optional grid settings.
- `/squeed/grid-swap`: `source`, `target`, optional `animate`; IDs or mapped aliases.
- `/squeed/collision-detect`: optional `margin`; permitted in read-only mode.
- `/squeed/collision-resolve`: optional `margin`, `animate`, `maxIterations` (0-1000).

`inspect` includes `nodeGrid: { enabled, options }`. Arrangement/resolution results
serialize `positions` and optional `sizes` as objects keyed by node ID, not Maps.
Swaps return `{ swapped: boolean }`; false means the engine did not accept the
swap (for example, layout is still animating, nodes are pinned or not siblings).
Use `animate: false` on mode entry for deterministic immediate follow-up swaps.
Existing read-only, execution-scope and request-ID protections remain in effect.

`node-content` accepts both strings and declarative component arrays. For JSX,
the node must already have `$contentFormat: "jsx"` and the host must provide its
JSX-content renderer; use `document-replace` to create such a node. Component
entries require a string `type`. Executable JSX is not evaluated.

Provision the updated routes and generate/rotate the restricted client key to
include their exact write scopes. Local code generation does not deploy routes
or change already-issued keys. Command POSTs are uncached because each publishes
an event; no database or cached document state is changed by these routes.

## Delivery

Subscribe SDK Test to `workflow:<executionId>` using a dedicated demo ID. POST to `/squeed/<command-name>` with `executionId` and the catalog fields. Use current graph IDs or mapped node aliases. Edges use current renderer IDs or explicit edge aliases. Requests are limited to 1 MB; hidden/deleted targets, unsupported types and invalid form values are rejected client-side.

New commands use `mcp_sdk_command` with `data: { executionId, command, payload }`. Legacy node-view/node-animation event formats remain supported. Optional `requestId` prevents duplicate application within the most recent 256 successful commands in a mounted bridge. Commands execute serially. Explicit animation commands take precedence over lifecycle animation updates until disconnect.

## Results And Limits

HTTP/MCP responses confirm publication only. They do not confirm browser delivery, and inspection/export data is **not returned synchronously to the MCP caller**. The browser emits `window` CustomEvents named `squeed:mcp-result` with `{ executionId, requestId, command, status, result?, error? }`; hosts can also consume the bridge `onResult` callback. These results are not persisted or broadcast back to the server.

Document/configuration operations use SDK Test's existing validators and callbacks. Configuration operations require a configured dataset; state and form operations require the corresponding dataset support. Read-only diagrams reject edits. Custom JavaScript/renderers, arbitrary callback invocation, authentication and lifecycle notifications are deliberately not executable commands. Local draft persistence remains an explicit host/UI action, not an SDK operation.

## Form Suggestions

`form-set` and `form-options` accept a field relative to the selected form (such as `collection`) or a full JSON address (`root.workflow.steps.0.config.collection`). Full addresses must remain inside that form. SDK Test reuses `STEP_CONFIG_SCHEMAS` from the workflow editor: action/type is resolved from the form's source ancestors, not from hardcoded step IDs. Database collection suggestions reuse the existing entity selector's `/tenant/entities` lookup. This lists tenant-defined collections, not an unbounded database scan.

For arbitrary source shapes, pass `formSuggestions` to SDK Test as `{ "root.custom.table": { action: "database", field: "collection" } }`. Lookups use the authenticated host API and a tenant-plus-URL React Query key with a 30-second freshness window. Existing resource selectors take precedence. Missing permissions and malformed responses remain errors; they do not become fabricated options.

The optional `runSqueedAgentLoop` adapter in SDK Test's `squeedAgentLoop.ts` takes a connected MCP client and a `requestAgent` callback for `/agent/tool-call`. It supplies all 77 schemas using `squeedAgentTools(executionId)`, appends the assistant message and every tool reply, rejects cross-session/unknown calls, deduplicates repeated call IDs, and limits rounds (default 8, maximum 16). It is not automatically attached to a chat UI or an MCP connection. No live LLM request is made by the tests.

Restricted server MCP discovery currently returns tool names without their input fields. The adapter supplies the schemas from the same catalog instead of granting configuration-read permissions. Collection suggestions use the browser's existing authenticated API, not the route-only MCP key. Do not treat a Squeed publication response as browser state or an LLM answer.

An `applied` browser event means the handler completed, not that asynchronous layout has settled. Use the SDK's `onLayoutComplete` callback before making geometry-dependent follow-up operations.

## Backflow Model Streaming

`route_post_squeed_generate_diagram` accepts one complete prompt; the Backflow
model generates the JSON and streams it to SDK Test. Third-party MCP clients do
not need to stream partial tool arguments. This is a separate model-powered
service and consumes model usage, not just the bridge request price.

1. Select **AI Diagram** in SDK Test. Execution controls open automatically.
2. Connect a fresh dedicated execution ID and wait for **subscribed**.
3. Call the generation tool (or POST `/squeed/generate-diagram`):

   ```json
   {
     "body": {
       "executionId": "diagram-demo-1",
       "requestId": "generation-1",
       "prompt": "Show a three-stage order approval flow"
     }
   }
   ```

   For HTTP, send the contents of `body` as the request body. For the optional
   local agent adapter, set `includeGeneration: true`; it is off by default to
   avoid granting model-spending capability to ordinary viewer commands.

The workflow inherits the authenticated tenant's Backflow model configuration,
with no API keys in the payload. It emits `squeed_generation_started`, then
`llm_output_chunk` cumulative text snapshots, then `squeed_generation_completed`.
The viewer reuses `jsonrepair` (also used by AiAssistantPanel) for provisional
previews, validates JSON and preflights diagram compilation, and updates at most
once every 150ms. Invalid intermediate snapshots leave the last preview visible.
Generated metadata is restricted to text labels/content/icons/colors/links,
parent grouping, view mode, and collapse/root visibility. Invalid types and
unsupported metadata (including media, form bindings, or executable content)
are rejected; nesting is limited to 32 levels. The final snapshot must parse
strictly, without repair, before commit. Final
commit also requires the matching workflow completion marker. Saved JSON is not
changed during previews; failure, disconnect, timeout, or switching templates
discards the preview. Editing is disabled while generation is active.

Use **one generation per execution ID**. Chunk events do not contain a request ID,
so do not share a generation channel with other LLM workflows or concurrent runs.
Viewer limits: 1 MiB buffered UTF-8, 180-second timeout. Workflow limits: 8,192
output tokens and a 120-second per-attempt model timeout; provider fallbacks may
take longer. Disconnect stops the local preview, not backend model execution.
Providers without streaming may deliver only a complete final snapshot.

The AI Diagram listener is independent of the deferred diagram render. Other
templates continue to use the existing viewer-command bridge. AI Diagram is a
dedicated generation view, not the ordinary 77-command session. HTTP/MCP results
report backend generation completion, not browser rendering acknowledgement.

Provision the updated manifest and add the exact `/squeed/generate-diagram` write
scope to the client key before use; the generator does not modify deployed keys.
Tests mock model events and do not execute a paid live model request.

## Regeneration

Bundle `examples/mcp/provision.ts` with esbuild, call `createSqueedProvision()`, and serialize its result into the Squeed provisioning manifest. The unit test asserts exact catalog/manifest parity. `squeedResourceScopes()` produces exact write-only route scopes; it never grants wildcard, workflow-administration or tenant-administration access.
