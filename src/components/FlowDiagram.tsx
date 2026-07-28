import { Box } from "@chakra-ui/react";
import { FlowDiagramProvider } from "./FlowDiagramContext";
import FlowView from "./FlowView";
import BottomBar from "./BottomBar";
import type { FlowDiagramProps, FlowDiagramNode, FlowDiagramEdge } from "../types";

const FLOW_SDK_STYLES = `.cytoscape-react-nodes-and-edges{position:absolute!important;top:0!important;left:0!important;z-index:10!important;pointer-events:none!important;overflow:visible!important;transform-origin:0 0!important}.cytoscape-react-node{z-index:0!important;overflow:visible!important;pointer-events:auto!important;position:absolute!important;transform-origin:0 0!important}.cytoscape-react-node input,.cytoscape-react-node textarea{pointer-events:auto!important;user-select:text!important;cursor:text!important}.cytoscape-react-edge{overflow:visible!important;pointer-events:none!important}.cytoscape-react-cy-container{width:100%!important;height:100%!important;overflow:visible!important;position:relative!important;background:transparent!important}.cytoscape-react-cy-container canvas{display:inline!important;vertical-align:baseline!important;overflow:visible!important}.cytoscape-react-cy-container>div{overflow:visible!important}`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-flow-sdk", "");
  style.textContent = FLOW_SDK_STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

export function FlowDiagram({
  title = "untitled",
  nodes,
  edges,
  config = {},
  callbacks = {},
  className,
  style,
  showBottomBar = true,
}: FlowDiagramProps & { showBottomBar?: boolean }) {
  injectStyles();

  const resolvedNodes: FlowDiagramNode[] = nodes || [];
  const resolvedEdges: FlowDiagramEdge[] = edges || [];

  return (
    <FlowDiagramProvider config={config} callbacks={callbacks}>
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
