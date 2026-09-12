import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { StateForms } from "@squeed/flow-sdk";
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
import { createElement, StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { arrangeNodesInGrid } from "../../../src/engine/nodeCollisions";
import MinimalExample from "../../../examples/form-connection/MinimalExample";
import workflowDocument from "../../../examples/workflow-form/ui.json";
import stateBindings from "../../../examples/workflow-state/bindings.json";
import {
  onExampleFormChange,
  projectWorkflowStateView,
  resolveExampleOptions,
} from "../../../examples/workflow-state/callbacks";
import initialState from "../../../examples/workflow-state/state.json";
import stateView from "../../../examples/workflow-state/view.json";
import { ConsumerControls } from "./ConsumerControls";
import { EditableCustomNode } from "./EditableCustomNode";
import { PortNode } from "./PortNode";
import { SvgIconNode } from "./SvgIconNode";

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
  createElement,
  arrangeNodesInGrid,
  engine: null as FlowEngine | null,
  events: [] as Event[],
  document: initialDocument as SqueedJson,
  formState: initialState as SqueedJson,
  replaceDocument: (_document: SqueedJson) => {},
  replaceForms: (_forms: StateForms | undefined) => {},
  configure: (_config: FlowDiagramConfig) => {},
  uploadFormFile: undefined as FlowDiagramCallbacks["uploadFormFile"],
  resolveFormOptions: undefined as FlowDiagramCallbacks["resolveFormOptions"],
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
  const independent = query.get("graph") === "state";
  const raw = !["json", "basic-json", "connections", "state"].includes(
    query.get("graph") ?? "",
  );
  const [formState, setFormState] = useState<SqueedJson>(() =>
    structuredClone(initialState),
  );
  const [document, setDocument] = useState<SqueedJson>(() =>
    structuredClone(
      independent
        ? stateView
        : query.get("graph") === "connections"
          ? connectionDocument
          : query.get("graph") === "json"
            ? workflowDocument
            : initialDocument,
    ),
  );
  const [nodes, setNodes] = useState(() => structuredClone(initialNodes));
  const displayDocument = useMemo(
    () =>
      independent ? projectWorkflowStateView(document, formState) : document,
    [independent, document, formState],
  );
  const [edges, setEdges] = useState(() => structuredClone(initialEdges));
  const [formsOverride, setFormsOverride] = useState<StateForms>();
  const [mounted, setMounted] = useState(true);
  const [config, setConfig] = useState<FlowDiagramConfig>({
    colorMode: "light",
    edgeHandles: true,
    ...(query.has("consumerControls") ? {} : { isEdgeHandlesEnabled: false }),
    editable: true,
    ...(query.has("custom") ? { customViews: { text: CustomNode } } : {}),
    ...(query.get("custom") === "svg-icons"
      ? { customViews: { text: SvgIconNode } }
      : {}),
    ...(query.get("custom") === "ports"
      ? { customViews: { text: PortNode }, edgeMode: "properties" as const }
      : {}),
    ...(query.get("custom") === "editable"
      ? {
          customViews: {
            text: EditableCustomNode,
            arrayView: EditableCustomNode,
            objectView: EditableCustomNode,
          },
        }
      : {}),
    ...(query.has("viewport")
      ? { initialViewport: { pan: { x: 25, y: 35 }, zoom: 0.25 } }
      : {}),
  });
  control.document = document;
  control.formState = formState;
  control.replaceDocument = setDocument;
  control.replaceForms = setFormsOverride;
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
    uploadFormFile: (request) => {
      if (!control.uploadFormFile)
        throw new Error("No test upload handler configured.");
      return control.uploadFormFile(request);
    },
    ...(independent
      ? {
          onFormChange: onExampleFormChange,
          resolveFormOptions: resolveExampleOptions,
        }
      : {}),
    ...(control.resolveFormOptions
      ? { resolveFormOptions: control.resolveFormOptions }
      : {}),
    onInit: (engine) => {
      control.engine = engine;
      record("init");
    },
    onViewportChange: (viewport) => record("viewport", viewport),
    onThemeColorChange: (color) => record("theme-color", color),
    onSpacingChange: (spacing) => record("spacing", spacing),
    onAllNodesIconLabelChange: (enabled) => record("all-icon-labels", enabled),
    onEdgeRadiusChange: (radius) => record("edgeRadius", radius),
    onBackgroundVariantChange: (variant) =>
      record("background-variant", variant),
    onEdgeModeChange: (mode) => record("edge-mode", mode),
    onWorkflowContractChange: (contract) =>
      record("workflow-contract", contract),
    onNodeSelect: (id) => record("select-node", id),
    onNodeDeselect: () => record("deselect-node"),
    onNodeDoubleClick: (id) => record("double-click", id),
    onLayoutComplete: () => record("layout-complete"),
    onNodeCreate: (params) => record("create-node", params),
    onEdgeCreate: (source, target, properties) => {
      record("create-edge", { source, target, ...properties });
      if (query.get("custom") === "ports")
        setEdges((current) => [
          ...current,
          {
            data: {
              id: `port-${current.length}`,
              source,
              target,
              ...properties,
            },
          },
        ]);
    },
    onEdgeSelect: (id) => record("select-edge", id),
    onEdgeIconChange: (id, icon) => {
      record("edge-icon", { id, icon });
      if (raw)
        setEdges((current) =>
          current.map((edge) =>
            edge.data.id === id
              ? { ...edge, data: { ...edge.data, icon: icon || undefined } }
              : edge,
          ),
        );
    },
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
    onNodeContentChange: (id, content) => {
      record("content", { id, content });
      if (raw)
        setNodes((current) =>
          current.map((node) =>
            node.data.id === id
              ? {
                  data: {
                    ...node.data,
                    config: { ...node.data.config, content },
                  },
                }
              : node,
          ),
        );
    },
    onNodeAnimationChange: (id, isNodeAnimated) => {
      record("node-animation", { id, animated: isNodeAnimated });
      if (raw)
        setNodes((current) =>
          current.map((node) =>
            node.data.id === id
              ? { data: { ...node.data, isNodeAnimated } }
              : node,
          ),
        );
    },
    onNodeBorderColorChange: (id, color) => {
      record("border-color", { id, color });
      if (raw)
        setNodes((current) =>
          current.map((node) => {
            if (node.data.id !== id) return node;
            const viewProps = { ...node.data.viewProps };
            if (color) viewProps.borderColor = color;
            else delete viewProps.borderColor;
            return { data: { ...node.data, viewProps } };
          }),
        );
    },
    onNodeBorderStyleChange: (id, borderStyle) => {
      record("border-style", { id, style: borderStyle });
      if (raw)
        setNodes((current) =>
          current.map((node) =>
            node.data.id === id
              ? {
                  data: {
                    ...node.data,
                    viewProps: { ...node.data.viewProps, borderStyle },
                  },
                }
              : node,
          ),
        );
    },
    onNodeBorderWidthChange: (id, width) => {
      record("border-width", { id, width });
      if (raw)
        setNodes((current) =>
          current.map((node) => {
            if (node.data.id !== id) return node;
            const viewProps = { ...node.data.viewProps };
            if (width === undefined) delete viewProps.borderWidth;
            else viewProps.borderWidth = width;
            return { data: { ...node.data, viewProps } };
          }),
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
            {...(raw ? graph : { json: displayDocument })}
            forms={
              formsOverride ??
              (independent
                ? {
                    state: formState,
                    bindings: stateBindings as StateForms["bindings"],
                    onChange: (next, change) => {
                      setFormState(next);
                      record("form-state", change);
                    },
                  }
                : undefined)
            }
            config={config}
            callbacks={callbacks}
            showBottomBar={!query.has("consumerControls")}
          >
            {query.has("consumerControls") && <ConsumerControls />}
          </FlowDiagram>
        )}
      </div>
    </ChakraProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {new URLSearchParams(location.search).get("example") ===
    "minimal-properties" ? (
      <ChakraProvider value={defaultSystem}>
        <MinimalExample />
      </ChakraProvider>
    ) : (
      <Fixture />
    )}
  </StrictMode>,
);
