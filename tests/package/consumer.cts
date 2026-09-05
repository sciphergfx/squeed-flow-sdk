import sdk = require("@squeed/flow-sdk");

const callbacks: sdk.FlowDiagramCallbacks = {
  onNodeOutlineChange: (_nodeId, outline) => { void outline.valueOf(); },
  onInit: (engine) => engine.fit(50),
  onEdgeCreate: (_source, _target, mapping) => {
    void mapping?.sourceProperty;
  },
};
const edgeMode: sdk.EdgeMode = "properties";
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
  config: { edgeMode, parentNodeStyle: { outline: true }, selectionToolbar: { hide: ["outline"] } },
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
const outlined = sdk.compileSqueed(sdk.setNodeProp({ node: {} }, "root.node", "$outline", true));
const added = sdk.addChild({ list: { $: [] } }, "root.list", "added");
if (!outlined.nodes.find((node) => node.data.id === "root.node")?.data.viewProps.outline ||
  sdk.getChakraColorHex("transparent") !== "transparent" || sdk.getNode(added.json, added.address) !== "added")
  throw new Error("CommonJS styling and address helpers failed");
console.log("CommonJS runtime and public types passed");
