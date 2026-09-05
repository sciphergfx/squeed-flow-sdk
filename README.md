# @squeed/flow-sdk

Interactive React flow diagrams from JSON, using DOM nodes, SVG edges, and Dagre layout.

## Install

```bash
npm install @squeed/flow-sdk@^2 react@^18 react-dom@^18 markdown-to-jsx@^9.10.2
```

Requires React 18 and Chakra UI 3.36 or later. Peer dependencies: `react`, `react-dom`, `@chakra-ui/react`, `@emotion/react`, `@emotion/styled`, `framer-motion` (11 or 12), and `markdown-to-jsx` (^9.10.2). npm installs the remaining peers automatically. React 19 is not currently supported.

The Markdown renderer is a required peer supplied by the consuming application, not embedded in the SDK bundle. It remains part of the application's dependency footprint.

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
        <div data-selected={isActive} style={{ width: 240, height: 160 }}>
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

## Callbacks
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

| Callback                  | Signature                                      | Description                                                                                      |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `onNodeSelect`            | `(nodeId, nodeData) => void`                   | Node clicked/selected                                                                            |
| `onNodeDeselect`          | `() => void`                                   | Selection cleared                                                                                |
| `onNodeDoubleClick`       | `(nodeId, nodeData) => void`                   | Node double-clicked                                                                              |
| `onNodeCreate`            | `(params) => void`                             | Node created via edge drawing into empty space                                                   |
| `onNodeDelete`            | `(nodeId, nodeData) => void`                   | Node deleted                                                                                     |
| `onNodeLabelChange`       | `(nodeId, newLabel) => void`                   | Node label edited inline                                                                         |
| `onNodeContentChange`     | `(nodeId, content: string) => void`            | Multiline content saved; raw-graph consumers store `data.config.content`                         |
| `onNodeAnimationChange`   | `(nodeId, animated: boolean) => void`          | Border animation toggled; raw-graph consumers store `data.isNodeAnimated`                        |
| `onNodeCollapse`          | `(nodeId, collapsed) => void`                  | Collapse toggle clicked                                                                          |
| `onNodeColorChange`       | `(nodeId, colorType, color) => void`           | Node color changed via toolbar                                                                   |
| `onNodeBorderColorChange` | `(nodeId, color: string) => void`              | Border color picked; raw consumers update `data.viewProps.borderColor` (empty string resets)     |
| `onNodeBorderStyleChange` | `(nodeId, "solid" \| "dashed") => void`        | Border style changed; raw consumers update `data.viewProps.borderStyle`                          |
| `onNodeBorderWidthChange` | `(nodeId, width: number \| undefined) => void` | Border thickness changed; raw consumers update `data.viewProps.borderWidth` (`undefined` resets) |
| `onNodeIconChange`        | `(nodeId, iconName) => void`                   | Node icon changed via toolbar                                                                    |
| `onNodeOutlineChange`     | `(nodeId, outline: boolean) => void`           | Outline toggled; raw-graph consumers store `data.viewProps.outline`                              |
| `onNodeHoverAction`       | `(actionId, nodeId, nodeData) => void`         | Hover overlay action clicked                                                                     |

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

With `config.editable: true`, double-click the content body to edit the original Markdown source. Enter inserts a new line; Ctrl/Cmd+Enter or clicking away saves, and Escape cancels. Source whitespace is preserved. The node grows vertically as text is added; label editors grow horizontally within their width limit. Both keep their starting size as a minimum and omit input focus outlines. Clearing the body keeps an empty, editable content view; use `setNodeProp(json, address, "$content", undefined)` to remove the content property. Content nodes use the same minimum width as their object-property rows, and the right-aligned table/article button switches views without changing the document.

The node animation toggle supports single and multiple selections. The SVG stroke follows the measured node border without changing layout or intercepting input. Text, array, object/content, and compound nodes support it, including outlined or transparent nodes. It uses the explicit border color or theme accent. Reduced-motion preferences pause the movement; graphs over 200 nodes suppress the trace in performance mode. `readOnly` prevents editing/toggling but still renders configured animation; `selectionToolbar.hide: ["animation"]` hides the toggle.

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

| Key                    | Action                            |
| ---------------------- | --------------------------------- |
| `Z`                    | Toggle zoom mode (scroll to zoom) |
| `M`                    | Toggle multi-select mode          |
| `D`                    | Toggle drag/pan mode              |
| `Delete` / `Backspace` | Delete selected non-root nodes    |
| `Escape`               | Cancel drawing or a label edit    |

The canvas supports pointer panning, wheel zoom, and two-finger pinch zoom. Interactive inputs inside nodes retain their own keyboard behavior.

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

See [CONTRIBUTING.md](https://github.com/sciphergfx/flow-sdk/blob/main/CONTRIBUTING.md)
for local setup and pull-request guidance, and
[SECURITY.md](https://github.com/sciphergfx/flow-sdk/blob/main/SECURITY.md)
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
