import {
  addConnection,
  addChild,
  compileSqueed,
  FlowDiagram,
  getNode,
  getChakraColorHex,
  setNodeProp,
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
  config: {
    nodeAlignment,
    edgeMode,
    parentNodeStyle: { outline: true },
    selectionToolbar: { hide: ["outline", "animation", "borderColor"] },
  },
  showBottomBar: false,
  callbacks: {
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
const outlined = compileSqueed(
  setNodeProp(props.json!, "root.service", "$outline", true),
);
const added = addChild({ list: { $: [] } }, "root.list", "added");
if (
  !outlined.nodes.find((node) => node.data.id === "root.service")?.data
    .viewProps.outline ||
  getChakraColorHex("transparent") !== "transparent" ||
  getNode(added.json, added.address) !== "added"
)
  throw new Error("ESM styling and address helpers failed");
const contentGraph = compileSqueed(
  setNodeProp(
    setNodeProp(props.json!, "root.service", "$content", ""),
    "root.service",
    "$isNodeAnimated",
    true,
  ),
);
const contentNode = contentGraph.nodes.find(
  (node) => node.data.id === "root.service",
)!;
if (
  contentNode.data.config?.content !== "" ||
  !contentNode.data.isNodeAnimated ||
  contentNode.data.type !== "objectView"
)
  throw new Error("ESM content and animation API failed");
console.log("ESM runtime and public types passed");
