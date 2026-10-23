# Squeed Flow

**Turn JSON into interactive, editable flow diagrams.**

[Website](https://squeed.co) · [Live editor](https://app.squeed.co) ·
[VS Code extension](https://marketplace.visualstudio.com/items?itemName=seyiogunbowalesciphergfx.squeed-flow) ·
[MCP bridge](https://squeed.co/mcp) · [npm](https://www.npmjs.com/package/@squeed/flow-sdk)

[![npm version](https://img.shields.io/npm/v/@squeed/flow-sdk.svg)](https://www.npmjs.com/package/@squeed/flow-sdk)
[![license](https://img.shields.io/npm/l/@squeed/flow-sdk.svg)](LICENSE)

Squeed Flow renders any JSON document as a diagram you can pan, zoom, select,
rearrange, and edit — then reports the edit back as JSON. The same document
format powers the hosted editor at [app.squeed.co](https://app.squeed.co), the
[VS Code preview extension](https://marketplace.visualstudio.com/items?itemName=seyiogunbowalesciphergfx.squeed-flow),
and agent workflows driven over MCP at [squeed.co/mcp](https://squeed.co/mcp).

## Features

- **JSON-first** — pass a parsed object or array; no separate schema or graph model.
- **Interactive canvas** — pan, zoom, drag, multi-select, draw edges, and collapse branches.
- **Inline editing** — rename nodes, edit Markdown content, change colors, icons, borders, and connections.
- **Controlled data flow** — every edit returns a new document through `onJsonChange`; you own state.
- **Flexible layout** — left/right, top/bottom, or centered branch layout with Dagre.
- **Rich nodes** — Markdown/HTML/JSX content, Phosphor and React Icons, animation, and compound containers.
- **Extensible** — custom node views, overlays, toolbars, bottom bars, and callbacks.
- **Themeable** — light/dark modes and Chakra UI color tokens.
- **Streaming-ready** — incremental JSON preview and playback helpers.

## Try It

| Where                 | Link                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Website               | [squeed.co](https://squeed.co)                                                                               |
| Live editor           | [app.squeed.co](https://app.squeed.co)                                                                       |
| VS Code extension     | [Squeed Flow on the Marketplace](https://marketplace.visualstudio.com/items?itemName=seyiogunbowalesciphergfx.squeed-flow) |
| Agent workflows (MCP) | [squeed.co/mcp](https://squeed.co/mcp)                                                                       |
| Package               | [npmjs.com/package/@squeed/flow-sdk](https://www.npmjs.com/package/@squeed/flow-sdk)                         |

## Install

```bash
npm install @squeed/flow-sdk react@^18 react-dom@^18 markdown-to-jsx@^9.10.2
```

Requires React 18, Chakra UI 3.36+, and `react-icons` 5.3+. Remaining peer
dependencies install automatically with npm 7+. React 19 is not currently
supported. The Markdown renderer is a required peer supplied by your app, not
bundled with the SDK.

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

The container must have a height. Styles are injected automatically; no CSS
import is required. Keep your existing Chakra provider if your app already has
one.

## Editing Model

`json` accepts a parsed object or array. Edits produce a new document via
`onJsonChange(next, change)`; store `next` and pass it back as `json`. Granular
callbacks still fire for notifications, but should not apply the same edit
again. With `nodes`/`edges` instead, your app owns graph updates and collapse
filtering.

Editing a plain-string node label updates that string in place, preserving its
JSON address and connections. Object-node labels use `$label`.

## JSON Conventions

Keys become nodes, nesting becomes hierarchy, and `$`-prefixed keys configure
rendering:

| Key               | Description                                                           |
| ----------------- | --------------------------------------------------------------------- |
| `$label`          | Display label                                                         |
| `$content`        | Markdown source, editable when `config.editable` is enabled           |
| `$icon`           | React Icons name, e.g. `PiGear`                                       |
| `$bgColor`        | Background color (Chakra token, hex, or `transparent`)                |
| `$textColor`      | Text color                                                            |
| `$borderColor`    | Border color                                                          |
| `$borderStyle`    | `"solid"` or `"dashed"`                                               |
| `$borderWidth`    | Border thickness in pixels; `0` hides it                              |
| `$borderRadius`   | Corner radius; `0` makes square corners                               |
| `$outline`        | `true` for an unfilled node with a border                             |
| `$collapsed`      | `true` collapses children                                             |
| `$parent`         | Parent node ID for compound/container nodes                           |
| `$target`         | Cross-link to a JSON address, e.g. `root.database`                    |
| `$connections`    | Multiple node/property mappings                                       |
| `$edgeColor`      | Edge color                                                            |
| `$isEdgeDashed`   | Dashed edge                                                           |
| `$isEdgeAnimated` | Animated edge                                                         |
| `$`               | Array value, e.g. `{ $: ["a", "b"] }`                                 |

```json
{
  "$label": "Server",
  "$bgColor": "green.500",
  "host": "localhost",
  "port": 3000,
  "routes": {
    "$label": "API Routes",
    "$collapsed": true,
    "users": "/api/users"
  }
}
```

## Core Props

| Prop            | Type                   | Description                                       |
| --------------- | ---------------------- | ------------------------------------------------- |
| `json`          | `SqueedJson`           | Parsed JSON document; takes precedence over nodes |
| `nodes`/`edges` | `FlowDiagramNode[]` / `FlowDiagramEdge[]` | Pre-computed graph             |
| `title`         | `string`               | Root node title (default `"untitled"`)            |
| `config`        | `FlowDiagramConfig`    | Layout, theme, interaction, and rendering options |
| `callbacks`     | `FlowDiagramCallbacks` | Edit, selection, viewport, and lifecycle events   |
| `showBottomBar` | `boolean`              | Show the direction/mode bar (default `true`)      |
| `className`     | `string`               | CSS class name                                    |
| `style`         | `CSSProperties`        | Inline styles                                     |

## Common Configuration

```tsx
config={{
  direction: "LR",            // "LR" | "RL" | "TB" | "BT" | "C"
  nodeAlignment: "center",    // "leading" | "center" | "trailing"
  edgeMode: "nodes",          // "nodes" | "properties" | "workflow"
  themeColor: "blue.500",
  colorMode: "light",         // "light" | "dark"
  backgroundPattern: "dot",   // "dot" | "grid" | "steel" | "none"
  editable: true,
  readOnly: false,
  minZoom: 0.01,
  maxZoom: 1.5,
  initialViewport: { pan: { x: 0, y: 0 }, zoom: 1 },
}}
```

Use `$collapsed: true` to collapse a JSON branch and `false` to keep its
expansion control. `readOnly` disables graph gestures and edits while leaving
toolbar navigation available.

## Callbacks

| Callback            | Fires when                                  |
| ------------------- | ------------------------------------------- |
| `onJsonChange`      | Any toolbar or inline edit changes the JSON |
| `onNodeSelect`      | A node is clicked or selected               |
| `onEdgeSelect`      | An edge is selected                         |
| `onViewportChange`  | Pan or zoom changes                         |
| `onDirectionChange` | Layout direction changes                    |
| `onThemeColorChange`| The graph accent color changes              |
| `onNodeCollapse`    | A branch is collapsed or expanded           |
| `onNodeLabelChange` | A label is edited inline                    |
| `onEdgeCreate`      | An edge is drawn between nodes              |
| `onInit`            | The engine is ready (`zoom`, `pan`, `fit`)  |
| `onLayoutComplete`  | Layout and measurement settle               |

## Utilities

```tsx
import { compileSqueed, setNodeProp, applyCollapsed } from "@squeed/flow-sdk";

const next = setNodeProp(json, "root.service", "$label", "API");
const { nodes, edges } = compileSqueed(next, {
  title: "Services",
  isCenter: false,
});
const visible = applyCollapsed(nodes, edges);
```

Address-based helpers include `getNode`, `updateNode`, `setCollapsed`,
`addChild`, `removeNode`, `addTargetEdge`, `addConnection`, `setEdgeProp`, and
`removeEdge`. They return new documents and do not fire callbacks. Addresses use
dot-separated paths such as `root.backend.runtime`.

## Keyboard Shortcuts

| Key                    | Action                                    |
| ---------------------- | ----------------------------------------- |
| `Z`                    | Toggle scroll-to-zoom mode                |
| `M`                    | Toggle multi-select mode                  |
| `D`                    | Toggle drag/pan mode                      |
| Arrow keys             | Select the nearest node in that direction |
| `Delete` / `Backspace` | Delete selected non-root nodes            |
| `Escape`               | Cancel the active editor or gesture       |

Disable these with `config.disableKeyboardShortcuts`.

## Development

```bash
npm ci
npx playwright install chromium
npm run check:release
npm pack --dry-run
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, tests, and pull-request
guidance. For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of
opening a public issue.

## License

[AGPL-3.0](LICENSE). The bundled diagram renderer is also AGPL-3.0.
