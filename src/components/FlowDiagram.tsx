import { Box } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { resolveFormNode } from "../core/forms";
import { recolorGraph } from "../core/recolorGraph";
import { bindSqueedCallbacks } from "../core/squeedBinding";
import { compileSqueed, getNode } from "../core/squeedEdits";
import { NODE_BORDER_ANIMATION_STYLES } from "../engine/NodeBorderAnimation";
import { FormDocumentContext } from "../nodes/NodeForm";
import type {
  FlowDiagramEdge,
  FlowDiagramNode,
  FlowDiagramProps,
} from "../types";
import {
  changeFormState,
  resolveStateForm,
  resolveStateView,
} from "../utils/formState";
import BottomBar from "./BottomBar";
import { FlowDiagramProvider } from "./FlowDiagramContext";
import FlowView from "./FlowView";

const FLOW_SDK_STYLES = `.flow-sdk-canvas{position:relative;width:100%;height:100%;overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:none}.flow-sdk-svg{position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;display:block}.flow-sdk-nodes{position:absolute;top:0;left:0;transform-origin:0 0;pointer-events:none;will-change:transform;backface-visibility:hidden;z-index:10}.flow-sdk-node{position:absolute;top:0;left:0;transform-origin:0 0;pointer-events:auto;will-change:transform;backface-visibility:hidden;z-index:10}.flow-sdk-node input,.flow-sdk-node textarea{pointer-events:auto;user-select:text;-webkit-user-select:text;cursor:text}.flow-sdk-edge-hit{fill:none;stroke:transparent;stroke-width:24px;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}.flow-sdk-container{cursor:pointer}.flow-sdk-edge-anim{animation:flow-sdk-dash .5s linear infinite}.flow-sdk-edge-anim-rev{animation-direction:reverse}@keyframes flow-sdk-dash{to{stroke-dashoffset:-50}}.flow-sdk-draw{cursor:crosshair}.flow-sdk-draw .flow-sdk-node,.flow-sdk-draw .flow-sdk-node input,.flow-sdk-draw .flow-sdk-node textarea,.flow-sdk-draw .flow-sdk-edge,.flow-sdk-draw .flow-sdk-container{pointer-events:none}.flow-sdk-perf.flow-sdk-busy .flow-sdk-edges{display:none}.flow-sdk-box{position:absolute;border:1px solid rgba(170,170,170,.9);background:rgba(221,221,221,.25);pointer-events:none;z-index:20}`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-flow-sdk", "");
  style.textContent =
    FLOW_SDK_STYLES +
    NODE_BORDER_ANIMATION_STYLES +
    `.flow-sdk-handle{position:absolute;left:-36px;top:50%;transform:translateY(-50%);width:36px;height:36px;display:grid;place-items:center;border:2px solid currentColor;border-radius:50%;background:white;cursor:crosshair;opacity:0;pointer-events:none}.flow-sdk-node:hover>.flow-sdk-handle,.flow-sdk-handle:focus-visible{opacity:1;pointer-events:auto}.flow-sdk-draw .flow-sdk-node *,.flow-sdk-draw .flow-sdk-edge *,.flow-sdk-draw .flow-sdk-container *,.flow-sdk-ghost *{pointer-events:none}`;
  document.head.appendChild(style);
  style.textContent += `.flow-sdk-draw .flow-sdk-node{pointer-events:auto}.flow-sdk-draw .flow-sdk-node>.flow-sdk-handle{opacity:0;pointer-events:none}.flow-sdk-draw .flow-sdk-node:hover>.flow-sdk-handle,.flow-sdk-draw .flow-sdk-node>.flow-sdk-handle:focus-visible{opacity:1;pointer-events:auto}`;
  style.textContent += `.flow-sdk-property-port{position:absolute;transform:translateY(-50%);width:32px;height:32px;margin:0;padding:0;border:3px solid currentColor;border-radius:50%;background:white;cursor:crosshair;pointer-events:auto;z-index:20}.flow-sdk-property-port[data-port-role="source"]{background:currentColor}.flow-sdk-property-port:hover{outline:3px solid currentColor;outline-offset:3px}.flow-sdk-draw .flow-sdk-node .flow-sdk-property-port{pointer-events:auto}`;
  stylesInjected = true;
}

export function FlowDiagram({ loading = false, loader, ...props }: FlowDiagramProps) {
  const [prepared, setPrepared] = useState<{ json: FlowDiagramProps["json"] } | null>(null);
  const pending = prepared === null || prepared.json !== props.json;
  const busy = loading || pending;

  useEffect(() => {
    if (loading || !pending) return;
    let nextFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      nextFrame = requestAnimationFrame(() => setPrepared({ json: props.json }));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (nextFrame !== undefined) cancelAnimationFrame(nextFrame);
    };
  }, [loading, pending, props.json]);

  return (
    <Box className={props.className} style={props.style} width="100%" height="100%" position="relative" aria-busy={busy}>
      <div style={{ width: "100%", height: "100%" }} ref={element => {
        if (busy) element?.setAttribute("inert", "");
        else element?.removeAttribute("inert");
      }}>
        {prepared && <FlowDiagramContent {...props} className={undefined} style={undefined} json={prepared.json} />}
      </div>
      {busy && <Box data-flow-loader="" role="status" aria-label="Loading diagram" position="absolute" inset={0} zIndex={1000} display="grid" placeItems="center" background={props.config?.colorMode === "dark" ? "gray.800" : "gray.100"} color={props.config?.colorMode === "dark" ? "whiteAlpha.800" : "blackAlpha.800"}>
        {loader === undefined ? <span>Loading diagram...</span> : loader}
      </Box>}
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

  const resolvedNodes: FlowDiagramNode[] = useMemo(() => {
    const source = compiled?.nodes ?? nodes ?? [];
    return source.map((node) => {
      const labelBelow =
        (json && getNode(json, node.data.id)?.$view === "icon-label") ||
        node.data.config?.labelBelow;
      const form =
        formSchema &&
        (forms
          ? resolveStateForm(forms.bindings, node.data.id, formSchema)
          : json && resolveFormNode(json, node.data.id, formSchema));
      return form || labelBelow
        ? {
            ...node,
            data: {
              ...node.data,
              type: labelBelow ? "arrayView" : "objectView",
              ...(forms
                ? {
                    description: Object.fromEntries(
                      Object.entries(node.data.description ?? {}).filter(
                        ([key]) => !key.startsWith("$"),
                      ),
                    ),
                  }
                : {}),
              config: {
                ...node.data.config,
                ...(form ? { form: true } : {}),
                ...(labelBelow ? { labelBelow: true } : {}),
              },
            },
          }
        : node;
    });
  }, [compiled, nodes, json, formSchema, forms?.bindings]);
  const resolvedEdges: FlowDiagramEdge[] = compiled?.edges ?? edges ?? [];

  // Document mode: edits are applied to the JSON and surfaced via onJsonChange
  const viewCallbacks = useMemo(
    () =>
      json && compiled
        ? bindSqueedCallbacks(
            json,
            compiled.edges,
            callbacks,
            callbacks.onJsonChange,
            formSchema,
          )
        : callbacks,
    [json, compiled, callbacks, formSchema],
  );
  const boundCallbacks = useMemo(() => {
    if (!forms) return viewCallbacks;
    let state = forms.state;
    return {
      ...viewCallbacks,
      onFormChange: (change: import("../core/forms").FormChange) => {
        const onStateChange = forms.onStateChange ?? forms.onChange;
        if (!onStateChange) return;
        const next = changeFormState(state, change, callbacks.onFormChange);
        if (next === state) return;
        state = next;
        onStateChange(next, { ...change, data: next });
      },
    };
  }, [viewCallbacks, forms, callbacks.onFormChange]);

  return (
    <FormDocumentContext.Provider
      value={{
        data: forms?.state ?? json,
        viewData: json,
        bindings: forms?.bindings,
        editable: forms ? !!(forms.onStateChange ?? forms.onChange) : !!callbacks.onJsonChange,
        schema: formSchema,
        setSchema: (schema) => {
          setLocalFormSchema(schema);
          callbacks.onFormSchemaChange?.(schema);
        },
        callbacks: boundCallbacks,
      }}
    >
      <FlowDiagramProvider
        config={config}
        callbacks={boundCallbacks}
        nodes={resolvedNodes}
        edges={resolvedEdges}
      >
        <Box
          className={className}
          data-flow-diagram=""
          style={style}
          width="100%"
          height="100%"
          position="relative"
          overflow="hidden"
          css={{
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
