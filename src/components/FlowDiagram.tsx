import { Box } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { resolveFormNode } from "../core/forms";
import { isColorOnlyUpdate, recolorGraph } from "../core/recolorGraph";
import { bindSqueedCallbacks } from "../core/squeedBinding";
import { compileSqueed, getNode } from "../core/squeedEdits";
import { EDGE_REVEAL_STYLES } from "../engine/EdgeReveal";
import { EDGE_TRACE_ANIMATION_STYLES } from "../engine/EdgeTraceAnimation";
import { NODE_BORDER_ANIMATION_STYLES } from "../engine/NodeBorderAnimation";
import { FormDocumentContext } from "../nodes/NodeForm";
import type {
  FlowDiagramEdge,
  FlowDiagramNode,
  FlowDiagramProps,
} from "../types";
import { NODE_TYPE_VIEWS, type NodeTypeView } from "../types";
import {
  changeFormState,
  resolveStateForm,
  resolveStateView,
} from "../utils/formState";
import {
  emptyValue,
  projectStructuredForms,
  slotKey,
  structuredConnectionValue,
} from "../utils/structuredForms";
import BottomBar from "./BottomBar";
import { FlowDiagramProvider } from "./FlowDiagramContext";
import FlowView from "./FlowView";

const FLOW_SDK_STYLES = `.flow-sdk-canvas{position:relative;width:100%;height:100%;overflow:clip;user-select:none;-webkit-user-select:none;touch-action:none}.flow-sdk-svg{position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;display:block}.flow-sdk-nodes{position:absolute;top:0;left:0;transform-origin:0 0;pointer-events:none;will-change:transform;backface-visibility:hidden;z-index:10}.flow-sdk-node{position:absolute;top:0;left:0;transform-origin:0 0;pointer-events:auto;will-change:transform;backface-visibility:hidden;z-index:10}.flow-sdk-node input,.flow-sdk-node textarea{pointer-events:auto;user-select:text;-webkit-user-select:text;cursor:text}.flow-sdk-edge-hit{fill:none;stroke:transparent;stroke-width:24px;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}.flow-sdk-container{cursor:pointer}.flow-sdk-edge-anim{animation:flow-sdk-dash .5s linear infinite}.flow-sdk-edge-anim-rev{animation-direction:reverse}@keyframes flow-sdk-dash{to{stroke-dashoffset:-50}}.flow-sdk-draw{cursor:crosshair}.flow-sdk-draw .flow-sdk-node,.flow-sdk-draw .flow-sdk-node input,.flow-sdk-draw .flow-sdk-node textarea,.flow-sdk-draw .flow-sdk-edge,.flow-sdk-draw .flow-sdk-container{pointer-events:none}.flow-sdk-perf.flow-sdk-busy .flow-sdk-edges{display:none}.flow-sdk-box{position:absolute;border:1px solid rgba(170,170,170,.9);background:rgba(221,221,221,.25);pointer-events:none;z-index:20}`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-flow-sdk", "");
  style.textContent =
    FLOW_SDK_STYLES +
    ".flow-sdk-canvas[data-node-grid] .flow-sdk-node,.flow-sdk-canvas[data-node-grid] .flow-sdk-node *,.flow-sdk-canvas[data-node-grid] .flow-sdk-node *::before,.flow-sdk-canvas[data-node-grid] .flow-sdk-node *::after{animation:none!important;transition:none!important}" +
    ".flow-sdk-node[data-grid-fill] [data-flow-icon-label]{--flow-grid-caption-color:var(--flow-grid-on-surface-color)}" +
    ".flow-sdk-node[data-grid-fill] [data-flow-node-surface]{border:0;outline:none;box-shadow:none}" +
    `.flow-sdk-node[data-grid-fill]{box-sizing:border-box}.flow-sdk-node[data-grid-fill] :not(svg):has([data-flow-node-surface]),.flow-sdk-node[data-grid-fill]>:not(svg):not(button){width:100%;height:100%;min-width:0;max-width:none}.flow-sdk-node[data-grid-fill] [data-flow-node-surface]{width:100%;height:100%;min-width:0;max-width:none;box-sizing:border-box;overflow:hidden}.flow-sdk-node[data-grid-fill] [data-flow-icon-label]{gap:0}.flow-sdk-node[data-grid-fill] [data-flow-icon-caption]{position:absolute;bottom:12px;left:12px;width:calc(100% - 24px);max-height:40%;overflow:hidden}.flow-sdk-node[data-grid-fill] [data-flow-node-surface]>svg{max-width:45%;max-height:55%}.flow-sdk-node[data-grid-fill] p{font-size:var(--flow-grid-font);white-space:normal;overflow-wrap:anywhere}` +
    ".flow-sdk-canvas[data-node-grid]:not([data-grid-connections]) .flow-sdk-property-port,.flow-sdk-canvas[data-node-grid]:not([data-grid-connections]) .flow-sdk-handle,.flow-sdk-canvas[data-node-grid] [data-flow-collapse-control]{display:none}.flow-sdk-node[data-grid-draggable] :not(button):not(input):not(textarea):not(select):not(a){cursor:inherit}" +
    NODE_BORDER_ANIMATION_STYLES +
    EDGE_TRACE_ANIMATION_STYLES +
    EDGE_REVEAL_STYLES +
    `.flow-sdk-handle{position:absolute;left:-36px;top:50%;transform:translateY(-50%);width:36px;height:36px;display:grid;place-items:center;border:2px solid currentColor;border-radius:50%;background:white;cursor:crosshair;opacity:0;pointer-events:none}.flow-sdk-node:hover>.flow-sdk-handle,.flow-sdk-handle:focus-visible{opacity:1;pointer-events:auto}.flow-sdk-draw .flow-sdk-node *,.flow-sdk-draw .flow-sdk-edge *,.flow-sdk-draw .flow-sdk-container *,.flow-sdk-ghost *{pointer-events:none}`;
  document.head.appendChild(style);
  style.textContent += `.flow-sdk-draw .flow-sdk-node{pointer-events:auto}.flow-sdk-draw .flow-sdk-node>.flow-sdk-handle{opacity:0;pointer-events:none}.flow-sdk-draw .flow-sdk-node:hover>.flow-sdk-handle,.flow-sdk-draw .flow-sdk-node>.flow-sdk-handle:focus-visible{opacity:1;pointer-events:auto}`;
  style.textContent += `.flow-sdk-property-port{position:absolute;transform:translateY(-50%);width:32px;height:32px;margin:0;padding:0;border:3px solid currentColor;border-radius:50%;background:white;cursor:crosshair;pointer-events:auto;z-index:20}.flow-sdk-property-port[data-port-role="source"]{background:currentColor}.flow-sdk-property-port:hover{outline:3px solid currentColor;outline-offset:3px}.flow-sdk-draw .flow-sdk-node .flow-sdk-property-port{pointer-events:auto}`;
  stylesInjected = true;
}

export function FlowDiagram({
  loading = false,
  loader,
  ...props
}: FlowDiagramProps) {
  const [prepared, setPrepared] = useState<FlowDiagramProps | null>(null);
  const colorOnly = useMemo(
    () =>
      !!prepared?.json &&
      !!props.json &&
      isColorOnlyUpdate(prepared.json, props.json),
    [prepared?.json, props.json],
  );
  const pending =
    prepared === null || (prepared.json !== props.json && !colorOnly);
  const busy = loading || pending;

  useEffect(() => {
    if (!loading && colorOnly && prepared?.json !== props.json)
      setPrepared(props);
  }, [loading, colorOnly, prepared?.json, props.json]);

  useEffect(() => {
    if (loading || !pending) return;
    let nextFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      nextFrame = requestAnimationFrame(() => setPrepared(props));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (nextFrame !== undefined) cancelAnimationFrame(nextFrame);
    };
  }, [loading, pending, props.json]);

  return (
    <Box
      className={props.className}
      style={props.style}
      width="100%"
      height="100%"
      position="relative"
      aria-busy={busy}
    >
      <div
        style={{ width: "100%", height: "100%" }}
        ref={(element) => {
          const editing =
            element?.contains(document.activeElement) &&
            document.activeElement?.matches(
              "input, textarea, [contenteditable=true]",
            );
          if (busy && (loading || !editing)) element?.setAttribute("inert", "");
          else element?.removeAttribute("inert");
        }}
      >
        {prepared && (
          <FlowDiagramContent
            {...(pending ? prepared : props)}
            children={props.children}
            config={props.config}
            className={undefined}
            style={undefined}
          />
        )}
      </div>
      {busy && loader !== null && (
        <Box
          data-flow-loader=""
          role="status"
          aria-label="Loading diagram"
          position="absolute"
          inset={0}
          zIndex={1000}
          display="grid"
          placeItems="center"
          background={
            props.config?.colorMode === "dark" ? "gray.800" : "gray.100"
          }
          color={
            props.config?.colorMode === "dark"
              ? "whiteAlpha.800"
              : "blackAlpha.800"
          }
        >
          {loader === undefined ? <span>Loading diagram...</span> : loader}
        </Box>
      )}
    </Box>
  );
}

function FlowDiagramContent({
  title = "untitled",
  json,
  forms,
  nodes,
  edges,
  config = {},
  callbacks = {},
  className,
  style,
  showBottomBar = true,
  children,
}: FlowDiagramProps) {
  injectStyles();
  const [localFormSchema, setLocalFormSchema] =
    useState<import("../core/forms").FormSchema>();
  const [allNodesIconLabel, setAllNodesIconLabel] = useState(false);
  const formSchema = config.formSchema ?? localFormSchema;
  const displayJson = useMemo(
    () => (json && forms ? resolveStateView(json, forms.state) : json),
    [json, forms?.state],
  );

  const isCenter = config.direction === "C";
  const compileDocument = useMemo(() => {
    let previous: typeof json;
    let graph: ReturnType<typeof compileSqueed> | undefined;
    return (document: NonNullable<typeof json>) => {
      graph =
        previous && graph
          ? (recolorGraph(previous, document, graph) ??
            compileSqueed(document, { title, isCenter }))
          : compileSqueed(document, { title, isCenter });
      previous = document;
      return graph;
    };
  }, [title, isCenter]);
  const compiled = useMemo(
    () => (displayJson ? compileDocument(displayJson) : null),
    [displayJson, compileDocument],
  );

  const structured = useMemo(
    () =>
      forms?.structured && !allNodesIconLabel && formSchema
        ? projectStructuredForms(
            forms.state,
            forms.bindings,
            formSchema,
            compiled?.nodes ?? nodes ?? [],
          )
        : undefined,
    [
      forms?.structured,
      allNodesIconLabel,
      forms?.state,
      forms?.bindings,
      formSchema,
      compiled,
      nodes,
    ],
  );
  const activeSchema = structured?.schema ?? formSchema;
  const activeBindings = structured?.bindings ?? forms?.bindings;

  const resolvedNodes: FlowDiagramNode[] = useMemo(() => {
    const source = [
      ...(compiled?.nodes ?? nodes ?? []),
      ...(structured?.nodes ?? []),
    ];
    return source.map((node) => {
      const requestedView = json
        ? getNode(json, node.data.id)?.$view
        : node.data.config?.typeView;
      const typeView: NodeTypeView | undefined =
        requestedView && NODE_TYPE_VIEWS.includes(requestedView)
          ? requestedView
          : undefined;
      const labelBelow = typeView
        ? typeView === "icon-label"
        : node.data.config?.labelBelow;
      const renderedType =
        typeView === "object"
          ? "objectView"
          : typeView === "text"
            ? "text"
            : labelBelow
              ? "arrayView"
              : node.data.type;
      const form =
        activeSchema &&
        (forms
          ? resolveStateForm(activeBindings!, node.data.id, activeSchema)
          : json && resolveFormNode(json, node.data.id, activeSchema));
      const ports = (node.data.config?.ports ?? []).map((port) => ({
        ...port,
      }));
      if (structured && form) {
        const sides =
          config.direction === "RL"
            ? { input: "right", output: "left", config: "bottom", error: "top" }
            : config.direction === "TB"
              ? {
                  input: "top",
                  output: "bottom",
                  config: "right",
                  error: "left",
                }
              : config.direction === "BT"
                ? {
                    input: "bottom",
                    output: "top",
                    config: "left",
                    error: "right",
                  }
                : {
                    input: "left",
                    output: "right",
                    config: "top",
                    error: "bottom",
                  };
        for (const [name, port] of Object.entries(form.type.ports ?? {})) {
          const id = `${port.kind}:${name}`;
          const existing = ports.find((candidate) => candidate.id === id);
          if (existing) {
            if (existing.label === undefined && port.label !== undefined)
              existing.label = port.label;
          } else
            ports.push({
              id,
              ...(port.label !== undefined ? { label: port.label } : {}),
              role:
                port.kind === "input" || port.kind === "config"
                  ? "target"
                  : "source",
              side: sides[port.kind],
              ...(port.kind === "config" ? { placement: "config" } : {}),
            });
        }
        for (const port of ports) {
          const siblings = ports.filter(
            (candidate) => candidate.side === port.side,
          );
          port.position = (siblings.indexOf(port) + 1) / (siblings.length + 1);
        }
      }
      return form || labelBelow || typeView
        ? {
            ...node,
            data: {
              ...node.data,
              type: renderedType,
              ...(forms
                ? {
                    description: Object.fromEntries(
                      Object.entries(node.data.description ?? {}).filter(
                        ([key]) =>
                          !key.startsWith("$") &&
                          !structured?.slots.has(slotKey(node.data.id, key)),
                      ),
                    ),
                  }
                : {}),
              config: {
                ...node.data.config,
                ...(structured && form ? { ports } : {}),
                ...(form ? { form: true } : {}),
                ...(typeView
                  ? { typeView, labelBelow: !!labelBelow }
                  : labelBelow
                    ? { labelBelow: true }
                    : {}),
              },
            },
          }
        : node;
    });
  }, [
    compiled,
    nodes,
    json,
    activeSchema,
    activeBindings,
    structured,
    config.direction,
  ]);
  const resolvedEdges = useMemo<FlowDiagramEdge[]>(
    () => [...(compiled?.edges ?? edges ?? []), ...(structured?.edges ?? [])],
    [compiled?.edges, edges, structured?.edges],
  );

  // Document mode: edits are applied to the JSON and surfaced via onJsonChange
  const viewCallbacks = useMemo(() => {
    const bound =
      json && compiled
        ? bindSqueedCallbacks(
            json,
            compiled.edges,
            callbacks,
            callbacks.onJsonChange,
            formSchema,
          )
        : { ...callbacks };
    if (structured) {
      const generated = new Set([
        ...structured.nodes.map((node) => node.data.id),
        ...structured.edges.map((edge) => edge.data.id),
      ]);
      for (const name of Object.keys(bound)) {
        if (!/^on(?:Node|Edge).*(?:Change|Collapse)$/.test(name)) continue;
        const handler = bound[name];
        bound[name] = (id: string, ...args: unknown[]) => {
          if (!generated.has(id)) return handler?.(id, ...args);
        };
      }
    }
    return {
      ...bound,
      onAllNodesIconLabelChange: (enabled: boolean) => {
        setAllNodesIconLabel(enabled);
        bound.onAllNodesIconLabelChange?.(enabled);
      },
    };
  }, [json, compiled, callbacks, formSchema, structured]);
  const boundCallbacks = useMemo(() => {
    if (!forms) return viewCallbacks;
    let state = forms.state;
    const applyChange = (change: import("../core/forms").FormChange) => {
      if (config.readOnly || config.editable === false) return;
      const onStateChange = forms.onStateChange ?? forms.onChange;
      if (!onStateChange) return;
      const next = changeFormState(state, change, callbacks.onFormChange);
      if (next === state) return;
      state = next;
      onStateChange(next, { ...change, data: next });
    };
    const referenceChange = (
      nodeAddress: string,
      key: "$content" | "$label",
      value: import("../types").NodeContent,
    ) => {
      const reference = json && getNode(json, nodeAddress)?.[key];
      if (!reference || typeof reference.$state !== "string") return false;
      applyChange({
        address: reference.$state,
        nodeAddress,
        previousValue: getNode(state, reference.$state),
        value,
        data: state,
      });
      return true;
    };
    return {
      ...viewCallbacks,
      onFormChange: applyChange,
      onNodeCreateRequest: (
        request: import("../types").FlowNodeCreationRequest,
      ) => {
        const field = request.sourceProperty?.startsWith("config:")
          ? request.sourceProperty.slice(7)
          : undefined;
        const slot =
          field !== undefined &&
          structured?.slots.get(slotKey(request.sourceNodeId, field));
        if (!slot) return viewCallbacks.onNodeCreateRequest?.(request) ?? false;
        if (!slot.present)
          applyChange({
            data: state,
            nodeAddress: slot.address.split(".").slice(0, -1).join("."),
            address: slot.address,
            value: emptyValue(slot.type),
            previousValue: undefined,
          });
        return true;
      },
      onNodeDelete: (id: string, data: any) => {
        if (!structured?.nodes.some((node) => node.data.id === id))
          return viewCallbacks.onNodeDelete?.(id, data);
        const slot =
          structured &&
          [...structured.slots.values()].find((slot) => slot.nodeId === id);
        if (!slot) return viewCallbacks.onNodeDelete?.(id, data);
        const parts = slot.address.split(".");
        const field = parts.pop()!;
        const parentAddress = parts.join(".");
        const parent = getNode(state, parentAddress);
        applyChange(
          Array.isArray(parent)
            ? {
                data: state,
                nodeAddress: parentAddress,
                address: parentAddress,
                previousValue: parent,
                value: parent.filter((_, index) => String(index) !== field),
              }
            : {
                data: state,
                nodeAddress: parentAddress,
                address: slot.address,
                previousValue: getNode(state, slot.address),
                value: undefined,
              },
        );
      },
      onEdgeCreate: (
        source: string,
        target: string,
        properties?: import("../types").FlowEdgeProperties,
      ) => {
        const slot =
          properties?.targetProperty?.startsWith("config:") &&
          structured?.slots.get(
            slotKey(target, properties.targetProperty.slice(7)),
          );
        const container = structured?.containers.get(source);
        if (
          slot &&
          container &&
          properties?.sourceProperty === "output:resource"
        ) {
          const value = structuredConnectionValue(state, container, slot);
          if (value !== undefined)
            applyChange({
              data: state,
              nodeAddress: slot.address.split(".").slice(0, -1).join("."),
              address: slot.address,
              previousValue: getNode(state, slot.address),
              value,
            });
          return;
        }
        if (
          slot ||
          structured?.nodes.some(
            (node) => node.data.id === source || node.data.id === target,
          )
        )
          return;
        viewCallbacks.onEdgeCreate?.(source, target, properties);
      },
      onEdgeDelete: (id: string, data: any) => {
        const edge = structured?.edges.find((edge) => edge.data.id === id);
        if (!edge) return viewCallbacks.onEdgeDelete?.(id, data);
        const slot = structured!.slots.get(
          slotKey(edge.data.target, edge.data.targetProperty!.slice(7)),
        )!;
        const parts = slot.address.split(".");
        const field = parts.pop()!;
        const parentAddress = parts.join(".");
        const parent = getNode(state, parentAddress);
        applyChange(
          Array.isArray(parent)
            ? {
                data: state,
                nodeAddress: parentAddress,
                address: parentAddress,
                previousValue: parent,
                value: parent.filter((_, index) => String(index) !== field),
              }
            : {
                data: state,
                nodeAddress: parentAddress,
                address: slot.address,
                previousValue: getNode(state, slot.address),
                value: undefined,
              },
        );
      },
      onNodeContentChange: (
        id: string,
        content: import("../types").NodeContent,
      ) => {
        if (referenceChange(id, "$content", content))
          callbacks.onNodeContentChange?.(id, content);
        else viewCallbacks.onNodeContentChange?.(id, content);
      },
      onNodeLabelChange: (id: string, label: string) => {
        if (referenceChange(id, "$label", label))
          callbacks.onNodeLabelChange?.(id, label);
        else viewCallbacks.onNodeLabelChange?.(id, label);
      },
    };
  }, [
    viewCallbacks,
    forms,
    json,
    callbacks,
    structured,
    config.readOnly,
    config.editable,
  ]);

  return (
    <FormDocumentContext.Provider
      value={{
        data: forms?.state ?? json,
        viewData: json,
        bindings: activeBindings,
        references: forms?.references,
        structured,
        renderForm: forms?.renderForm,
        editable: forms
          ? !!(forms.onStateChange ?? forms.onChange)
          : !!callbacks.onJsonChange,
        schema: activeSchema,
        setSchema: (schema) => {
          setLocalFormSchema(schema);
          callbacks.onFormSchemaChange?.(schema);
        },
        callbacks: boundCallbacks,
      }}
    >
      <FlowDiagramProvider
        config={structured ? { ...config, formSchema: activeSchema } : config}
        callbacks={boundCallbacks}
        nodes={resolvedNodes}
        edges={resolvedEdges}
      >
        <Box
          className={className}
          data-flow-diagram=""
          data-animations-disabled={config.disableAnimations || undefined}
          style={style}
          width="100%"
          height="100%"
          position="relative"
          overflow="hidden"
          css={{
            "&[data-animations-disabled], &[data-animations-disabled] *, &[data-animations-disabled] *::before, &[data-animations-disabled] *::after":
              {
                animation: "none !important",
                transition: "none !important",
              },
            "& input, & textarea, & select": {
              outline: "none !important",
              boxShadow: "none !important",
            },
          }}
        >
          <FlowView nodes={resolvedNodes} edges={resolvedEdges} />
          {showBottomBar && <BottomBar />}
          {children}
        </Box>
      </FlowDiagramProvider>
    </FormDocumentContext.Provider>
  );
}

export default FlowDiagram;
