import sdk = require("@squeed/flow-sdk");

const callbacks: sdk.FlowDiagramCallbacks = {
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
  config: { edgeMode },
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
console.log("CommonJS runtime and public types passed");
