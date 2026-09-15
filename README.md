# @squeed/flow-sdk

Interactive React flow diagrams from JSON, using DOM nodes, SVG edges, and Dagre layout.

## Install

```bash
npm install @squeed/flow-sdk@^2 react@^18 react-dom@^18 markdown-to-jsx@^9.10.2
```

Requires React 18 and Chakra UI 3.36 or later. Peer dependencies: `react`, `react-dom`, `@chakra-ui/react`, `@emotion/react`, `@emotion/styled`, `framer-motion` (11 or 12), and `markdown-to-jsx` (^9.10.2). npm installs the remaining peers automatically. React 19 is not currently supported.

The Markdown renderer is a required peer supplied by the consuming application, not embedded in the SDK bundle. It remains part of the application's dependency footprint.

## Ownership And Code Patterns

The dependency direction is **Squeed app -> public SDK API**. This package owns
reusable diagram behavior, not application document storage, project ownership,
authentication, navigation, or backend transport. Consumers retain changed
documents and application state. See the
[app pattern](../squeed/README.md#ownership-and-code-patterns) and
[contribution rules](CONTRIBUTING.md).

| Location                                           | Responsibility                                              |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `src/core`                                         | Compilation, immutable document edits, and callback binding |
| `src/engine`                                       | Geometry, layout, viewport, gestures, and canvas rendering  |
| `src/components`, `src/nodes`                      | Public composition, shared controls, and node views         |
| `src/types`, `src/hooks`, `src/theme`, `src/utils` | Contracts and existing shared support                       |
| `src/index.ts`                                     | Consumer-facing exports; internal modules use local imports |
| `examples`, `tests`                                | Consumer demonstrations, fixtures, and verification         |

Reuse the existing owner of a behavior instead of adding a parallel helper or
host-specific branch. Keep pure document operations independent of UI and
storage. Prefer design/configuration defaults over imperative presentation fixes.
JSON edits use the shared callback binding and emit one immutable document;
raw graph consumers own their mutations. Preserve read-only restrictions.

Use PascalCase for components/types, `use...` for hooks, and lower-camel-case
module names for non-component operations. Use exported types at public
boundaries, distinguish type-only dependencies from runtime dependencies, and
avoid runtime import cycles. Document public contract changes and test the
owning module plus affected consumer behavior.

The current tree still has runtime cycles between `squeedEdits`/`parentGroups`
and `NodeForm`/`StructuredFieldControls`. SDK examples and the app's local
examples are not automatically synchronized or interchangeable contracts.
These remain structural review items; passing behavior or release tests alone
does not establish that the code follows this pattern.

## Quick Start

```tsx
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { useState } from "react";
import {
  FlowDiagram,
  type FlowDirection,
  type SqueedJson,
} from "@squeed/flow-sdk";

function App() {
  const [doc, setDoc] = useState<SqueedJson>({
    service: { $label: "Service", $collapsed: false, worker: {} },
    database: { $label: "Database" },
  });
  const [direction, setDirection] = useState<FlowDirection>("LR");

  return (
    <ChakraProvider value={defaultSystem}>
      <div style={{ height: 600 }}>
        <FlowDiagram
          json={doc}
          title="My Diagram"
          config={{ direction, editable: true, themeColor: "blue.500" }}
          callbacks={{ onJsonChange: setDoc, onDirectionChange: setDirection }}
        />
      </div>
    </ChakraProvider>
  );
}
```

The container must have a height. Styles are injected automatically; no CSS import is required. Keep your existing Chakra provider if the application already has one.

`json` accepts a parsed object or array. Edits produce a new document via `onJsonChange(next, change)`; store `next` and pass it back. Granular callbacks still fire for notifications, but should not apply the same document edit again. With `nodes`/`edges` instead, the consumer owns graph updates and collapse filtering.

Editing a plain-string node label updates that string in place, preserving its JSON address and connections. Object-node labels continue to use `$label`.

## Migrating From v1

**v2 is a breaking release for consumers of the Cytoscape instance.** `onCyInit` has been removed. Use `onInit(engine)` to capture a `FlowEngine`; it is not a Cytoscape-compatible object.

| v1                                                | v2                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `onCyInit(cy)`                                    | `onInit(engine)`                                                                    |
| `cy.zoom()` / `cy.zoom(level)`                    | `engine.zoom()` / `engine.zoom(level)`                                              |
| `cy.pan()` / `cy.pan(position)`                   | `engine.pan()` / `engine.pan(position)`                                             |
| `cy.zoom({ level, renderedPosition })`            | `engine.zoomAt(level, renderedPosition)`                                            |
| `cy.fit(undefined, 50)` / `cy.center()`           | `engine.fit(50)` / `engine.center()`                                                |
| `cy.on("pan zoom", ...)`                          | `callbacks.onViewportChange` or `engine.onViewportChange(listener)`                 |
| `cy.nodes()`, `cy.edges()`, `cy.style()`, plugins | Update the JSON, `nodes`/`edges`, or SDK config; no Cytoscape equivalent is exposed |

`engine.getNodeBox(id)` returns `{ x, y, w, h }` in model units after layout, or `undefined` before placement. `clientToModel(clientX, clientY)` and `modelToClient({ x, y })` convert coordinates. `onViewportChange(listener)` returns an unsubscribe function.

Direction, selection, drawing, editing, collapse, and custom render callbacks remain available. Internal Cytoscape DOM classes are gone. SVG routing and text metrics can differ from the old canvas renderer; exact pixel parity is not guaranteed. `initialViewport` is now respected instead of being overwritten by automatic fitting.

## Props

### `FlowDiagramProps`

| Prop            | Type                   | Description                                                        |
| --------------- | ---------------------- | ------------------------------------------------------------------ |
| `json`          | `SqueedJson`           | Parsed JSON object or array; takes precedence over `nodes`/`edges` |
| `title`         | `string`               | Title shown on the root node (default: `"untitled"`)               |
| `nodes`         | `FlowDiagramNode[]`    | Pre-computed nodes (alternative to `json`)                         |
| `edges`         | `FlowDiagramEdge[]`    | Pre-computed edges (alternative to `json`)                         |
| `config`        | `FlowDiagramConfig`    | Diagram configuration                                              |
| `callbacks`     | `FlowDiagramCallbacks` | Event callbacks                                                    |
| `showBottomBar` | `boolean`              | Show the direction/mode bottom bar (default: `true`)               |
| `className`     | `string`               | CSS class name                                                     |
| `style`         | `CSSProperties`        | Inline styles                                                      |

You can provide either `json` (auto-generates nodes/edges) or `nodes` + `edges` (pre-computed).

## Config

Clicking the empty graph background opens the **Graph theme** swatches after the
set/array control. They change the default node theme without replacing explicit
node colors or modifying graph JSON, and hide while a node or edge is selected
or the diagram is read-only. Without `config.themeColor`, the selection is stored
locally. For a controlled or persisted theme, pass `config.themeColor` and update
it from `callbacks.onThemeColorChange(color)`.

### `FlowDiagramConfig`

| Option                                                                  | Type                                             | Default      | Description                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------- |
| `direction`                                                             | `"LR" \| "RL" \| "TB" \| "BT" \| "C"`            | `"LR"`       | Layout direction; `C` splits the JSON root's branches                                             |
| `nodeAlignment`                                                         | `"leading" \| "center" \| "trailing"`            | `"center"`   | Align unequal node sizes within each layout rank                                                  |
| `edgeMode`                                                              | `"nodes" \| "properties" \| "workflow"`          | `"nodes"`    | Attach edges to nodes or named property rows; `"workflow"` is a compatibility alias for `"nodes"` |
| `layout`                                                                | `LayoutAlgorithm`                                | `"dagre"`    | Only Dagre is implemented; other legacy values do not select a different layout                   |
| `themeColor`                                                            | `string`                                         | `"blue.500"` | Accent color (Chakra token)                                                                       |
| `colorMode`                                                             | `"light" \| "dark"`                              | `"light"`    | Color mode                                                                                        |
| `backgroundPattern`                                                     | `"dot" \| "grid" \| "steel" \| "none"`           | `"dot"`      | Background pattern                                                                                |
| `backgroundColor`                                                       | `string`                                         | —            | Background color override                                                                         |
| `edgeColor`                                                             | `string`                                         | —            | Edge/line color override                                                                          |
| `minZoom`                                                               | `number`                                         | `0.01`       | Minimum zoom level                                                                                |
| `maxZoom`                                                               | `number`                                         | `1.5`        | Maximum zoom level                                                                                |
| `initialViewport`                                                       | `{ pan: { x, y }, zoom }`                        | —            | Initial viewport; omitted means fit on first layout                                               |
| `edgeHandles`                                                           | `boolean`                                        | —            | `false` disables edge drawing; enabling handles does not activate Draw mode                       |
| `readOnly`                                                              | `boolean`                                        | `false`      | Disable graph gestures and edits; toolbar navigation remains available                            |
| `editable`                                                              | `boolean`                                        | `false`      | Enable inline node label editing                                                                  |
| `parentNodeStyle`                                                       | `ParentNodeStyle`                                | —            | Compound-node fill, border, padding, and label defaults                                           |
| `selectionToolbar`                                                      | `SelectionToolbarConfig \| false`                | —            | Customize palette and hidden controls, or disable selection tools                                 |
| `nodeOverlayActions`                                                    | `NodeOverlayAction[]`                            | —            | Actions in node hover overlay                                                                     |
| `renderNodeOverlay`                                                     | `(props: NodeOverlayProps) => ReactNode`         | —            | Custom node hover overlay                                                                         |
| `renderSelectedNodeToolbar`                                             | `(props: SelectedNodeToolbarProps) => ReactNode` | —            | Custom multi-select toolbar                                                                       |
| `renderSelectedEdgeToolbar`                                             | `(props: SelectedEdgeToolbarProps) => ReactNode` | —            | Custom edge selection toolbar                                                                     |
| `renderBottomBar`                                                       | `(props: BottomBarRenderProps) => ReactNode`     | —            | Replace the bottom bar                                                                            |
| `customViews`                                                           | `Record<string, ComponentType>`                  | —            | Override node views                                                                               |
| `disableKeyboardShortcuts`                                              | `boolean`                                        | `false`      | Disable built-in keyboard shortcuts                                                               |
| `isZoomMode`, `isMultiSelectMode`, `isDragMode`, `isEdgeHandlesEnabled` | `boolean`                                        | —            | Externally controlled interaction modes                                                           |

Use `$collapsed: true` to collapse a JSON branch, and `false` to keep the expansion control. Automatic depth-based collapse is not part of the current API.

`nodeAlignment: "leading"` aligns left edges in `LR`/`C`, right edges in `RL`, top edges in `TB`, and bottom edges in `BT`. `"trailing"` aligns the opposite edge. Node dimensions and graph connections are unchanged; containers and edge paths follow the aligned positions.

## JSON Streaming And Playback

`createJsonStream` accepts incremental `append(chunk)` or cumulative
`snapshot(text)` input. Supply `parse`, `repair`, `preview`, and `commit`
callbacks: repaired previews are throttled, while `finish()` strictly parses the
original JSON before committing. `cancel()` clears pending work. The defaults
are a 150 ms preview interval and a 1 MiB input limit. The host supplies its
repair library, such as `jsonrepair`; the SDK has no model or transport dependency.

`createJsonPlayback` reuses that buffer for a saved document:

```ts
const player = createJsonPlayback({
  ...streamOptions,
  source: JSON.stringify(document),
  onChange: ({ position, total, playing }) =>
    updateProgress(position, total, playing),
  onError: reportError,
});
player.play();
player.pause();
player.seek(0);
player.dispose();
```

Playback defaults to eight seconds, supports resuming and replaying, and reports
character offsets for a progress slider. Use `projectJsonPlaybackPreview(partial,
document)` when replaying Squeed JSON to keep structured metadata such as `$state`
references atomic. Keep previews separate from saved documents. SDK Test includes
a themed top-right player that reveals connections with their endpoints and
automatically fits every new layout without modifying the saved document.

## Custom Node Editing

Custom views replace the node renderer. Wrap custom visuals in the exported
`NodeView` to reuse SDK selection, multi-selection, overlays, and collapse
controls. Use `EditableLabel` for the standard inline editor, including
read-only handling and `onNodeLabelChange` notifications.

```tsx
import { NodeView, EditableLabel } from "@squeed/flow-sdk";
import type { FlowDiagramNode } from "@squeed/flow-sdk";

function CustomNode({ data }: FlowDiagramNode) {
  return (
    <NodeView data={data}>
      {({ isActive, isEditing, onEditStart, onEditEnd }) => (
        <div
          data-flow-node-surface=""
          data-selected={isActive}
          style={{ width: 240, height: 160 }}
        >
          <EditableLabel
            nodeId={data.id}
            label={data.label ?? "Custom"}
            color={data.viewProps?.textColor ?? "gray.900"}
            isEditing={isEditing}
            onEditStart={onEditStart}
            onEditEnd={onEditEnd}
          />
        </div>
      )}
    </NodeView>
  );
}
```

Register the component under its node type in `config.customViews`. Do not stop
click propagation on the visual surface or maintain a separate selection state.
The custom renderer must apply the styling fields it supports, such as
`data.viewProps.bgColor`, `borderColor`, `borderWidth`, and `outline`, to its
HTML or SVG. Raw-graph callbacks must update node data; JSON mode persists edits
through `onJsonChange`. The wrapper does not change custom SVG geometry.

Mark the visible shape with `data-flow-node-surface`, excluding captions and
form summaries. For SVG views, put it on the closed geometry element (such as
`circle`, `polygon`, or `path`), not the surrounding `svg`. Connectors, draw
handles, and animated borders use that surface; layout still reserves the full
node bounds. In `TB` and `BT`, ordinary icon-label connectors also reserve the
caption below the icon, so paths and arrowheads do not cross wrapped labels or
subtitles. Horizontal connectors still attach to the icon surface. Unmarked
custom views retain rectangular host bounds.

Node edit attribution is opt-in: provide `callbacks.getNodeEditMetadata()` returning
`{ userId, name, at }` from the editing session (`at` is an ISO timestamp).
JSON node edits persist it as `$edited`; raw graphs store the same object in
`data.config.edited`. Existing `$subtitle` text is preserved. The shared `NodeView`
renders the editor and relative time using one shared minute timer, including for
read-only viewers of the saved document. No-op edits leave the timestamp unchanged.
Use `stampNodeEdit(json, address, metadata)` for custom node commit handlers.
Metadata is display information, not an authorization or tamper-proof audit record;
remote mutations must supply their actual editor, never the receiving viewer.

Edge-label placement is scoped to each canvas and skips empty label layers.
The existing placement is reused while node bounds, edge paths, and label
dimensions are unchanged. Geometry changes and font loading recheck placement;
unrelated updates do not resample SVG paths. This does not change JSON loading,
repair streaming, or playback.

For content and custom-shape views, use `<FlowPort id="tools" role="source"
side="bottom" position={0.5} />` inside the node. `side` accepts `top`, `right`,
`bottom`, or `left`; `position` ranges from 0 to 1 and defaults to the midpoint.
Top/bottom positions run left to right; left/right positions run top to bottom.
The handle and connector attach to the marked outline, including SVG slopes.
These ports work in Auto and Properties modes. Omitting
`side` retains the existing property-row behavior.

Built-in views accept the same declarations in `data.config.ports` or JSON
`$ports`, for example `[{ "id": "prompt", "role": "target", "side": "top" }]`.
An optional `label` changes a port's display text without changing its `id`:
`{ "id": "output:resource", "label": "output", "role": "source", "side": "right" }`.
The same `label` prop is supported by `FlowPort`. Workflow interfaces can declare
it with `/** @port output resource "output" */`; the optional label is a quoted
JSON string. Connections continue to use `sourceProperty: "output:resource"`.
Connections identify these ports using `sourceProperty` and `targetProperty`.
Read-only mode and disabled edge handles continue to prevent dragging.

`config.edgeMode` controls visibility: `"auto"` (default) shows both normal
node edges and property/port edges; `"nodes"` shows only edges without property
endpoints; `"properties"` shows only edges with `sourceProperty` or
`targetProperty`. `"workflow"` remains an alias for `"nodes"`. Switching modes
does not remove saved edges or change the graph used for layout by default.

Set `config.compactPropertyLayout: true` to re-layout and fit only visible
nodes and edges in Properties mode and in isolated views (including Auto and
Nodes modes). Hidden nodes and connections no longer reserve layout space or
influence edge routes. This flag defaults to `false`; SDK Test enables it.
The expanded bottom toolbar includes the labelled **Compact layout**
icon toggle in Auto, Nodes, and Properties modes. In SDK Test it follows
**Connected nodes** and stays in sync with the Layout-panel pill.
The SDK manages the toggle locally when `config.compactPropertyLayout` is
omitted. For controlled usage, handle
`callbacks.onCompactPropertyLayoutChange(enabled)` and update the config flag.
Leaving Properties mode or restoring an isolated view restores the applicable
full layout. Saved graph data is unchanged. Without the flag, isolation keeps
the existing node positions.

## Bind Your Own Data

Start with the [minimal properties example](examples/form-connection/README.md):
two nodes, plain state, one binding, and a three-field interface. Its
[React component](examples/form-connection/MinimalExample.tsx) shows the complete
setup, including form edits, display references, appearance, and connection modes.
No workflow backend is required.

Then try **Shared Configuration** and **Reusable Property** in SDK Test's Templates
menu. The [small-step walkthrough](examples/configuration-basics/README.md) shows
two consumers sharing values, editing them, and exporting plain data, before
introducing field-level mapping and returning values inline.

## Connect Your Execution Backend

Property schemas and bindings edit data; they do not execute it. Use
`createWorkflowExecution(adapter, onChange)` to submit that data through your
own API and receive normalized step progress and output:

```ts
import { createWorkflowExecution } from "@squeed/flow-sdk";
import type { WorkflowExecutionAdapter } from "@squeed/flow-sdk";

const adapter: WorkflowExecutionAdapter<MyWorkflow> = {
  execute: async ({ input, executionId, signal }) => {
    const response = await fetch("/api/workflows/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow: input, executionId }),
      signal,
    });
    if (!response.ok) throw new Error(`Execution failed: ${response.status}`);
    return await response.json();
  },
  subscribe: ({ executionId, signal }, receive) =>
    feedback.subscribe(executionId, receive, signal),
};

const execution = createWorkflowExecution(adapter, setRun);
await execution.run(workflowState);
```

`MyWorkflow`, `feedback.subscribe`, and `setRun` above are supplied by your
application. Map your API response and feedback to `WorkflowExecutionUpdate`:

```ts
receive({
  executionId,
  step: { id: "fetch", status: "completed", output: { count: 3 } },
});
receive({ executionId, status: "completed", output: { result: "ready" } });
```

- `subscribe` must resolve with an unsubscribe function only after feedback is
  ready. Execution starts afterwards, so early events are not lost. SSE,
  WebSockets, and polling can all implement this adapter.
- Your backend must use or correlate the supplied execution ID. Responses may
  return an update, or nothing for an acknowledgement. Completion comes from
  an explicit terminal status, not merely a successful HTTP response.
- `onChange` receives run status, per-step status/output, and final output.
  Use your bindings to map step IDs to node IDs and update your diagram or
  output panel; the controller does not mutate the workflow or canvas.
- A second run is rejected while one is active. Terminal updates release the
  listener. Errors before terminal feedback reject `run()` and emit a failed
  state; handle the rejection. Terminal feedback takes precedence over late
  HTTP responses or errors. Each `run()` resolves with its own execution state.
- Step updates merge with the previous step: omitted output/error fields are
  preserved; explicitly passing `undefined` clears them.
- Supply `adapter.cancel` to support `execution.cancel()`. Call
  `execution.dispose()` on unmount to abort local requests and unsubscribe;
  disposal does not cancel the remote job.
- Keep service credentials in your backend. The SDK does not select a server,
  forward Squeed credentials, or translate workflows into another tool's format.

This API is for SDK hosts. It does not automatically wire the Squeed editor's
Execution panel or its Backflow-specific execution mapping.

## Maintainer Guide

The SDK Test **Form Connection** dataset loads
[examples/form-connection/ui.json](examples/form-connection/ui.json), its
[bindings](examples/form-connection/bindings.json), and the actual
[TypeScript interface](examples/form-connection/interface.ts). Double-click
**Generated Form** to edit the separate state shown by the State JSON node.
The test page preloads the bundled interface; manual uploads can replace it.

**Config Catalog** covers all 25 enabled Backflow step types with independently
bound, reusable configuration nodes. The full editor interface retains all
138 declared config fields, including JSON and dictionaries. This is form
coverage, not production execution validation. See the
[coverage and readiness checks](examples/workflow-form/README.md).

**Workflow State 2** loads the supplied
[Run Cast Session workflow](examples/workflow-state-2/workflow.json) as a
separate local dataset, with 16 step forms and 23 reusable tools. Its
[view generator](examples/workflow-state-2/example.ts) renders all tools in one
Object View node, with a distinct output port and connection identity per tool.
Its `portResources` binding maps those ports to individual state entries.
Forms edit `config`; the original `params`, `input`, and other
workflow fields are retained independently. Dependency links initialize the
view from `dependsOn`; diagram edits are not a production deployment adapter.

SDK Test's **Forms** popover exposes **Reusable configuration** after an
interface upload, or when a static mapping is configured. Choose an interface
and check the inline fields to lift into resource nodes. Object values use
Object View; compact form-bound nodes expose a floating dot to reveal their
properties, and the object header dot returns to the icon.

SDK Test fits the switched node or parent after layout completes. Its
`focusOptions` prop controls both click focus and dot-switch focus:

```tsx
<SDKTest focusOptions={{ animate: true, padding: 90 }} />
```

These are the defaults; `animate: false` makes the fit immediate, and `padding`
is in screen pixels. The SDK itself does not auto-focus on dot switches.
`callbacks.onNodeViewToggle(nodeId)` notifies a client of a dot action; clients
can queue `engine.focusNode(nodeId, padding, animate)` for `onLayoutComplete`.

Object rows with an empty string value and an attached property connection
show a full-width label without an empty value cell. Other fields retain both
columns, and row order, port identities, and saved values are unchanged.

The [mapping adapter](examples/workflow-state/resourceMapping.ts) uses the same
JSON-serializable definition for static setup and popover edits:

```ts
const resourceMappings = {
  "workflow-state-2": {
    version: 1 as const,
    templates: true,
    fields: [
      { type: "LlmConfig", field: "prompt" },
      { type: "LlmConfig", field: "model", createEmpty: true },
      { type: "DatabaseConfig", field: "data" },
    ],
  },
};

<SDKTest resourceMappings={resourceMappings} />;
```

These are also the static defaults for Workflow State 2. An empty Model resource
does not add a model value to exported configuration until configured. Resource
forms retain their source interface through `StateFormBinding.schemaType`, so
reuploading the original interface does not require generated type declarations.
The popover imports/exports mapping JSON and exports a resolved workflow;
unmapping restores current resource values inline. Existing annotated resource
ports stay separate from user-selected inline mappings.

`templates` exposes runtime variables as Object View nodes and links step-output
references to their consuming property rows. Expressions are parsed, never
evaluated or rewritten; both sides of fallback expressions are represented.
Collapsing a node retains its links, and deleted template links are not restored
merely by rerendering. Runtime variable values are not fabricated.

[examples/squeed.json](examples/squeed.json) is an expandable diagram for new
maintainers: setup, architecture, data ownership, UI code, change recipes,
testing, workflow contracts, and SDK Test integration. Load it through the
`json` prop; the local Backflow admin SDK Test page includes it as **squeed**
alongside **advanced**. Its **File Map** chapter links concrete source files
with labeled runtime imports, type-only dependencies, re-exports, and tooling
relationships. **Trace a Change Across Files** explains callback/data flow and
ownership separately. The map covers important internal relationships, not every
external dependency. Tests verify mapped paths and import/export arrows against
the source tree. Edit this single JSON source to keep the guide current.

## Callbacks

`isNodeVisible(id, edges, edgeMode)` exposes the same edge-mode visibility rule
used by Canvas. Pass edge data, not `{ data }` wrappers. In property-edge mode,
`root` is hidden unless it has a property connection; other modes retain it.
Hosts measuring embedded content can filter with this predicate before waiting
for node boxes. It does not report measurement readiness or connection isolation.

### All Icon-Label Views

Inside a diagram, `useNodeViewActions()` (or `useFlowDiagramContext()`) exposes
`allNodesIconLabel` and `setAllNodesIconLabel(boolean)`. The bulk action reuses
`setNodeViewMode(id, "icon-label")` for objects/arrays and `onNodeCollapse` for
parents. Disable it to expand icon-label defaults into property views, restore
other default object views, and reopen parents. Dots use
the same per-node actions and remain interactive; there is no global view lock.
`allNodesIconLabel` reflects the current node modes.

For non-parent Object nodes with Markdown, HTML, or JSX `$content`, the expanded
header dot reuses `setNodeViewMode(id, "icon-label")`. It does not switch to an
empty properties header. Reopening reuses `restoreNodeView` and the existing
header/content rendering; the content source and parent-collapse behavior are
unchanged.

An explicit `$label: ""` on HTML/JSX content omits the expanded content header
and its dot. The node sizes to the preview's intrinsic width, capped at the
viewport width minus 40px, and grows or shrinks with the content height instead
of using the property-table minimum and fixed 360px preview height.
Explicit custom widths remain supported; Fill and fullscreen use their allocated
dimensions. HTML auto-height uses a nonce-protected measurement script and accepts
size messages only from that preview's iframe. Content scripts remain sanitized
out, and same-origin access remains disabled.
Internal HTML/JSX styling remains authoritative. Missing labels, named content,
Markdown and properties views retain their headers and sizing. Use
`$borderRadius: 0` independently for square corners. Existing content source and
fullscreen controls remain available.

### Live JSX Content References

Inside JSX `$content`, a value can reference another node's JSX content:

```json
{
  "type": "text",
  "text": {
    "$contentRef": "root.navigation",
    "path": [0, "children", 1, "text"]
  },
  "rawStyle": { "fontSize": "28px" }
}
```

`path` is relative to the source node's `$content` array. Omitting it references
the whole array, for example `"children": { "$contentRef": "root.header" }`.
Referenced values retain their types; arrays are not implicitly flattened.
Optional literal `prefix` and `suffix` strings format string values, such as
keeping an image gradient before a referenced CSS image URL. No code executes.

References resolve within the current document at compilation. Updating the
source updates the rendered consumer; source JSON and the consumer's other
styles remain unchanged. The source editor preserves reference JSON rather than
saving the resolved copy. To detach a value intentionally, replace its reference
with a literal. Ordinary `$target` edges remain connections, not content bindings.
Index paths refer to positions: update them when restructuring source components,
or reference a whole children array when its membership should follow the source.

Only JSX sources are supported. Missing paths, cycles, unsafe property names,
and expansion beyond 100 levels or 100,000 visits produce an error in the affected
preview rather than aborting the graph. References do not fetch external data or
cross document ownership boundaries.

In `FlowDiagram`, enabling the bulk action also suspends `forms.structured`:
generated detail nodes and structured form lists disappear without changing the
workflow data. Disabling it restores the configured `forms.structured` setting
and the generated nodes' default views. An initially false or omitted setting
stays disabled. Individual node-view actions do not change this setting.

`NodeViewMode` supports `"default"`, `"properties"` and `"icon-label"`; controlled
consumers continue using `config.nodeViewModes` and `onNodeViewModeChange`.
Dot-triggered selection includes `NodeSelectionModifiers.viewToggle: true`;
ordinary selections omit it. The dot invokes `onNodeViewToggle` before changing
the view so a host can queue geometry-aware focus without first focusing the
compact node. SDK Test centers the opened node using its existing default focus
padding; ordinary clicks still honor Include children. The layout scheduler
coalesces measurements and does not restart a pending focus for identical
destination geometry.
Parent changes follow the host's existing collapse persistence behavior. The
name `collapsed` remains reserved for child-collapse behavior, not object view
modes. `onAllNodesIconLabelChange` reports bulk actions. The bottom toolbar exposes
**Collapse all** immediately after **Compact layout**; SDK Test also exposes
the action as **All icon labels** under Visibility and fits the resulting layout.

### Reusable Nodes From Property Draws

SDK Test's **Blank Workflow** starts with zero nodes, steps and resources. The
canvas **Create node** button opens the existing reusable-node picker without a
source port. It creates one standalone step with an empty configuration and no
connection. Subsequent nodes can be created by dragging ports into empty canvas;
these use the same picker and the existing typed-port and dependency mapping.
Canceling the picker does not change the graph. No example workflow is imported.

SDK Test opens a reusable-node picker when a Properties-mode draw ends on empty
canvas. It reuses `NodeFormPopover` with a top filter, a fixed-height scrolling
list and the form vignette. Items use the current JSON bindings, interfaces and
icons; incompatible ports are disabled and multiple compatible ports can be
selected explicitly. Closing the modal makes no changes.

`callbacks.onNodeCreateRequest(request)` lets a host defer creation by returning
`true`. The request contains `sourceNodeId`, `sourceProperty`, `reverse` and the
model-space `position`. A workflow template creates a new step through the
configured collection/identity/dependency fields; an existing reusable retains
its shared state and connection. Node-mode drawing is unchanged.

Default Set and Array draws label new entries `Untitled 1`, `Untitled 2`, and
so on, using the next unused number among the parent's existing labels. Both
modes share that sequence. JSON keys such as `node_1`, `list_1`, and numeric
array indexes remain unchanged; the display name is stored in `$label` and
survives serialization. Existing names and form-generated labels are preserved.
Set mode creates one entry. The first Array draw from a source creates two
siblings in one update; later draws create one, including after reload.

After layout, `engine.setNodePosition(id, position)` places a measured node at
the draw endpoint without changing viewport zoom or pan. This renderer-local
placement is retained across relayouts while the node remains rendered; pass
`undefined` to release it back to automatic layout. It is not serialized into
the workflow document.

Use `engine.setNodePosition(id, position, { persist: false })` for an initial
drop placement that settles into the size-aware automatic layout. The example
creation picker uses this mode so object expansion, property edits, and the
spacing slider can reposition new nodes without retaining their drop positions.

### Node Collisions

Collision handling is opt-in through `FlowEngine`; the SDK does not automatically
resolve overlaps or enable node dragging. Call after measurement/layout (for
example from `onLayoutComplete`) or after explicitly placing nodes:

```ts
const collisions = engine.detectNodeCollisions({ margin: 15 });
const result = engine.resolveNodeCollisions({ margin: 15, animate: true });
// result: { positions, movedNodeIds, collisions, iterations, resolved }
```

`detectNodeCollisions` does not change state. It returns pairs with `source`,
`target`, and `overlap: { x, y }`, using axis-aligned measured bounds and a gap
of `margin` model units (default 15). Only visible layout nodes participate.
Siblings are compared at every hierarchy level; parent-child containment is
intentional, and conflicts between branches are reported as container pairs.
Container padding and label minimum width are included, but edge paths and
edge-label collisions are outside this API.

Resolution moves sibling groups with their descendants, preserving nodes pinned
by `setNodePosition` with persistent placement. A group containing a pinned node
cannot be translated. It uses at most `maxIterations` (default 50, allowed 0-1000)
and reports remaining collisions rather than moving pinned nodes or looping
indefinitely. Invalid margins/iteration limits throw `RangeError`.

`positions` is an independent map of target leaf positions, not animation progress;
`movedNodeIds` lists changed leaves and `collisions` lists unresolved target pairs.
`animate` defaults to true and reuses the layout animation driver; reduced motion,
`config.disableAnimations`, and performance mode apply immediately. Pan/zoom stays
unchanged, pending automatic viewport actions are cancelled when nodes move, and
resolution does not emit `onLayoutComplete` again. Another layout or explicit
position change can interrupt it. Results are renderer-local, are not pinned or
written into JSON, and may be replaced by the next automatic layout.

### Swappable Grid Mode

One graph-level call hides edges, edge labels, collapse icons and connection handles, arranges
visible nodes in a measured grid, then enables drag-to-swap after placement:

```ts
engine.setNodeGridMode(true, { columns: 3, margin: 40, animate: true });
engine.swapGridNodes(sourceId, targetId); // Optional programmatic swap
engine.setNodeGridMode(false); // Restore pre-grid positions and edge visibility
```

Drop a node onto a sibling's center to exchange their slots. Drop near its left
or right edge to insert into that row, or near its top or bottom edge to add a
row. An insertion line previews the destination without saving until release.
The insertion target extends 24 screen pixels outside the edge, including when
zoomed out or embedded in a scaled parent. Interior targets remain capped at a
quarter of the node dimension; the insertion line stays 3 screen pixels thick.
Start the drag on a title, icon, or non-interactive surface; embedded editors and
form controls retain their own pointer behavior.
Dropping outside the canvas or pressing Escape cancels the drag. Shift-drag
continues to use the host's transfer/grouping callback. A valid ordinary boundary
insertion takes priority over that callback, so a Grid member can be a sibling
insertion target without transferring the dragged node into its document.
Read-only mode prevents swaps and insertion. The original JSON, edges
and parent relationships are not changed. Sibling grids preserve parent groups;
swaps across parents are rejected. Sibling sets containing persistent pinned
nodes are not rearranged or swapped. Grid order survives layout/size changes
while the mode is active. It is renderer-local and is not saved in the document.

Explicit row membership uses
`options.adjustment.sections[sectionId].members: string[][]`, with `canvas` for
top-level siblings and the parent node ID for nested sibling groups. It applies
with or without Fill and independently of adjustment-handle visibility. Existing
rows retain their relative membership; newly arriving nodes use the column
setting for additional rows and missing nodes are omitted. Member IDs must be
nonempty strings, unique within a section. Row and column proportions continue
to use the existing `rows` and `columns` arrays. Hosts can persist the updated
options through their existing canvas configuration save path, as Squeed does.

The bottom toolbar's **Collision mode** button uses this same API. While active,
it shows the existing compact gap slider and a **Fill** toggle. These controls
stay synchronized with programmatic mode changes.

`columns` defaults to `ceil(sqrt(siblingCount))` without fill; `gaps` accepts a
number or `{ x, y }`, falling back to `margin` (15 model units). `animate` defaults
to true; reduced motion and the animation kill switch are respected. Ordinary
grid entry and exit center and fit with 80px viewport padding using the same queued
fit as direction changes, coordinated with placement and subsequent size updates.
Manual pan/zoom cancels the queued fit. Gap changes and swaps preserve zoom/pan.
Fill retains its separate tile padding and 1:1 viewport behavior.
For arrangement without hiding edges or enabling swaps,
use `engine.arrangeNodesInGrid(options)`, which returns `positions`, `movedNodeIds`,
`skippedNodeIds` and remaining `collisions` without changing graph data.

```ts
engine.setNodeGridMode(true, { fill: true, gaps: 0 });
```

Fill resizes the existing node tiles to cover the canvas, not just their positions.
It picks columns from the canvas aspect ratio and expands the final row to avoid
empty cells. `padding` defaults to 0; gaps are constrained when needed to keep cells
positive. Fill uses a 1:1 viewport (subject to configured zoom limits), with size,
position and viewport animation coordinated. It reflows on canvas resize and keeps
swapping enabled. Turning Fill off restores natural node sizes and queues an 80px
center-and-fit; exiting the mode
centers and fits the restored graph. `arrangeNodesInGrid` returns target `sizes`
and `bounds` when filling. These overrides never change the saved document.

On initial Fill load, the canvas measures the visible destination and uses the
existing Fill calculation to allocate cells before mounting node content. This
skips the preliminary natural-view mount and initial layout debounce. Hidden
destinations wait until measurable; weighted rows, spacing, nested loading,
saved viewports, subsequent resizing and natural sizing on exit are preserved.
Document preparation still uses its existing two-frame loading gate.

### Animated Viewport Actions

Capture `FlowEngine` through `callbacks.onInit`. Set `config.animateViewport`
to animate viewport actions by default, or pass a boolean per call:

```ts
engine.fit(60, true);
engine.centerAndFit(60, true);
engine.center(true);
engine.focusNode(nodeId, 60, true);
engine.focusBranch(nodeId, 60, true);
engine.isolateBranch(nodeId, 60, true);
engine.restoreView(true);
```

Pass `true` as the fourth argument to `focusBranch`, `focusNode`, or
`focusConnections` after a view toggle to fit the new geometry together with
the layout animation. Existing three-argument calls keep their behavior.

`focusBranch` accepts `centerOnNode` as its fifth argument and `zoomScale` as
its sixth (default `1`). For example,
`engine.focusBranch(nodeId, 40, true, false, true, 0.6)` keeps the selected node
centered and applies 60% of the fitted zoom, subject to existing zoom limits.
Omitting the scale preserves the previous branch fit.

For a closing preview in an ordinary document canvas, use
`engine.restoreView(true, savedViewport, true)` alongside the view change.
The optional third argument restores the saved viewport in the same transition
as the closing layout. It does not change Grid/Fill or isolation restoration;
existing one- and two-argument calls retain their behavior.

Animation defaults to false. Explicit false overrides the config default.
Transitions interpolate pan and zoom over 300ms; center preserves zoom.
Reduced-motion preferences disable animation. New viewport commands cancel
previous transitions, and unmount cancels pending frames. Methods return when
dispatched, not when animation finishes; `onViewportChange` reports intermediate
and final positions. Use `onLayoutComplete(engine)` to fit newly laid-out data:

```tsx
<FlowDiagram
  config={{ animateViewport: true }}
  callbacks={{ onLayoutComplete: (engine) => engine.centerAndFit(60) }}
/>
```

This callback runs after each settled layout, not viewport-only changes. Hosts
that only want to fit after dataset selection should gate it with a pending flag.

For a view change that should move nodes and the viewport together, call
`engine.centerAndFit(60, true, true)` before changing direction, compact layout,
or node presentation. The third argument defers fitting until target geometry
is available, using the layout's 300ms animation progress rather than a second
fit from `onLayoutComplete`. `focusNode` and `focusConnections` accept the same
option as their fourth argument. Manual zoom and pan cancel viewport motion.

Set `config.disableAnimations: true` to disable SDK layout, viewport, node/edge
effects, reveal, and in-diagram CSS transitions. It defaults to `false` and takes
precedence over `animateViewport` and per-action `true` arguments. Active motion
lands on its target; changing the flag back to `false` restores configured
animations. Embedded content and application-owned playback are not controlled
by this flag.

### Structured Form Bindings

Set `forms.structured: true` with `forms.state`, `forms.bindings` and
`config.formSchema` to author nested objects and arrays through flow nodes.
Use `config.edgeMode: "properties"` for their input and output handles.
This is opt-in; existing form consumers keep their current controls.

Objects expose typed scalar fields and nested configuration ports. Arrays have
ordered item nodes with add, remove and move controls. Open dictionaries expose
property-name and value-type controls. JSON and mixed-type values have typed
value nodes instead of JSON textareas. Existing resource option selectors remain
available. Missing optional values are not created until the user adds them.

Dragging an empty configuration port into space creates its value node.
Connecting a compatible value node to another field copies the value into that
field; it does not create a shared reference. Subsequent edits are independent.
Deleting an ownership edge or generated node removes the value; array deletion
compacts the remaining indices. Reordering changes index-based item identities.
All edits use `forms.onStateChange` (or `onChange`) and preserve the original
inline state/export shape. Read-only diagrams disable these mutations.

Generated nodes, ports and schemas are derived, not written into your view JSON;
their appearance is inherited rather than saved through document style callbacks.
Existing explicit bindings at the same state address are reused. Projection is
limited to 24 levels and 512 form nodes, using the SDK's existing safe dot-path
property addressing. Custom `renderForm` implementations remain host-owned.

### Compose Your Own Controls

### Upload Form Fields

Set `$control: "upload"` in `forms.bindings[nodeAddress].fields` (or the
document node's `$form.$fields`). A `string` property is a single-file field;
an `array` of strings is a multiple-file field. Values are stored URLs, never
`File` objects or temporary browser blob URLs. Upload arrays remain inline
controls even with `forms.structured: true`.

```tsx
const formSchema = {
  Attachments: {
    kind: "object",
    properties: {
      cover: { type: { kind: "string" }, optional: true },
      files: {
        type: { kind: "array", items: { kind: "string" } },
        optional: true,
      },
    },
  },
} satisfies FormSchema;

<FlowDiagram
  json={{ attachments: { $label: "Attachments", $view: "object" } }}
  config={{ formSchema, editable: true }}
  forms={{
    state,
    bindings: {
      "root.attachments": {
        address: "root.record",
        type: "Attachments",
        fields: {
          cover: {
            $control: "upload",
            $upload: { accept: "image/*", maxSizeBytes: 5_000_000 },
          },
          files: { $control: "upload", $upload: { accept: "image/*,.pdf" } },
        },
      },
    },
    onStateChange: setState,
  }}
  callbacks={{
    uploadFormFile: ({ file, address, nodeAddress, data, signal }) =>
      uploadToStorage(file, { address, nodeAddress, data, signal }),
  }}
/>;
```

`uploadToStorage` is your host's uploader, not an SDK service. The callback
receives a `FormUploadRequest` (file, field/node addresses, optional node ID,
read-only form data, and an abort signal) and must return an HTTP(S) file URL
without embedded credentials, synchronously or as a promise. The app's
`SDKTest` surface accepts the same optional `uploadFormFile` prop. No storage
endpoint, credentials, or automatic upload service is supplied.

Empty fields show a dashed rounded square with a centered plus; click or drop
files to upload. Single-file fields replace that square with one preview and
replace/remove controls. Multiple-file fields append previews in selection
order and retain an add-more square. Non-image files have a file-link fallback.
Uploading disables mutations on that field; failed batches preserve its prior
value. Closing the form, changing the bound value, or disabling editing aborts
pending work and ignores late results. Hosts should honor `signal` and handle
cleanup of files already stored during a failed/cancelled batch. Removing a URL
changes form data only; it does not delete the server file. File type/size checks
are optional client checks and must also be enforced by the host/server.

### Compose Your Own Controls

All reusable control components are exported from `@squeed/flow-sdk` through
[src/index.ts](src/index.ts). Hide the default toolbar with `showBottomBar={false}`
and mount your controls as children to share the diagram and form providers:

```tsx
import {
  FlowDiagram,
  WorkflowControls,
  DiagramAppearanceControls,
  SvgExportButton,
  ToolbarDivider,
} from "@squeed/flow-sdk";

<FlowDiagram
  json={view}
  forms={forms}
  callbacks={callbacks}
  showBottomBar={false}
>
  <div
    style={{
      position: "absolute",
      bottom: 20,
      left: 20,
      right: 20,
      display: "flex",
      alignItems: "center",
      overflowX: "auto",
      zIndex: 100,
    }}
  >
    <WorkflowControls />
    <ToolbarDivider />
    <DiagramAppearanceControls />
    <SvgExportButton />
  </div>
</FlowDiagram>;
```

| Category           | Public exports                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toolbar primitives | `ToolbarIconButton`, `ToolbarTooltip`, `ToolbarDivider`, `ToolbarSelect`, `ToolbarScrollContainer`, `TooltipIconButton`, `ToolbarCommitInput`, `ToolbarCloseButton` |
| Selection controls | `NodeTools`, `EdgeTools`, `Swatches`, `NodeBorderRadiusControl`, `NodeIconPicker`, `DEFAULT_PALETTE`, `TEXT_PALETTE`                                                |
| Control groups     | `BottomBar`, `WorkflowControls`, `DiagramAppearanceControls`, `SvgExportButton`                                                                                     |
| Forms              | `NodeForm`, `NodeFormPopover`, `NodeConfigSummary`, `FormDocumentContext`                                                                                           |
| Composition        | `FlowDiagramProvider`, `FlowView`, `useFlowDiagramContext`, `useFlowData`, `FlowDiagramContextValue`                                                                |
| Feedback           | `ErrorToast`                                                                                                                                                        |

`ToolbarSelect` accepts optional `pinned` (default `false`), `open`, and
`onOpenChange` props. Pinning disables native outside-click dismissal and keeps
standard option selections open, preserving the existing DOM, position, scroll,
and focus. The trigger and Escape still close it explicitly. Custom
`popupContent` owns its selection-close behavior. With `popupContent` and
`footer`, the footer stays outside the scrolling content. Omit the new props
to retain the existing uncontrolled dropdown behavior.

Use `useFlowDiagramContext()` inside a child component for mode setters,
selection, bound edit callbacks and `engineRef`; `useFlowData()` supplies node
and edge lookups. Its maps are read-only by convention: do not mutate them.
Standalone controls outside these providers cannot access a diagram. For an
external DOM toolbar, render a React portal from a child component so context
is preserved. `SvgExportButton` needs a DOM ancestor with `data-flow-diagram`,
so use the public `exportSvg` helper when your export button is portaled outside it.

`FlowDiagramProvider` plus `FlowView` supports advanced raw-graph composition;
it does not compile JSON or create form state. Prefer `FlowDiagram` children
for document mode. Context mode setters do not override explicitly controlled
config props; the host must update those props. Selection setters change state
only; invoke selection callbacks explicitly if your custom UI requires them.
`NodeTools`/`EdgeTools` receive selected IDs and an `onClose` handler. Their
edit actions use bound callbacks, preserving document-mode updates.

The main toolbar's individual mode buttons remain part of `BottomBar`; compose
equivalent buttons with `ToolbarIconButton` and the context setters. Appearance
sliders are exposed together through `DiagramAppearanceControls`.

### Named Ports In Custom Views

Use `FlowPort` inside a custom node component with `config.edgeMode: "auto"` or `"properties"`
and `config.edgeHandles: true`. Port IDs must be unique within a node.

```tsx
<FlowPort id="true" role="source">True</FlowPort>
<FlowPort id="false" role="source">False</FlowPort>
<FlowPort id="input" role="target">Input</FlowPort>
```

The engine measures each port row and supplies connection handles at the node
boundary. Outputs are on the right and inputs on the left, reversed in RL mode.
Top/bottom anchors are not supported yet. These ports do not require object
property rows or form state fields. Existing `sourceProperty`/`targetProperty`
edge fields carry the port IDs, including in `onEdgeCreate`. The host owns edge
persistence and any resulting workflow-state changes. Enable Draw mode to connect.

### Schema-Bound Node Creation

For independent workflow state, use the `forms` prop and external node bindings;
see [Independent Workflow State](examples/workflow-state/README.md). This keeps
form values outside the Squeed document and supports state-backed `$content`.
The `$form` document binding described here remains a legacy-compatible mode.

In legacy JSON mode, a selected form-bound node has a gear that opens its
configuration in a screen-sized dialog. The form resolves `$form.$type` using
`config.formSchema` or the **Upload workflow interface** control, which also
supplies connection validation. Nested objects and
non-enum arrays are edited as validated JSON; simple fields use inferred controls.

To create a typed item when drawing from a node into empty space, declare:

```json
{
  "workflow": {
    "$label": "Trigger",
    "$form": {
      "$type": "Workflow",
      "$create": {
        "$address": "root.workflow.steps",
        "$type": "Step",
        "$label": "Step",
        "$edgeLabel": "Next",
        "$defaults": { "name": "New step", "type": "conditional" }
      }
    },
    "name": "Orders",
    "trigger": "manual",
    "steps": []
  }
}
```

The schema must define `Workflow.steps` as an object array and expose `Step`.
Upload discovers both binding types. Creation appends to that array, gives a
string `id` field a UUID, copies the form/creation binding, and adds a labeled
`$connections` link from the source. One `onJsonChange` reports the new node.
Required fields receive initial values; strings may remain empty and require
configuration. `$defaults` supplies explicit initial values. Further draws from
the new step append siblings to the same destination. Untyped drawing is unchanged.
The link label does not execute sequence or if/else logic; those semantics remain
the host application's responsibility.

### SVG Download

The expanded toolbar's **Download SVG** icon exports the current graph view,
including HTML nodes, SVG edges and the background, without toolbar buttons or
drawing handles. Pan and zoom are preserved; off-screen content is not fitted
automatically. The exporter is loaded on demand.

For custom UI, call `downloadSvg(element, "diagram.svg")`, or use
`await exportSvg(element)` to obtain an SVG data URL. Pass the diagram's
`[data-flow-background]` element. The SVG embeds styled HTML via `foreignObject`:
it works in browsers but is not a pure-path SVG for every vector editor.
Remote images/fonts need accessible URLs and may be limited by CORS.

### Edge Shapes

Set `config.edgeType` to `straight`, `bezier`, `orthogonal`, or
`rounded-orthogonal` (default). `edge.data.type` overrides it for one raw edge.
Register custom SVG geometry factories in `config.customEdgeTypes`; their keys
also appear in the selected-edge toolbar's **Edge shape** menu.

Selecting a shape calls `callbacks.onEdgeTypeChange(edgeId, type)`.
Raw-graph consumers must update that edge's `data.type`; choosing **Default**
passes `undefined` to remove the override. JSON mode persists it automatically
through `onJsonChange`: `$edgeType` for hierarchy edges, `$targetEdgeType` for
`$target` links, and `type` on the selected `$connections` entry.
The selector follows `selectionToolbar.hide: ["style"]` and read-only mode.

Custom factories receive `edge`, node bounds (`source`, `target`),
`sourcePoint`, `targetPoint`, `direction`, property row positions, `inverted`,
and `defaultGeometry`. Return `{ d, label: { x, y, angle }, arrow? }` in model
coordinates; `arrow` is an optional filled SVG path. Return `null` to use the
default route. The SDK retains selection, colors, dash animation, and labels.

### Node Events

| Callback                   | Signature                                       | Description                                                                                      |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `onNodeSelect`             | `(nodeId, nodeData) => void`                    | Node clicked/selected                                                                            |
| `onNodeDeselect`           | `() => void`                                    | Selection cleared                                                                                |
| `onNodeDoubleClick`        | `(nodeId, nodeData) => void`                    | Node double-clicked                                                                              |
| `onNodeCreate`             | `(params) => void`                              | Node created via edge drawing into empty space                                                   |
| `onNodeDelete`             | `(nodeId, nodeData) => void`                    | Node deleted                                                                                     |
| `onNodeLabelChange`        | `(nodeId, newLabel) => void`                    | Node label edited inline                                                                         |
| `onNodeContentChange`      | `(nodeId, content: string) => void`             | Multiline content saved; raw-graph consumers store `data.config.content`                         |
| `onNodeAnimationChange`    | `(nodeId, animated: boolean) => void`           | Border animation toggled; raw-graph consumers store `data.isNodeAnimated`                        |
| `onNodeCollapse`           | `(nodeId, collapsed) => void`                   | Collapse toggle clicked                                                                          |
| `onNodeColorChange`        | `(nodeId, colorType, color) => void`            | Node color changed via toolbar                                                                   |
| `onNodeBorderColorChange`  | `(nodeId, color: string) => void`               | Border color picked; raw consumers update `data.viewProps.borderColor` (empty string resets)     |
| `onNodeBorderStyleChange`  | `(nodeId, "solid" \| "dashed") => void`         | Border style changed; raw consumers update `data.viewProps.borderStyle`                          |
| `onNodeBorderWidthChange`  | `(nodeId, width: number \| undefined) => void`  | Border thickness changed; raw consumers update `data.viewProps.borderWidth` (`undefined` resets) |
| `onNodeBorderRadiusChange` | `(nodeId, radius: number \| undefined) => void` | Corner radius changed; raw consumers update `data.viewProps.borderRadius` (`undefined` resets)   |
| `onNodeIconChange`         | `(nodeId, iconName) => void`                    | Node icon changed via toolbar                                                                    |
| `onNodeOutlineChange`      | `(nodeId, outline: boolean) => void`            | Outline toggled; raw-graph consumers store `data.viewProps.outline`                              |
| `onNodeHoverAction`        | `(actionId, nodeId, nodeData) => void`          | Hover overlay action clicked                                                                     |

### Edge Events

| Callback            | Signature                                                       | Description                                                                |
| ------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `onEdgeCreate`      | `(sourceId, targetId, properties?: FlowEdgeProperties) => void` | New edge drawn; optional `sourceProperty` / `targetProperty` identify rows |
| `onEdgeSelect`      | `(edgeId, edgeData) => void`                                    | Edge clicked/selected                                                      |
| `onEdgeDeselect`    | `() => void`                                                    | Edge selection cleared                                                     |
| `onEdgeRemove`      | `(edgeId, edgeData) => void`                                    | Edge removed                                                               |
| `onEdgeDelete`      | `(edgeId, edgeData) => void`                                    | User requested deletion                                                    |
| `onEdgeColorChange` | `(edgeId, color) => void`                                       | Edge color changed                                                         |
| `onEdgeLabelChange` | `(edgeId, label) => void`                                       | Edge label changed                                                         |
| `onEdgeStyleChange` | `(edgeId, "solid" \| "dashed" \| "animated") => void`           | Edge style changed                                                         |

### Diagram Events

| Callback            | Signature                                              | Description                                                           |
| ------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| `onViewportChange`  | `(viewport) => void`                                   | Pan/zoom changed                                                      |
| `onDirectionChange` | `(direction) => void`                                  | Direction changed via bottom bar                                      |
| `onArrayModeChange` | `(isArrayMode) => void`                                | Array/set mode toggled                                                |
| `onInit`            | `(engine: FlowEngine) => void`                         | Renderer handle initialized; node boxes become available after layout |
| `onJsonChange`      | `(next: SqueedJson, change: SqueedChangeInfo) => void` | Immutable document update                                             |

## JSON Conventions

Special `$`-prefixed keys control node rendering:

| Key                                 | Description                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `$label`                            | Display label for the node                                                                                  |
| `$bgColor`                          | Background color (Chakra token, e.g. `"blue.500"`)                                                          |
| `$textColor`                        | Text color                                                                                                  |
| `$borderColor`                      | Border color; accepts Chakra tokens, hex, or `"transparent"`                                                |
| `$borderStyle`                      | Border style; the toolbar toggles `"solid"` / `"dashed"`                                                    |
| `$borderWidth`                      | Nonnegative border thickness in diagram pixels; `0` hides the border, removing the key restores the default |
| `$borderRadius`                     | Nonnegative corner radius; `0` makes square corners, removing the key restores the default                  |
| `$outline`                          | `true` for an unfilled node with a border; `false` restores its saved fill                                  |
| `$content`                          | Markdown source, including an empty string; editable when `config.editable` is enabled                      |
| `$isNodeAnimated`                   | `true` for a clockwise circulating border stroke; independent of edge animation and off by default          |
| `$icon`                             | React Icons name, e.g. `PiGear`                                                                             |
| `$collapsed`                        | `true` to collapse children, `false` to force expanded                                                      |
| `$parent`                           | Parent node ID (creates compound/container nodes)                                                           |
| `$target`                           | Cross-link to a JSON address, e.g. `root.database`; one per source node                                     |
| `$connections`                      | `SqueedConnection[]`; multiple node/property mappings, independent of `$target`                             |
| `$sourceLabel` / `$targetLabel`     | Hierarchy-edge / cross-link label                                                                           |
| `$edgeColor`                        | Edge color                                                                                                  |
| `$isEdgeDashed` / `$isEdgeAnimated` | Dashed or animated edges                                                                                    |
| `$`                                 | Array value (creates array child list, e.g. `{ $: ["a", "b"] }`)                                            |

```json
{
  "$label": "Server",
  "$bgColor": "green.500",
  "$collapsed": false,
  "host": "localhost",
  "port": 3000,
  "routes": {
    "$label": "API Routes",
    "$collapsed": true,
    "users": "/api/users",
    "auth": "/api/auth"
  }
}
```

### Content And Node Animation

```json
{
  "runbook": {
    "$label": "Runbook",
    "$content": "## Recovery\n\n1. Check queue depth\n2. Restart workers",
    "$isNodeAnimated": true
  }
}
```

`$content` renders Markdown headings, lists, emphasis, tables, links, and fenced code. Supply Markdown source text, not a filename or URL to load. Raw HTML is disabled and unsafe link schemes are filtered.

For `$contentFormat: "jsx"`, supply a JSON array of declarative UI components,
not executable JSX source:

```json
{
  "panel": {
    "$view": "object",
    "$contentFormat": "jsx",
    "$content": [{ "type": "text", "text": "Hello" }]
  }
}
```

The host supplies `config.customViews.jsxContent`, a component receiving
`JsxContentRendererProps`: `{ components, colorMode, fillHeight }`. Squeed provides
`WorkflowContentRenderer`, which wraps the array in one `render_scene` step for
`UnifiedWorkflowRenderer`. The SDK does not import or depend on that renderer.
Without a supplied view, it displays an unavailable-renderer message and keeps
the content editable. JSON-encoded arrays are also accepted, but JSX source code
is no longer compiled or executed. Invalid arrays show a validation error.

The existing source editor and fullscreen controls are reused. JSX edits are
parsed back into arrays, and `onNodeContentChange` receives `NodeContent`
(`string | Record<string, unknown>[]`). Markdown stays text, and HTML keeps its
sanitized iframe preview. Host renderers are responsible for their components'
behavior and external actions; the SDK's HTML iframe sandbox does not apply to
a host-supplied JSX-content view.

Document playback reveals completed entries of JSX `$content` arrays as chunks
arrive, while unfinished entries remain hidden. Squeed's workflow channel also
previews repaired streamed documents containing component arrays. Previews do
not edit saved data: completion strictly parses the final JSON before committing,
and failure or disconnect restores the saved document. The renderer stays in
the host; this does not enable executable JSX or create a per-chunk MCP command.

With `config.editable: true`, click the content body to edit the original Markdown source. In Collision mode, including filled and embedded Grids, hold Shift when clicking; ordinary clicks retain their selection behavior. Shift is only required to enter the editor. Enter inserts a new line; Ctrl/Cmd+Enter or clicking away saves, and Escape cancels. Read-only mode still prevents editing. Internal JSON refreshes preserve focused editors and unsaved drafts; initial loading and explicit host loading still block interaction. Source whitespace is preserved. The node grows vertically as text is added; label editors grow horizontally within their width limit. Both keep their starting size as a minimum and omit input focus outlines. Clearing the body keeps an empty, editable content view; use `setNodeProp(json, address, "$content", undefined)` to remove the content property. Content nodes use the same minimum width as their object-property rows, and the right-aligned table/article button switches views without changing the document.

With one node selected, Enter activates its own visible dot or collapse control.
Further presses follow that control's existing open/back sequence. Text inputs,
focused controls, dialogs, modifier shortcuts and read-only mode keep their
existing behavior; holding Enter does not repeatedly toggle the view.

An expanded Text node exposes the existing **Show icon** dot on hover or selection;
**Show text** restores the Text view without rewriting source metadata. Double-click
an editable Text node without an explicit form to open the existing form popup with
only the Content text editor. It edits the label, not `$content`, and provides no
property fields or format selector. Enter inserts a newline, Ctrl/Cmd+Enter or blur
saves, and Escape cancels. Explicit forms and read-only permissions remain in force.
In a host's Fill-specific body (`fillBody`), Markdown/plain text also supports
direct click and focused Enter editing; other Collision views still require Shift.

The node animation toggle supports single and multiple selections. The SVG stroke follows the measured node border without changing layout or intercepting input. Text, array, object/content, and compound nodes support it, including outlined or transparent nodes. It uses the explicit border color or theme accent. Reduced-motion preferences pause the movement; graphs over 200 nodes suppress the trace in performance mode. `readOnly` prevents editing/toggling but still renders configured animation; `selectionToolbar.hide: ["animation"]` hides the toggle.

When animation is enabled, an **Animation** selector appears immediately to
the right of its bottom-toolbar icon:

- Nodes: **Trace** (the existing travelling stroke) or **Pulse** (the full border fades in and out).
- Edges: **Dash** (the existing moving dashes) or **Trace** (a travelling highlight along the routed edge).

Stopping animation hides the selector but retains the chosen variant. Node
Trace and edge Dash remain the defaults. Both respect reduced-motion preferences.

Node JSON stores `$nodeAnimationVariant: "traveling" | "pulse"` independently
of `$isNodeAnimated`. Hierarchy edges use `$edgeAnimationVariant`, target
links use `$targetAnimationVariant`, and `$connections` entries use
`animationVariant: "dashed" | "traveling"` independently of `style`.
Raw graphs use `data.nodeAnimationVariant` and `data.edgeAnimationVariant`.
Handle `onNodeAnimationVariantChange(nodeId, variant)` and
`onEdgeAnimationVariantChange(edgeId, variant)` for controlled raw-graph edits;
JSON mode persists them through `onJsonChange`.

In JSON mode content and animation edits emit `onJsonChange` with types `"nodeContent"` and `"nodeAnimation"`. In raw `nodes`/`edges` mode, handle the callbacks listed above and return updated nodes. Existing edges, colors, outlines, and mappings are unchanged.

### Transparent Colors And Outlines

Every built-in color palette includes a checkerboard `transparent` swatch, including custom palettes. This is distinct from reset, which removes the override. Node fill, text/icon, border, edge, container, and canvas colors accept `"transparent"`. Transparent fills keep default text readable in light and dark modes; explicit transparent text also hides its icon.

The outline toggle applies to one or multiple selected nodes. It clears all node fills (including object headers/rows) without overwriting stored colors. Text, array, object, and compound nodes support it. Selection highlighting remains visible; an explicit transparent border is still respected.

The separate **Edit node border** toggle is a toolbar-only mode: it does not remove the fill or change `$outline`. It reuses the node-color swatches for border color, hides only the text-color controls, and reveals a dashed toggle and thickness input. Switching it off restores background/text-color editing. Color, style, and thickness persist independently; explicit border colors remain visible during selection and hover.

Border colors emit `nodeColor` changes, while style and thickness emit `nodeStyle` with `$borderStyle` / `$borderWidth`. Raw consumers handle the border callbacks above. Thickness accepts nonnegative numbers; clearing the input resets it, and zero hides the border and its animation. `selectionToolbar.hide: ["color"]` hides the shared palette and border mode; `"borderColor"` hides the mode toggle, and `"style"` hides dashed/thickness controls. Hiding `"outline"` affects only the separate fill-removing toggle.

```tsx
setDoc((doc) => setNodeProp(doc, "root.service", "$outline", true));
setDoc((doc) => setNodeProp(doc, "root.service", "$bgColor", "transparent"));
```

For raw nodes use `data.viewProps.outline` and handle `onNodeOutlineChange(nodeId, outline)`; in JSON mode the SDK emits `onJsonChange` with `type: "nodeOutline"`. Container defaults can use `config.parentNodeStyle.outline`, with per-node values taking precedence. `selectionToolbar.hide: ["outline"]` hides the toggle. `readOnly` disables edits.

### Property Connections

Store mappings on the source node. Property references are exact row keys, while `target` is the destination node's JSON address:

```json
{
  "backend": {
    "runtime": "Node",
    "api": "REST",
    "$connections": [
      {
        "sourceProperty": "api",
        "target": "root.handlers",
        "targetProperty": "http"
      },
      {
        "sourceProperty": "runtime",
        "target": "root.handlers",
        "targetProperty": "ws"
      }
    ]
  },
  "handlers": { "http": "express", "ws": "socket.io" }
}
```

```tsx
<FlowDiagram
  json={doc}
  config={{ edgeMode: "properties" }}
  callbacks={{ onJsonChange: setDoc }}
/>
```

Use **Nodes / Properties** for edge-mode controls: `"nodes"` (the default) attaches edges to node boxes; `"properties"` attaches to rows. The previous `"workflow"` value remains accepted as an alias for `"nodes"`. Switching modes does not change the document or graph connections. Edges without property references keep their ordinary node attachment. Row ports stay left/right, reversed in `RL`, even for vertical layouts.

### Workflow Interfaces

Selected edges expose **Choose edge icon** and an **Edge icon** text field. The picker supports named React icons, SVG uploads (stored as base64), and HTTP(S) image URLs, with **Remove edge icon** to clear the choice. Icons render beside the label or by themselves for unlabeled edges; arrowheads and validation markers remain independent. Named icons follow the edge color; SVG images retain their own artwork colors. `selectionToolbar.hide: ["icon"]` hides both controls.

Raw graph hosts store `data.icon` through `callbacks.onEdgeIconChange(edgeId, icon)`; an empty string removes the icon. JSON mode persists automatically through `onJsonChange`: `$edgeIcon` on the child for hierarchy edges, `$targetIcon` on the source for `$target` cross-links, and `icon` on the selected `$connections` entry. Editing an icon never changes sibling connections.

`DynamicIcon` works in HTML and SVG contexts. Inside an SVG, use `<DynamicIcon name={icon} svg size={48} x={-24} y={-24} color="#dc2626" />`. Named React icons render as SVG; uploaded base64 SVGs and HTTP(S) image URLs render as SVG `<image>` elements with preserved aspect ratio. Without `svg`, image sources keep using HTML `<img>`. Uploaded markup is never inserted into the DOM. Edge validation markers reuse this renderer with `PiWarningCircleFill`.

The bottom toolbar includes the Nodes/Properties dropdown after Graph theme, with a divider before the theme swatches. Properties mode exposes an upload icon for `.ts` interfaces or `.json` JSON Schema. Uploads stay local and separate from graph JSON. Incompatible connections remain editable and turn red; missing declarations are amber/unverified. Hover the `!` marker for the reason. Validation compares the declared source property type to the target type, not the current property values. Node-only edges are not validated.

TypeScript contracts use a `Graph` interface or type alias keyed by node ID. A single declaration may use another name. Exact IDs are checked first; `root.alpha` also matches `alpha`. Labels are not used for matching.

```ts
interface Graph {
  alpha: { output: string; optional?: number };
  beta: { input: string; count: number };
}
```

Equivalent JSON Schema:

```json
{
  "type": "object",
  "properties": {
    "alpha": {
      "type": "object",
      "properties": {
        "output": { "type": "string" },
        "optional": { "type": "number" }
      },
      "required": ["output"]
    },
    "beta": {
      "type": "object",
      "properties": {
        "input": { "type": "string" },
        "count": { "type": "number" }
      },
      "required": ["input", "count"]
    }
  }
}
```

Supported types are string, number, boolean, null, primitive literals/unions, arrays, and nested structural objects. JSON additionally supports integer and nonrecursive local `$ref`. Properties are optional unless included in JSON Schema `required`; optional sources cannot supply required targets. Extra object fields are allowed. This is a bounded structural compatibility checker, not the complete TypeScript type system or a full JSON Schema validator. Unsupported constraints (including closed objects), recursion, inheritance, generics, imports and executable code are rejected. Files are limited to 256 KB and expansion to 512 type nodes. TypeScript is parsed, never executed; its runtime dependency loads lazily on `.ts` uploads. Vite hosts may pre-optimize `typescript` to avoid a development-only reload on its first use.

For host-owned state, supply `config.edgeMode` and `config.workflowContract`, and apply `callbacks.onEdgeModeChange(mode)` and `callbacks.onWorkflowContractChange(contract)` to that state. Omit these config fields for local state. An explicitly present `workflowContract: undefined` clears a controlled contract; a failed upload retains the previous one. Read-only mode disables mode changes and uploads. Exported `parseJsonContract(source, name)`, async `parseTypeScriptContract(source, name)`, `readWorkflowContract(file)`, and `connectionIssue(contract, edgeData)` let workflow hosts reuse the same check outside the UI. `connectionIssue` returns a reason or `undefined`; it does not block workflow execution itself.

Drag an output port to an input port or destination row to append a mapping. Property drags into empty space cancel. Existing node-level drawing still writes `$target`. The edge toolbar edits/deletes only the selected mapping. In document mode, store the full `onJsonChange` document; in raw `nodes`/`edges` mode, store the optional third `onEdgeCreate` argument in the edge's `data`.

Each entry accepts `target`, optional `sourceProperty`/`targetProperty`, `id`, `label`, `color` (Chakra token or hex), and `style: "solid" | "dashed" | "animated"`. Drag-created mappings receive IDs and duplicate endpoint mappings are not appended. Supply explicit unique IDs when declaring otherwise identical mappings that need distinct identities.

Missing or unrendered rows fall back to the corresponding node endpoint. Missing/collapsed nodes hide their edges without deleting the saved mappings. Custom views can expose rows with `data-flow-property={key}`; their positions are measured automatically. `readOnly` and `edgeHandles: false` disable port dragging.

Draw mode starts off by default, including when `edgeHandles: true`. Enable it with the toolbar, or explicitly control it with `config.isEdgeHandlesEnabled`. Hover handles remain available for individual connections when Draw mode is off.

Mappings are metadata. The SDK does not execute workflows or transfer data.

## Exported Utilities

```tsx
import { compileSqueed, setNodeProp, applyCollapsed } from "@squeed/flow-sdk";

const next = setNodeProp(json, "root.service", "$label", "API");
const { nodes, edges } = compileSqueed(next, {
  title: "Services",
  isCenter: false,
});
const visible = applyCollapsed(handBuiltNodes, handBuiltEdges);
```

`createFlowDiagram` remains exported as the lower-level compiler. Use `compileSqueed` for stable edge IDs, document styling, and `$connections`. `addConnection(json, sourceAddress, connection)` appends a mapping immutably. Hierarchy edges are removed by removing the child; `$target` links and individual `$connections` can be deleted independently.

### Address-Based Edits

| Helper                                                                          | Result                                                                                                           |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `getNode(json, address)`                                                        | Value at an address, or `undefined`                                                                              |
| `updateNode(json, address, updater)`                                            | New document with the updater's replacement at that address                                                      |
| `setNodeProp(json, address, key, value)`                                        | New document with a `$` rendering property; null/undefined resets it, as does empty string except for `$content` |
| `setCollapsed(json, address, collapsed)`                                        | New document; preserves an explicit `false`                                                                      |
| `addChild(json, parentAddress, child, key?)`                                    | `{ json, address }`; appends to plain or `$`-wrapped arrays, otherwise uses a key                                |
| `removeNode(json, address)`                                                     | New document without that node; root and absent paths are left unchanged                                         |
| `addTargetEdge(json, sourceAddress, targetAddress, label?)`                     | New document; replaces the source's single `$target`                                                             |
| `addConnection(json, sourceAddress, connection)`                                | New document; appends a mapping unless its endpoints already exist                                               |
| `setEdgeProp(json, edgeRef, key, value)` / `setEdgeStyle(json, edgeRef, style)` | New document updating only the edge's JSON owner                                                                 |
| `removeEdge(json, edgeRef)`                                                     | `{ json, removed }`; independently removes cross-links or property mappings                                      |

Addresses use dot-separated paths such as `root.backend.runtime` or `root.tags.1`; `$` array wrappers are traversed automatically. Keys containing literal dots are not escaped by this address format. Array deletion shifts subsequent indices; these addresses are not permanent IDs across structural edits.

Helpers reuse untouched branches and do not fire callbacks themselves. The `updateNode` updater must return a replacement without mutating its argument. It can add a leaf under an existing parent but does not create missing ancestor chains. Pass the returned document back through `json` to refresh the diagram.

## Custom Overlays

### Node Hover Overlay

Reuse `config.nodeOverlayActions` for standard hover buttons. An action's optional
`nodeTypes` array limits it to matching node types (for example, `["grid"]`).
Omitting `nodeTypes` preserves the existing all-node behavior; actions continue
to dispatch through `callbacks.onNodeHoverAction`.

```tsx
import { HStack, IconButton } from "@chakra-ui/react";
import { PiPencilSimple, PiTrash } from "react-icons/pi";

<FlowDiagram
  json={data}
  config={{
    renderNodeOverlay: ({ nodeId, nodeData, isRoot }) => (
      <HStack bg="gray.800" px={2} py={1} borderRadius={8}>
        <IconButton
          aria-label="Edit node"
          size="xs"
          onClick={() => edit(nodeId)}
        >
          <PiPencilSimple />
        </IconButton>
        {!isRoot && (
          <IconButton
            aria-label="Delete node"
            size="xs"
            onClick={() => remove(nodeId)}
          >
            <PiTrash />
          </IconButton>
        )}
      </HStack>
    ),
  }}
/>;
```

### Selection Toolbar

```tsx
import { HStack, IconButton, Text } from "@chakra-ui/react";
import { PiX } from "react-icons/pi";

<FlowDiagram
  json={data}
  config={{
    renderSelectedNodeToolbar: ({ selectedNodeIds, onDeselect }) => (
      <HStack bg="gray.800" px={3} py={2} borderRadius={8}>
        <Text fontSize="xs">{selectedNodeIds.length} selected</Text>
        <IconButton aria-label="Clear selection" size="xs" onClick={onDeselect}>
          <PiX />
        </IconButton>
      </HStack>
    ),
  }}
/>;
```

## Keyboard Shortcuts

| Key                    | Action                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `Z`                    | Toggle zoom mode (scroll to zoom)                                                   |
| `M`                    | Toggle multi-select mode                                                            |
| `D`                    | Toggle drag/pan mode                                                                |
| Arrow keys             | Select a node in that direction and pan it to center without zooming                |
| `Delete` / `Backspace` | Delete selected non-root nodes                                                      |
| `Escape`               | Cancel an active editor/gesture first; otherwise reuse graph-background deselection |

The canvas supports pointer panning, wheel zoom, and two-finger pinch zoom. Interactive inputs inside nodes retain their own keyboard behavior.

Click empty canvas or an ordinary node surface to give the diagram keyboard
focus. Unmodified arrows select the nearest rendered node in the requested direction, starting from the selected
node or the viewport center when nothing is selected. Hidden nodes and nodes
inside another canvas are excluded. Panning is immediate and preserves zoom.
No candidate leaves selection and viewport unchanged. Forms, open menus,
multi-selection, read-only mode, and disabled keyboard shortcuts retain their
existing keyboard behavior. Selection callbacks receive
`keyboardNavigation: true` in `NodeSelectionModifiers`; hosts should not apply
their mouse-click fit/zoom behavior for that event.

Escape on a selected canvas node reuses the background-click action, including
preview retraction and the host's viewport restoration. Editors, dialogs, menus,
fullscreen, and active gestures retain priority. If preview opening focuses its
label editor, press Escape once to cancel editing and again to close the preview.

## Theme Utilities

```tsx
import {
  useCustomColors,
  getChakraColorHex,
  getColorVariant,
} from "@squeed/flow-sdk";

const { background, colorText, border } = useCustomColors();
const hex = getChakraColorHex("blue.500"); // → "#3182ce"
```

## Development Checks

See [CONTRIBUTING.md](https://github.com/sciphergfx/squeed-flow-sdk/blob/main/CONTRIBUTING.md)
for local setup and pull-request guidance, and
[SECURITY.md](https://github.com/sciphergfx/squeed-flow-sdk/blob/main/SECURITY.md)
for private vulnerability reporting.

```bash
npm ci
npx playwright install chromium
npm run check:release
npm pack --dry-run
```

The release check runs unit tests, browser tests against the built ESM package, a clean tarball installation with ESM/CommonJS type and runtime checks, and the production dependency audit. Packing rebuilds the artifacts. React, Chakra, Emotion, Framer Motion, and React Icons are external to the SDK bundle; application download size includes whichever peers and icon libraries it uses.

---

Author: **seyi ogunbowale**
