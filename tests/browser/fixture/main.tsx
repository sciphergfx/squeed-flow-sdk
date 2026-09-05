import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  applyCollapsed,
  FlowDiagram,
  type FlowDiagramCallbacks,
  type FlowDiagramConfig,
  type FlowDiagramEdge,
  type FlowDiagramNode,
  type FlowEngine,
  type SqueedJson,
} from "@squeed/flow-sdk";

const initialDocument = {
  alpha: { $label: "Alpha", $collapsed: false, child: { $label: "Nested" } },
  beta: { $label: "Beta" },
  gamma: { $label: "Gamma" },
};
const connectionDocument = {
  alpha: {
    runtime: "Node",
    api: "REST",
    $target: "root.gamma",
    $connections: [
      { sourceProperty: "api", target: "root.beta", targetProperty: "http" },
      { sourceProperty: "runtime", target: "root.beta", targetProperty: "ws" },
    ],
  },
  beta: { http: "express", ws: "socket.io" },
  gamma: { $label: "Gamma" },
};
const initialNodes: FlowDiagramNode[] = [
  {
    data: {
      id: "alpha",
      type: "text",
      label: "Alpha",
      config: { collapsed: false },
    },
  },
  { data: { id: "beta", type: "text", label: "Beta" } },
  { data: { id: "gamma", type: "text", label: "Gamma" } },
];
const initialEdges: FlowDiagramEdge[] = [
  {
    data: { id: "alpha-beta", source: "alpha", target: "beta", label: "First" },
  },
  {
    data: {
      id: "beta-gamma",
      source: "beta",
      target: "gamma",
      label: "Second",
    },
  },
];

type Event = { name: string; value?: unknown };
const control = {
  engine: null as FlowEngine | null,
  events: [] as Event[],
  document: initialDocument as SqueedJson,
  replaceDocument: (_document: SqueedJson) => {},
  configure: (_config: FlowDiagramConfig) => {},
  mount: (_mounted: boolean) => {},
  resizeNode: (_width: number) => {},
  replaceGraph: (_graph: {
    nodes: FlowDiagramNode[];
    edges: FlowDiagramEdge[];
  }) => {},
};
declare global {
  interface Window {
    __flowTest: typeof control;
  }
}
window.__flowTest = control;

function CustomNode({ data }: { data: FlowDiagramNode["data"] }) {
  return (
    <div
      style={{
        width: data.viewProps?.width ?? 200,
        height: data.viewProps?.height ?? 100,
      }}
    >
      {data.label}
    </div>
  );
}

function Fixture() {
  const query = new URLSearchParams(location.search);
  const raw = !["json", "connections"].includes(query.get("graph") ?? "");
  const [document, setDocument] = useState<SqueedJson>(() =>
    structuredClone(
      query.get("graph") === "connections"
        ? connectionDocument
        : initialDocument,
    ),
  );
  const [nodes, setNodes] = useState(() => structuredClone(initialNodes));
  const [edges, setEdges] = useState(() => structuredClone(initialEdges));
  const [mounted, setMounted] = useState(true);
  const [config, setConfig] = useState<FlowDiagramConfig>({
    colorMode: "light",
    edgeHandles: true,
    isEdgeHandlesEnabled: false,
    editable: true,
    ...(query.has("custom") ? { customViews: { text: CustomNode } } : {}),
    ...(query.has("viewport")
      ? { initialViewport: { pan: { x: 25, y: 35 }, zoom: 0.25 } }
      : {}),
  });
  control.document = document;
  control.replaceDocument = setDocument;
  control.configure = (next) =>
    setConfig((current) => ({ ...current, ...next }));
  control.mount = setMounted;
  control.resizeNode = (width) =>
    setNodes((current) =>
      current.map((node) =>
        node.data.id === "alpha"
          ? { data: { ...node.data, viewProps: { width } } }
          : node,
      ),
    );
  control.replaceGraph = (graph) => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  };

  const record = (name: string, value?: unknown) =>
    control.events.push({ name, value });
  const callbacks: FlowDiagramCallbacks = {
    onInit: (engine) => {
      control.engine = engine;
      record("init");
    },
    onViewportChange: (viewport) => record("viewport", viewport),
    onNodeSelect: (id) => record("select-node", id),
    onNodeDeselect: () => record("deselect-node"),
    onNodeDoubleClick: (id) => record("double-click", id),
    onNodeCreate: (params) => record("create-node", params),
    onEdgeCreate: (source, target, properties) =>
      record("create-edge", { source, target, ...properties }),
    onEdgeSelect: (id) => record("select-edge", id),
    onEdgeDeselect: () => record("deselect-edge"),
    onEdgeRemove: (id, data) => record("remove-edge", { id, data }),
    onDirectionChange: (direction) =>
      setConfig((current) => ({ ...current, direction })),
    onNodeLabelChange: (id, label) => {
      record("label", { id, label });
      if (raw)
        setNodes((current) =>
          current.map((node) =>
            node.data.id === id ? { data: { ...node.data, label } } : node,
          ),
        );
    },
    onNodeOutlineChange: (id, outline) => {
      record("outline", { id, outline });
      if (raw)
        setNodes((current) =>
          current.map((node) =>
            node.data.id === id
              ? {
                  data: {
                    ...node.data,
                    viewProps: { ...node.data.viewProps, outline },
                  },
                }
              : node,
          ),
        );
    },
    onNodeCollapse: (id, collapsed) => {
      record("collapse", { id, collapsed });
      if (raw)
        setNodes((current) =>
          current.map((node) =>
            node.data.id === id
              ? {
                  data: {
                    ...node.data,
                    config: { ...node.data.config, collapsed },
                  },
                }
              : node,
          ),
        );
    },
    onNodeDelete: (id) => {
      record("delete-node", id);
      if (raw) {
        setNodes((current) => current.filter((node) => node.data.id !== id));
        setEdges((current) =>
          current.filter(
            (edge) => edge.data.source !== id && edge.data.target !== id,
          ),
        );
      }
    },
    onEdgeDelete: (id) => {
      record("delete-edge", id);
      if (raw)
        setEdges((current) => current.filter((edge) => edge.data.id !== id));
    },
    onJsonChange: (next, change) => {
      setDocument(next);
      record("json", change);
    },
  };
  const graph = applyCollapsed(nodes, edges);
  return (
    <ChakraProvider value={defaultSystem}>
      <div data-testid="diagram" style={{ height: "100%", width: "100%" }}>
        {mounted && (
          <FlowDiagram
            {...(raw ? graph : { json: document })}
            config={config}
            callbacks={callbacks}
          />
        )}
      </div>
    </ChakraProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
