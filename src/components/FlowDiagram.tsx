import { Box } from "@chakra-ui/react";
import { useMemo } from "react";
import { bindSqueedCallbacks } from "../core/squeedBinding";
import { compileSqueed } from "../core/squeedEdits";
import { NODE_BORDER_ANIMATION_STYLES } from "../engine/NodeBorderAnimation";
import type {
  FlowDiagramEdge,
  FlowDiagramNode,
  FlowDiagramProps,
} from "../types";
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
  style.textContent += `.flow-sdk-property-port{position:absolute;transform:translateY(-50%);width:32px;height:32px;margin:0;padding:0;border:3px solid currentColor;border-radius:50%;background:white;cursor:crosshair;pointer-events:auto;z-index:20}.flow-sdk-property-port[data-port-role="source"]{background:currentColor}.flow-sdk-property-port:hover{outline:3px solid currentColor;outline-offset:3px}.flow-sdk-draw .flow-sdk-node .flow-sdk-property-port{pointer-events:auto}`;
  stylesInjected = true;
}

export function FlowDiagram({
  title = "untitled",
  json,
  nodes,
  edges,
  config = {},
  callbacks = {},
  className,
  style,
  showBottomBar = true,
}: FlowDiagramProps) {
  injectStyles();

  const isCenter = config.direction === "C";
  const compiled = useMemo(
    () => (json ? compileSqueed(json, { title, isCenter }) : null),
    [json, title, isCenter],
  );

  const resolvedNodes: FlowDiagramNode[] = compiled?.nodes ?? nodes ?? [];
  const resolvedEdges: FlowDiagramEdge[] = compiled?.edges ?? edges ?? [];

  // Document mode: edits are applied to the JSON and surfaced via onJsonChange
  const boundCallbacks = useMemo(
    () =>
      json && compiled
        ? bindSqueedCallbacks(
            json,
            compiled.edges,
            callbacks,
            callbacks.onJsonChange,
          )
        : callbacks,
    [json, compiled, callbacks],
  );

  return (
    <FlowDiagramProvider
      config={config}
      callbacks={boundCallbacks}
      nodes={resolvedNodes}
      edges={resolvedEdges}
    >
      <Box
        className={className}
        style={style}
        width="100%"
        height="100%"
        position="relative"
        overflow="hidden"
      >
        <FlowView nodes={resolvedNodes} edges={resolvedEdges} />
        {showBottomBar && <BottomBar />}
      </Box>
    </FlowDiagramProvider>
  );
}

export default FlowDiagram;
