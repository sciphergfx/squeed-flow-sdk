//PRORIERTY CONTENT IN THIS FILE - AI mUST SKIP MAKING CHANGES!

import { isArray } from "lodash";

import { nodePlainTextConfig } from "./nodeConfigs";
import {
  collectConfigObject,
  collectIterObject,
  collectObjWithRefs,
  collectPlainObject,
  createEdge,
  createNode,
  getCustomizations,
  isObject,
  processIdenticalPaths,
} from "./createFlowDiagramComponents";
import { createFlowDiagramIds } from "./createFlowDiagramIds";

const invrtdRtPths = [];
let initalObjIds;

export function createFlowDiagram(
  jsnObjct: any,
  path: string = "root",
  nodes: any[] = [],
  edges: any[] = [],
  activeLabel: string = "untitled",
  flowConfig: any = {
    hideDefaultObject: false,
    sprtObjctKy: false,
    isCntr: false,
  },
  nodeConfig: any = {},
): { nodes: any[]; edges: any[] } {
  if (!jsnObjct || typeof jsnObjct !== "object") {
    console.error("Invalid object passed", jsnObjct);
    return { nodes, edges };
  }

  const orgJsnObjct = jsnObjct;

  if (!initalObjIds) {
    const { nodes: ids } = createFlowDiagramIds(jsnObjct);
    initalObjIds = { ids, jsnObjct };
  }

  let { hideDefaultObject, sprtObjctKy } = flowConfig;

  try {
    path = processIdenticalPaths(path, nodes);

    const { newConfig: nConfig, arrayObject } = collectConfigObject(jsnObjct);
    const newConfig = Object.keys(nodeConfig).length > 0 ? nodeConfig : nConfig;

    if (arrayObject.length) {
      jsnObjct = arrayObject;
    }
    const plnObjct = collectPlainObject(jsnObjct);
    const itrblObjct = collectIterObject(jsnObjct);

    const { label, collapsed, parent } = newConfig as any;

    if (!isObject(jsnObjct)) {
      nodes.push(createNode(nodePlainTextConfig, path, { label: label || path, parent }, jsnObjct, orgJsnObjct));
    } else if (isArray(jsnObjct) || (isArray(jsnObjct) && path === "root")) {
      const { config } = getCustomizations("array", newConfig);
      const cntLbl = isArray(jsnObjct) ? `${jsnObjct.length || ""}` : `{${Object.keys(jsnObjct).length || ""}}`;
      const rootLabel = path === "root" ? activeLabel : `${activeLabel}  ${cntLbl}`;
      nodes.push(
        createNode(config, path, { label: label || rootLabel, parent }, jsnObjct, isArray(orgJsnObjct) ? { [activeLabel]: orgJsnObjct } : orgJsnObjct),
      );
    } else if ((!isArray(jsnObjct) && Object.keys(plnObjct).length) || path === "root") {
      const { config } = getCustomizations(null, newConfig);
      const cntLbl = isArray(jsnObjct) ? `${jsnObjct.length || ""}` : `{${Object.keys(jsnObjct).length || ""}}`;

      const paths = path.split(".");
      const slctdPth = paths[paths.length - 1];
      let count = !isNaN(Number(slctdPth)) ? Number(slctdPth) + 1 : null;

      const objHdr = !isNaN(Number(slctdPth)) ? paths[paths.length - 2] + " " + count : slctdPth;

      const hdr = path === "root" ? activeLabel : objHdr;

      let isLabelArrayIndex = false;
      if (!Number.isNaN(Number(activeLabel))) isLabelArrayIndex = true;

      const jsonCode = jsnObjct;
      if (label) {
        const { config } = getCustomizations("object", newConfig);
        nodes.push(createNode(config, path, { label: label || `${label}  ${cntLbl}`, parent }, plnObjct, jsonCode));
      } else {
        config.data.headerTitle = hdr;
        nodes.push(createNode(config, path, { label, parent }, plnObjct, jsonCode));
      }
    }

    if (!collapsed)
      if (Object.keys(itrblObjct).length && !isArray(jsnObjct)) {
        handleObj({
          flowConfig,
          chldPth: null,
          edges,
          isInverted: null,
          itrblObjct: itrblObjct,
          nodes,
          path,
          newConfig,
        });
      } else if (isArray(jsnObjct)) {
        jsnObjct.forEach((item, index) => {
          item = collectObjWithRefs(item, initalObjIds);
          const orgJsnObjct = item;

          const plnObjct = collectPlainObject(item);
          const itrblObjct = collectIterObject(item);
          const { newConfig, arrayObject } = collectConfigObject(item);

          if (arrayObject.length) {
            item = arrayObject;
          }

          const { config } = getCustomizations(typeof item === "string" ? "text" : "array", newConfig);

          const { hideConfig, sourceLabel, label, isEdgeAnimated, parent } = newConfig as any;

          hideDefaultObject = hideDefaultObject || hideConfig;

          const isRoot = path === "root" && flowConfig.isCntr;

          const rootPath = path.split(".").slice(0, 2).join(".");
          const isChldOfRt = invrtdRtPths.includes(rootPath);

          const isInverted = (flowConfig.isCntr && isChldOfRt) || (index % 2 === 0 && isRoot);

          let chldPth = `${path}.${index}`;
          chldPth = processIdenticalPaths(chldPth, nodes);

          if (isInverted) {
            invrtdRtPths.push(chldPth);
          }

          if (!isObject(item)) {
            edges.push(createEdge(path, chldPth, null, sourceLabel, isInverted, isEdgeAnimated));
            nodes.push(createNode(config, chldPth, { label: label || String(item), parent }, item, orgJsnObjct));
          } else if (Object.keys(plnObjct).length && !isArray(item)) {
            edges.push(createEdge(path, chldPth, null, sourceLabel, isInverted, isEdgeAnimated));
            createFlowDiagram(item, chldPth, nodes, edges, label || index, flowConfig, newConfig);
          } else if (Object.keys(itrblObjct).length && !isArray(item)) {
            handleObj({
              flowConfig,
              chldPth,
              isInverted,
              edges,
              itrblObjct,
              nodes,
              path,
              newConfig,
              forceIsInverted: true,
            });
          } else if (isArray(item)) {
            handleArray({
              flowConfig,
              chldPth,
              edges,
              isInverted,
              item,
              nodes,
              path,
            });
          } else if (isObject(item)) {
            handleObj({
              flowConfig,
              chldPth,
              isInverted,
              edges,
              itrblObjct: [item],
              nodes,
              path,
              newConfig,
            });
          }
        });
      } else {
        //---CONFIGS---
      }

    return { nodes, edges };
  } catch (e) {
    return { nodes, edges };
  }
}

export const handleObj = ({ chldPth, flowConfig, edges, itrblObjct, nodes, isInverted, path, newConfig, forceIsInverted = false }) => {
  let { hideDefaultObject, sprtObjctKy } = flowConfig;
  return Object.entries(itrblObjct).forEach(([key, value], index) => {
    value = collectObjWithRefs(value, initalObjIds);

    const orgJsnObjct = value;

    const plnObjct = collectPlainObject(value);
    const itrblObjct = collectIterObject(value);

    const { newConfig, arrayObject } = collectConfigObject(value);

    if (arrayObject.length) {
      value = arrayObject;
    }

    const { hideConfig, sourceLabel, label, content, target, targetLabel, collapsed, isEdgeAnimated, parent } = newConfig as any;

    hideDefaultObject = hideDefaultObject || hideConfig;

    const isRoot = path === "root" && flowConfig.isCntr;

    const rootPath = path.split(".").slice(0, 2).join(".");
    const isChldOfRt = invrtdRtPths.includes(rootPath);

    if (!forceIsInverted) isInverted = (flowConfig.isCntr && isChldOfRt) || (index % 2 === 0 && isRoot);

    let sbChldPth = chldPth ? `${chldPth}.${key}` : `${path}.${key}`;
    sbChldPth = processIdenticalPaths(sbChldPth, nodes);

    if (isInverted) {
      invrtdRtPths.push(sbChldPth);
    }

    if (!!target) {
      edges.push(createEdge(sbChldPth, target, null, targetLabel, isInverted, isEdgeAnimated));
    }

    if (isObject(value) && !isArray(value)) {
      edges.push(createEdge(path, sbChldPth, null, sourceLabel, isInverted, isEdgeAnimated));

      const crtKyNd = sprtObjctKy || Object.keys(plnObjct).length === 0;
      if (crtKyNd) {
        const configToUse = !!content ? "object" : "array";
        const { config } = getCustomizations(configToUse, newConfig);

        config.data.headerTitle = !!content ? label : null;

        nodes.push(createNode(config, sbChldPth, { label: label || key, parent }, value, orgJsnObjct));
      }

      if (Object.keys(plnObjct).length && !hideDefaultObject) {
        const vlCntLbl = isArray(value) ? ` ${value.length || ""}` : `{${Object.keys(value).length || ""}}`;

        let cPath = sbChldPth;

        if (crtKyNd) {
          cPath = `${sbChldPth}.${vlCntLbl}`;
          cPath = processIdenticalPaths(cPath, nodes);
          edges.push(createEdge(sbChldPth, cPath, null, sourceLabel, isInverted, isEdgeAnimated));
        }
        createFlowDiagram(value, cPath, nodes, edges, label || key, flowConfig, newConfig);
      } else if (Object.keys(itrblObjct).length && !isArray(value)) {
        handleObj({
          chldPth: sbChldPth,
          flowConfig,
          itrblObjct,
          path: sbChldPth,
          edges,
          nodes,
          newConfig,
          isInverted,
        });
      } else {
        createFlowDiagram(value, sbChldPth, nodes, edges, key, flowConfig, newConfig);
      }
    } else if (isArray(value)) {
      edges.push(createEdge(path, sbChldPth, null, sourceLabel, isInverted, isEdgeAnimated));
      createFlowDiagram(value, sbChldPth, nodes, edges, key, flowConfig, newConfig);
    }
  });
};

export const handleArray = ({ flowConfig, chldPth, edges, isInverted, item, nodes, path }) => {
  return item.forEach((itm, i) => {
    let sbChldPth = `${chldPth}.${i}`;
    sbChldPth = processIdenticalPaths(sbChldPth, nodes);
    const orgJsnObjct = itm;
    itm = collectObjWithRefs(itm, initalObjIds);

    const itrblObjct = collectIterObject(itm);
    const plnObjct = collectPlainObject(itm);
    const { newConfig } = collectConfigObject(itm);

    const { collapsed, label, parent, sourceLabel, isEdgeAnimated, content } = newConfig as any;

    if (!isObject(itm)) {
      edges.push(createEdge(path, sbChldPth, null, sourceLabel, isInverted, isEdgeAnimated));
      nodes.push(createNode(nodePlainTextConfig, sbChldPth, { label: label || String(itm), parent }, itm, orgJsnObjct));
    } else if (!isArray(itm) && Object.keys(plnObjct).length) {
      edges.push(createEdge(path, sbChldPth, null, sourceLabel, isInverted, isEdgeAnimated));
      createFlowDiagram(itm, sbChldPth, nodes, edges, i, flowConfig, newConfig);
    } else if (Object.keys(itrblObjct).length && !isArray(itm) && !collapsed) {
      handleObj({
        chldPth: sbChldPth,
        flowConfig,
        itrblObjct,
        path,
        edges,
        nodes,
        isInverted,
        newConfig,
      });
    } else if (isArray(itm)) {
      handleArray({
        flowConfig,
        chldPth: sbChldPth,
        edges,
        isInverted,
        item: itm,
        nodes,
        path,
      });
    }
  });
};
