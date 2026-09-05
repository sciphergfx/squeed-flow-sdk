import sdk = require("@squeed/flow-sdk");

const callbacks: sdk.FlowDiagramCallbacks = {
  onNodeBorderColorChange: (_nodeId, color) => {
    void color.length;
  },
  onNodeBorderStyleChange: (_nodeId, style) => {
    void style.toUpperCase();
  },
  onNodeBorderWidthChange: (_nodeId, width) => {
    void width?.toFixed(1);
  },
  onNodeContentChange: (_nodeId, content) => {
    void content.length;
  },
  onNodeAnimationChange: (_nodeId, animated) => {
    void animated.valueOf();
  },
  onNodeOutlineChange: (_nodeId, outline) => {
    void outline.valueOf();
  },
  onInit: (engine) => engine.fit(50),
  onEdgeCreate: (_source, _target, mapping) => {
    void mapping?.sourceProperty;
  },
};
const edgeMode: sdk.EdgeMode = "nodes";
const properties: sdk.FlowEdgeProperties = {
  sourceProperty: "output",
  targetProperty: "input",
};
const connection: sdk.SqueedConnection = {
  target: "root.database",
  ...properties,
};
const props: sdk.FlowDiagramProps = {
  callbacks,
  showBottomBar: true,
  config: {
    edgeMode,
    parentNodeStyle: { outline: true },
    selectionToolbar: { hide: ["outline", "animation", "borderColor"] },
  },
};
const result = sdk.compileSqueed(
  sdk.addConnection(
    { service: { output: "data" }, database: { input: "data" } },
    "root.service",
    connection,
  ),
);
if (
  !props.callbacks ||
  typeof sdk.FlowDiagram !== "function" ||
  !result.nodes.length ||
  !result.edges.some((edge) => edge.data.sourceProperty === "output")
)
  throw new Error("CommonJS consumer failed");
const outlined = sdk.compileSqueed(
  sdk.setNodeProp({ node: {} }, "root.node", "$outline", true),
);
const added = sdk.addChild({ list: { $: [] } }, "root.list", "added");
if (
  !outlined.nodes.find((node) => node.data.id === "root.node")?.data.viewProps
    .outline ||
  sdk.getChakraColorHex("transparent") !== "transparent" ||
  sdk.getNode(added.json, added.address) !== "added"
)
  throw new Error("CommonJS styling and address helpers failed");
const contentGraph = sdk.compileSqueed(
  sdk.setNodeProp(
    sdk.setNodeProp({ node: {} }, "root.node", "$content", ""),
    "root.node",
    "$isNodeAnimated",
    true,
  ),
);
const contentNode = contentGraph.nodes.find(
  (node) => node.data.id === "root.node",
)!;
if (
  contentNode.data.config?.content !== "" ||
  !contentNode.data.isNodeAnimated ||
  contentNode.data.type !== "objectView"
)
  throw new Error("CommonJS content and animation API failed");
console.log("CommonJS runtime and public types passed");
void sdk.parseTypeScriptContract("interface Graph { source: { value: string }; target: { value: number } }", "graph.ts").then((contract: sdk.WorkflowContract) => {
  if (!sdk.connectionIssue(contract, { id: "mapping", source: "source", target: "target", sourceProperty: "value", targetProperty: "value" })) throw new Error("CommonJS workflow validation failed");
  console.log("CommonJS lazy TypeScript contract parsing passed");
});
