# @squeed/flow-sdk

Standalone React component for rendering interactive flow diagrams from JSON.

## Install

```bash
npm install @squeed/flow-sdk
```

Peer dependencies: `react`, `react-dom`, `@chakra-ui/react`, `@chakra-ui/icons`, `@emotion/react`, `@emotion/styled`, `framer-motion`

## Quick Start

```tsx
import { FlowDiagram } from "@squeed/flow-sdk";

function App() {
  return (
    <FlowDiagram
      json={{ name: "Hello", version: "1.0", nested: { key: "value" } }}
      title="My Diagram"
      config={{ direction: "LR", colorMode: "dark", themeColor: "blue.500" }}
    />
  );
}
```

## Props

### `FlowDiagramProps`

| Prop | Type | Description |
|------|------|-------------|
| `json` | `any` | JSON object or string to render as a flow diagram |
| `title` | `string` | Title shown on the root node (default: `"untitled"`) |
| `nodes` | `FlowDiagramNode[]` | Pre-computed nodes (alternative to `json`) |
| `edges` | `FlowDiagramEdge[]` | Pre-computed edges (alternative to `json`) |
| `config` | `FlowDiagramConfig` | Diagram configuration |
| `callbacks` | `FlowDiagramCallbacks` | Event callbacks |
| `showBottomBar` | `boolean` | Show the direction/mode bottom bar (default: `true`) |
| `className` | `string` | CSS class name |
| `style` | `CSSProperties` | Inline styles |

You can provide either `json` (auto-generates nodes/edges) or `nodes` + `edges` (pre-computed).

## Config

### `FlowDiagramConfig`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `direction` | `"LR" \| "RL" \| "TB" \| "BT"` | `"LR"` | Layout direction |
| `layout` | `"dagre" \| "elk" \| "tidytree" \| "concentric" \| "cose"` | `"dagre"` | Layout algorithm |
| `themeColor` | `string` | `"blue.500"` | Accent color (Chakra token) |
| `colorMode` | `"light" \| "dark"` | `"light"` | Color mode |
| `backgroundPattern` | `"dot" \| "grid" \| "steel" \| "none"` | `"dot"` | Background pattern |
| `backgroundColor` | `string` | — | Background color override |
| `edgeColor` | `string` | — | Edge/line color override |
| `minZoom` | `number` | `0.01` | Minimum zoom level |
| `maxZoom` | `number` | `1.5` | Maximum zoom level |
| `initialViewport` | `{ pan: { x, y }, zoom }` | — | Initial viewport |
| `edgeHandles` | `boolean` | `true` | Enable edge drawing handles |
| `readOnly` | `boolean` | `false` | Disable all interactions |
| `editable` | `boolean` | `false` | Enable inline node label editing |
| `autoCollapse` | `boolean \| AutoCollapseConfig` | — | Auto-collapse deep nodes for large data |
| `nodeOverlayActions` | `NodeOverlayAction[]` | — | Actions in node hover overlay |
| `renderNodeOverlay` | `(props: NodeOverlayProps) => ReactNode` | — | Custom node hover overlay |
| `renderSelectedNodeToolbar` | `(props: SelectedNodeToolbarProps) => ReactNode` | — | Custom multi-select toolbar |

## Auto-Collapse

For large JSON structures, enable auto-collapse to keep the diagram manageable. Nodes are collapsed at every Nth depth level when the data exceeds size thresholds.

```tsx
// Use defaults (800+ lines AND 5+ depth triggers collapse every 3 levels)
<FlowDiagram json={largeJson} config={{ autoCollapse: true }} />

// Custom thresholds
<FlowDiagram
  json={largeJson}
  config={{
    autoCollapse: {
      minLines: 200,
      minDepth: 3,
      collapseEveryNLevels: 2,
    },
  }}
/>
```

### `AutoCollapseConfig`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minLines` | `number` | `800` | Min JSON lines to trigger |
| `minDepth` | `number` | `5` | Min depth to trigger |
| `collapseEveryNLevels` | `number` | `3` | Collapse every Nth depth level |

Both `minLines` and `minDepth` must be exceeded for auto-collapse to apply.

## Callbacks

### Node Events

| Callback | Signature | Description |
|----------|-----------|-------------|
| `onNodeSelect` | `(nodeId, nodeData) => void` | Node clicked/selected |
| `onNodeDeselect` | `() => void` | Selection cleared |
| `onNodeDoubleClick` | `(nodeId, nodeData) => void` | Node double-clicked |
| `onNodeCreate` | `(params) => void` | Node created via edge drawing into empty space |
| `onNodeDelete` | `(nodeId, nodeData) => void` | Node deleted |
| `onNodeLabelChange` | `(nodeId, newLabel) => void` | Node label edited inline |
| `onNodeCollapse` | `(nodeId, collapsed) => void` | Collapse toggle clicked |
| `onNodeColorChange` | `(nodeId, colorType, color) => void` | Node color changed via toolbar |
| `onNodeHoverAction` | `(actionId, nodeId, nodeData) => void` | Hover overlay action clicked |

### Edge Events

| Callback | Signature | Description |
|----------|-----------|-------------|
| `onEdgeCreate` | `(sourceId, targetId) => void` | New edge drawn between nodes |
| `onEdgeSelect` | `(edgeId, edgeData) => void` | Edge clicked/selected |
| `onEdgeDeselect` | `() => void` | Edge selection cleared |
| `onEdgeRemove` | `(edgeId, edgeData) => void` | Edge removed |
| `onEdgeColorChange` | `(edgeId, color) => void` | Edge color changed |

### Diagram Events

| Callback | Signature | Description |
|----------|-----------|-------------|
| `onViewportChange` | `(viewport) => void` | Pan/zoom changed |
| `onDirectionChange` | `(direction) => void` | Direction changed via bottom bar |
| `onArrayModeChange` | `(isArrayMode) => void` | Array/set mode toggled |
| `onCyInit` | `(cy) => void` | Cytoscape instance initialized |

## JSON Conventions

Special `$`-prefixed keys control node rendering:

| Key | Description |
|-----|-------------|
| `$label` | Display label for the node |
| `$bgColor` | Background color (Chakra token, e.g. `"blue.500"`) |
| `$textColor` | Text color |
| `$collapsed` | `true` to collapse children, `false` to force expanded |
| `$parent` | Parent node ID (creates compound/container nodes) |
| `$` | Array value (creates array child list, e.g. `{ $: ["a", "b"] }`) |

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

## Exported Utilities

```tsx
import { createFlowDiagram, getJsonSize, applyAutoCollapse } from "@squeed/flow-sdk";

// Generate nodes/edges from JSON manually
const { nodes, edges } = createFlowDiagram(json, "root", [], [], "Title", {
  hideDefaultObject: false,
  sprtObjctKy: false,
  isCntr: false,
});

// Measure JSON complexity
const { lines, depth, nodes: nodeCount } = getJsonSize(json);

// Apply auto-collapse manually
const collapsed = applyAutoCollapse(structuredClone(json), 3); // collapse every 3 levels
```

## Custom Overlays

### Node Hover Overlay

```tsx
<FlowDiagram
  json={data}
  config={{
    renderNodeOverlay: ({ nodeId, nodeData, isRoot }) => (
      <HStack bg="gray.800" px={2} py={1} borderRadius={15}>
        <IconButton icon={<EditIcon />} size="xs" onClick={() => edit(nodeId)} />
        {!isRoot && <IconButton icon={<DeleteIcon />} size="xs" onClick={() => remove(nodeId)} />}
      </HStack>
    ),
  }}
/>
```

### Selection Toolbar

```tsx
<FlowDiagram
  json={data}
  config={{
    renderSelectedNodeToolbar: ({ selectedNodeIds, onDeselect }) => (
      <HStack bg="gray.800" px={3} py={2} borderRadius={15}>
        <Text fontSize="xs">{selectedNodeIds.length} selected</Text>
        <IconButton icon={<CloseIcon />} size="xs" onClick={onDeselect} />
      </HStack>
    ),
  }}
/>
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Z` | Toggle zoom mode (scroll to zoom) |
| `M` | Toggle multi-select mode |
| `D` | Toggle drag/pan mode |

## Theme Utilities

```tsx
import { useCustomColors, getChakraColorHex, getColorVariant } from "@squeed/flow-sdk";

const { background, colorText, border } = useCustomColors();
const hex = getChakraColorHex("blue.500"); // → "#3182ce"
```
