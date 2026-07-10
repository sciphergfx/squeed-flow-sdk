import { useState, useEffect, useRef } from "react";
import { Box, Flex, Spinner, Text } from "@chakra-ui/react";
import { FlowDiagramProvider } from "./FlowDiagramContext";
import FlowView from "./FlowView";
import BottomBar from "./BottomBar";
import { createFlowDiagram } from "../core/createFlowDiagram";
import { getJsonSize, applyAutoCollapse } from "../core/autoCollapse";
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

const EMPTY: { nodes: FlowDiagramNode[]; edges: FlowDiagramEdge[] } = { nodes: [], edges: [] };

export function FlowDiagram({
  json,
  title = "untitled",
  nodes: externalNodes,
  edges: externalEdges,
  config = {},
  callbacks = {},
  className,
  style,
  showBottomBar = true,
}: FlowDiagramProps & { showBottomBar?: boolean }) {
  injectStyles();
  const isCntr = (config.direction as string) === "C";
  const isExternal = !!(externalNodes && externalEdges);

  const [computed, setComputed] = useState<{ nodes: FlowDiagramNode[]; edges: FlowDiagramEdge[] } | null>(
    isExternal ? null : null,
  );
  const titleRef = useRef(title);
  titleRef.current = title;

  useEffect(() => {
    if (isExternal) return;
    if (!json) {
      setComputed(EMPTY);
      return;
    }

    setComputed(null);

    const id = requestAnimationFrame(() => {
      let parsed = typeof json === "string" ? JSON.parse(json) : json;

      if (config.autoCollapse) {
        const defaults = { minLines: 800, minDepth: 5, collapseEveryNLevels: 3 };
        const opts = config.autoCollapse === true ? defaults : { ...defaults, ...config.autoCollapse };
        const { lines, depth } = getJsonSize(parsed);
        if (lines > opts.minLines! && depth > opts.minDepth!) {
          parsed = applyAutoCollapse(JSON.parse(JSON.stringify(parsed)), opts.collapseEveryNLevels!);
        }
      }

      const result = createFlowDiagram(parsed, "root", [], [], titleRef.current, {
        hideDefaultObject: false,
        sprtObjctKy: false,
        isCntr,
      });
      setComputed(result);
    });

    return () => cancelAnimationFrame(id);
  }, [json, title, isCntr, config.autoCollapse]);

  const resolvedNodes = isExternal ? externalNodes! : computed?.nodes;
  const resolvedEdges = isExternal ? externalEdges! : computed?.edges;

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
        {!resolvedNodes ? (
          <Flex width="100%" height="100%" align="center" justify="center" direction="column" gap={3}>
            <Spinner size="lg" color={config.themeColor || "blue.500"} speed="0.8s" />
            <Text fontSize="sm" opacity={0.5}>Loading diagram...</Text>
          </Flex>
        ) : (
          <>
            <FlowView nodes={resolvedNodes} edges={resolvedEdges!} />
            {showBottomBar && <BottomBar />}
          </>
        )}
      </Box>
    </FlowDiagramProvider>
  );
}

export default FlowDiagram;
