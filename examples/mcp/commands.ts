export interface CommandField {
  type?: string;
  enum?: readonly (string | number | boolean | null)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  items?: object;
  maxItems?: number;
  anyOf?: readonly object[];
  optional?: boolean;
}

export interface FlowCommand {
  name: string;
  description: string;
  target: "node" | "edge" | "diagram";
  handler: "callback" | "context" | "engine" | "host";
  method: string;
  fields: Record<string, CommandField>;
}

const text: CommandField = { type: "string", maxLength: 65536 };
const token: CommandField = { type: "string", maxLength: 1024 };
const boolean: CommandField = { type: "boolean" };
const nonnegative: CommandField = { type: "number", minimum: 0, maximum: 10000 };
const resetNumber: CommandField = { anyOf: [nonnegative, { type: "null" }] };
const json: CommandField = { anyOf: [{ type: "object" }, { type: "array" }] };
const value: CommandField = { anyOf: [text, { type: "number" }, boolean, { type: "null" }, ...json.anyOf!] };
const viewport = { padding: { ...nonnegative, optional: true }, animate: { ...boolean, optional: true } };
const choice = (...values: string[]): CommandField => ({ type: "string", enum: values });
const command = (name: string, description: string, target: FlowCommand["target"], handler: FlowCommand["handler"], method: string, fields: FlowCommand["fields"] = {}): FlowCommand =>
  ({ name, description, target, handler, method, fields });
const node = (name: string, method: string, fields: FlowCommand["fields"] = {}) => command(`node-${name}`, `Set node ${name}.`, "node", "callback", method, fields);
const edge = (name: string, method: string, fields: FlowCommand["fields"] = {}) => command(`edge-${name}`, `Set edge ${name}.`, "edge", "callback", method, fields);
const diagram = (name: string, method: string, fields: FlowCommand["fields"] = {}) => command(name, `Set diagram ${name}.`, "diagram", "context", method, fields);

export const FLOW_COMMANDS: readonly FlowCommand[] = [
  command("node-view", "Set default or properties view.", "node", "context", "setNodeViewMode", { mode: choice("default", "properties") }),
  node("label", "onNodeLabelChange", { label: text }),
  node("content", "onNodeContentChange", { content: text }),
  node("collapse", "onNodeCollapse", { collapsed: boolean }),
  node("color", "onNodeColorChange", { colorType: choice("text", "bg"), color: token }),
  node("icon", "onNodeIconChange", { icon: token }),
  node("outline", "onNodeOutlineChange", { outline: boolean }),
  node("border-color", "onNodeBorderColorChange", { color: token }),
  node("border-style", "onNodeBorderStyleChange", { style: choice("solid", "dashed") }),
  node("border-width", "onNodeBorderWidthChange", { width: resetNumber }),
  node("border-radius", "onNodeBorderRadiusChange", { radius: resetNumber }),
  node("animation", "onNodeAnimationChange", { animated: boolean }),
  node("animation-variant", "onNodeAnimationVariantChange", { variant: choice("traveling", "pulse") }),
  command("node-select", "Select a node.", "node", "host", "selectNode"),
  command("node-delete", "Delete a node.", "node", "host", "deleteNode"),
  command("node-create", "Create a node through the host creation callback.", "diagram", "host", "createNode", { type: token, x: { type: "number" }, y: { type: "number" }, source: { ...token, optional: true }, isArrayMode: { ...boolean, optional: true } }),
  edge("color", "onEdgeColorChange", { color: token }),
  edge("type", "onEdgeTypeChange", { type: { anyOf: [token, { type: "null" }] } }),
  edge("icon", "onEdgeIconChange", { icon: token }),
  edge("label", "onEdgeLabelChange", { label: text }),
  edge("style", "onEdgeStyleChange", { style: choice("solid", "dashed", "animated") }),
  edge("animation-variant", "onEdgeAnimationVariantChange", { variant: choice("dashed", "traveling") }),
  command("edge-select", "Select an edge.", "edge", "host", "selectEdge"),
  command("edge-delete", "Delete an edge.", "edge", "host", "deleteEdge"),
  command("edge-create", "Connect two mapped nodes, optionally using property ports.", "diagram", "host", "createEdge", { source: token, target: token, sourceProperty: { ...token, optional: true }, targetProperty: { ...token, optional: true } }),
  diagram("theme-color", "setThemeColor", { color: token }),
  diagram("edge-mode", "setEdgeMode", { mode: choice("auto", "nodes", "properties", "workflow") }),
  diagram("spacing", "setSpacing", { spacing: { anyOf: [{ type: "number", minimum: 0.5, maximum: 2 }, choice("compact", "normal", "spacious")] } }),
  diagram("edge-radius", "setEdgeRadius", { radius: { ...nonnegative, maximum: 500 } }),
  diagram("background", "setBackgroundVariant", { variant: choice("dot", "square", "cross", "none", "transparent") }),
  diagram("compact-layout", "setCompactPropertyLayout", { enabled: boolean }),
  ...[
    ["zoom-mode", "setIsZoomMode"], ["multi-select-mode", "setIsMultiSelectMode"],
    ["drag-mode", "setIsDragMode"], ["draw-mode", "setIsEdgeHandlesEnabled"],
    ["array-mode", "setIsArrayNodeMode"], ["toolbar-pinned", "setIsPinned"],
    ["performance-mode", "setIsPerformanceMode"],
  ].map(([name, method]) => diagram(name, method, { enabled: boolean })),
  command("direction", "Change layout direction.", "diagram", "callback", "onDirectionChange", { direction: choice("LR", "RL", "TB", "BT", "C") }),
  command("selection-clear", "Clear node and edge selection.", "diagram", "host", "clearSelection"),
  ...["fit", "centerAndFit", "center", "restoreView"].map(method => command(
    ({ fit: "fit", centerAndFit: "center-fit", center: "center", restoreView: "restore-view" } as Record<string, string>)[method],
    `${method} the viewport.`, "diagram", "engine", method,
    method === "center" || method === "restoreView" ? { animate: viewport.animate } : viewport,
  )),
  ...["focusNode", "focusBranch", "focusConnections", "isolateBranch", "isolateConnections"].map(method => command(
    method.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), `${method} without mutating graph data.`, "node", "engine", method, viewport,
  )),
  command("edges-visible", "Show or hide rendered edges without deleting them.", "diagram", "engine", "setEdgesVisible", { visible: boolean }),
  command("zoom", "Set viewport zoom within configured limits.", "diagram", "engine", "zoom", { zoom: { type: "number", minimum: 0.001, maximum: 100 } }),
  command("pan", "Set viewport translation.", "diagram", "host", "pan", { x: { type: "number" }, y: { type: "number" } }),
  command("zoom-at", "Zoom around a rendered point.", "diagram", "host", "zoomAt", { zoom: { type: "number", minimum: 0.001, maximum: 100 }, x: { type: "number" }, y: { type: "number" } }),
  command("inspect", "Return graph IDs, mapped aliases, selection and viewport through the browser result event.", "diagram", "host", "inspect"),
  command("node-inspect", "Return node data and geometry through the browser result event.", "node", "host", "inspectNode"),
  command("edge-inspect", "Return edge data through the browser result event.", "edge", "host", "inspectEdge"),
  command("coordinates", "Convert model/client coordinates through the browser result event.", "diagram", "host", "coordinates", { from: choice("model", "client"), x: { type: "number" }, y: { type: "number" } }),
  command("form-set", "Validate and edit a declared form field through existing form callbacks.", "node", "host", "setForm", { field: token, value }),
  command("form-options", "Resolve options for a declared form field through the browser result event.", "node", "host", "formOptions", { field: token }),
  command("form-schema", "Parse and install a JSON schema or TypeScript properties interface; source is never executed.", "diagram", "host", "formSchema", { filename: token, source: { type: "string", maxLength: 262144 }, typeNames: { type: "array", items: token, maxItems: 32 } }),
  command("form-schema-clear", "Remove the active form schema.", "diagram", "host", "clearFormSchema"),
  command("workflow-contract", "Import a JSON or TypeScript connection contract; source is never executed.", "diagram", "host", "workflowContract", { filename: token, source: { type: "string", maxLength: 262144 } }),
  command("workflow-contract-clear", "Remove the connection contract.", "diagram", "context", "setWorkflowContract"),
  command("document-replace", "Replace the current JSON document using the existing document validator.", "diagram", "host", "replaceJson", { document: json }),
  command("state-replace", "Replace source state and regenerate its configured projection.", "diagram", "host", "replaceState", { state: json }),
  command("document-export", "Return document or source state through the browser result event.", "diagram", "host", "exportDocument", { kind: choice("document", "state") }),
  command("svg-export", "Return the current diagram SVG through the browser result event.", "diagram", "host", "exportSvg"),
  command("configuration-replace", "Validate and apply a version 1 source/bindings/design/schema package.", "diagram", "host", "replaceConfiguration", { configuration: { type: "object" } }),
  command("configuration-export", "Return the active configuration package through the browser result event.", "diagram", "host", "exportConfiguration"),
  command("color-mode", "Set light or dark mode.", "diagram", "host", "setColorMode", { mode: choice("light", "dark") }),
  command("node-alignment", "Set node alignment.", "diagram", "host", "setNodeAlignment", { alignment: choice("leading", "center", "trailing") }),
  command("default-edge-type", "Set the diagram default edge type.", "diagram", "host", "setEdgeType", { type: token }),
];

export function commandSchema(command: FlowCommand) {
  const properties: Record<string, object> = {
    executionId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" },
    requestId: { type: "string", pattern: "^[A-Za-z0-9_-]{1,128}$" },
  };
  const required = ["executionId"];
  if (command.target !== "diagram") {
    properties[command.target] = { type: "string", minLength: 1, maxLength: 1024 };
    required.push(command.target);
  }
  for (const [name, { optional, ...schema }] of Object.entries(command.fields)) {
    properties[name] = schema;
    if (!optional) required.push(name);
  }
  return { type: "object", additionalProperties: false, properties, required };
}