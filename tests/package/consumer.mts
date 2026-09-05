import {
  addConnection,
  compileSqueed,
  FlowDiagram,
  type EdgeMode,
  type FlowDiagramCallbacks,
  type FlowDiagramProps,
  type FlowEdgeProperties,
  type NodeAlignment,
  type SqueedConnection,
} from "@squeed/flow-sdk";

type AssertFalse<Value extends false> = Value;
type LegacyCallbackRemoved = AssertFalse<
  "onCyInit" extends keyof FlowDiagramCallbacks ? true : false
>;
const removed: LegacyCallbackRemoved = false;
const nodeAlignment: NodeAlignment = "leading";
const edgeMode: EdgeMode = "properties";
const properties: FlowEdgeProperties = {
  sourceProperty: "output",
  targetProperty: "input",
};
const connection: SqueedConnection = { target: "root.database", ...properties };
const props: FlowDiagramProps = {
  json: addConnection(
    { service: { output: "data" }, database: { input: "data" } },
    "root.service",
    connection,
  ),
  config: { nodeAlignment, edgeMode },
  showBottomBar: false,
  callbacks: {
    onEdgeCreate: (_source, _target, mapping) => {
      void mapping?.targetProperty;
    },
    onInit: (engine) => {
      engine.zoomAt(0.5, { x: 100, y: 100 });
      engine.pan({ x: 0, y: 0 });
      engine.fit(50);
      engine.center();
      engine.getNodeBox("root.service");
      engine.modelToClient(engine.clientToModel(100, 100));
      engine.onViewportChange(() => {})();
    },
  },
};
if (
  removed ||
  typeof FlowDiagram !== "function" ||
  !compileSqueed(props.json!).nodes.length ||
  !compileSqueed(props.json!).edges.some(
    (edge) => edge.data.targetProperty === "input",
  )
)
  throw new Error("ESM consumer failed");
console.log("ESM runtime and public types passed");
