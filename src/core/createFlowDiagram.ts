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

interface DiagramContext {
  invrtdRtPths: string[];
  initalObjIds: { ids: any[]; jsnObjct: any } | null;
}

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
  ctx?: DiagramContext,
): { nodes: any[]; edges: any[] } {
  if (!ctx) {
    ctx = { invrtdRtPths: [], initalObjIds: null };
  }

  if (!jsnObjct || typeof jsnObjct !== "object") {
    return { nodes, edges };
  }

  const orgJsnObjct = jsnObjct;

  if (!ctx.initalObjIds) {
    const { nodes: ids } = createFlowDiagramIds(jsnObjct);
    ctx.initalObjIds = { ids, jsnObjct };
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

    if (
      (newConfig as any).collapsed === undefined &&
      (Object.keys(itrblObjct).length > 0 || isArray(jsnObjct))
    ) {
      (newConfig as any).collapsed = false;
    }

    const { label, collapsed, parent } = newConfig as any;

    if (!isObject(jsnObjct)) {
      nodes.push(
        createNode(
          nodePlainTextConfig,
          path,
          { label: label || path, parent },
          jsnObjct,
          orgJsnObjct,
        ),
      );
    } else if (isArray(jsnObjct) || (isArray(jsnObjct) && path === "root")) {
      const { config } = getCustomizations("array", newConfig);
      const cntLbl = isArray(jsnObjct)
        ? `${jsnObjct.length || ""}`
        : `{${Object.keys(jsnObjct).length || ""}}`;
      const rootLabel =
        path === "root" ? activeLabel : `${activeLabel}  ${cntLbl}`;
      nodes.push(
        createNode(
          config,
          path,
          { label: label || rootLabel, parent },
          jsnObjct,
          isArray(orgJsnObjct) ? { [activeLabel]: orgJsnObjct } : orgJsnObjct,
        ),
      );
    } else if (
      (!isArray(jsnObjct) && Object.keys(plnObjct).length) ||
      path === "root"
    ) {
      const { config } = getCustomizations(null, newConfig);
      const paths = path.split(".");
      const slctdPth = paths[paths.length - 1];
      let count = !isNaN(Number(slctdPth)) ? Number(slctdPth) + 1 : null;
      const objHdr = !isNaN(Number(slctdPth))
        ? paths[paths.length - 2] + " " + count
        : slctdPth;
      const hdr = path === "root" ? activeLabel : objHdr;

      const jsonCode = jsnObjct;
      if (label) {
        const { config } = getCustomizations("object", newConfig);
        config.data.headerTitle = label;
        nodes.push(
          createNode(
            config,
            path,
            {
              label: label || `${label}  ${Object.keys(jsnObjct).length}`,
              parent,
            },
            plnObjct,
            jsonCode,
          ),
        );
      } else {
        config.data.headerTitle = hdr;
        nodes.push(
          createNode(config, path, { label, parent }, plnObjct, jsonCode),
        );
      }
    }

    if (!collapsed)
      if (Object.keys(itrblObjct).length && !isArray(jsnObjct)) {
        handleObj({
          flowConfig,
          chldPth: null,
          edges,
          isInverted: null,
          itrblObjct,
          nodes,
          path,
          newConfig,
          ctx,
        });
      } else if (isArray(jsnObjct)) {
        jsnObjct.forEach((item, index) => {
          item = collectObjWithRefs(item, ctx.initalObjIds);
          const orgJsnObjct = item;

          const plnObjct = collectPlainObject(item);
          const itrblObjct = collectIterObject(item);
          const { newConfig, arrayObject } = collectConfigObject(item);

          if (arrayObject.length) {
            item = arrayObject;
          }

          const { config } = getCustomizations(
            typeof item === "string" ? "text" : "array",
            newConfig,
          );
          const { hideConfig, sourceLabel, label, isEdgeAnimated, parent } =
            newConfig as any;

          hideDefaultObject = hideDefaultObject || hideConfig;

          const isRoot = path === "root" && flowConfig.isCntr;
          const rootPath = path.split(".").slice(0, 2).join(".");
          const isChldOfRt = ctx.invrtdRtPths.includes(rootPath);
          const isInverted =
            (flowConfig.isCntr && isChldOfRt) || (index % 2 === 0 && isRoot);

          let chldPth = `${path}.${index}`;
          chldPth = processIdenticalPaths(chldPth, nodes);

          if (isInverted) {
            ctx.invrtdRtPths.push(chldPth);
          }

          if (!isObject(item)) {
            edges.push(
              createEdge(
                path,
                chldPth,
                null,
                sourceLabel,
                isInverted,
                isEdgeAnimated,
              ),
            );
            nodes.push(
              createNode(
                config,
                chldPth,
                { label: label || String(item), parent },
                item,
                orgJsnObjct,
              ),
            );
          } else if (Object.keys(plnObjct).length && !isArray(item)) {
            edges.push(
              createEdge(
                path,
                chldPth,
                null,
                sourceLabel,
                isInverted,
                isEdgeAnimated,
              ),
            );
            createFlowDiagram(
              item,
              chldPth,
              nodes,
              edges,
              label || index,
              flowConfig,
              newConfig,
              ctx,
            );
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
              ctx,
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
              ctx,
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
              ctx,
            });
          }
        });
      }

    return { nodes, edges };
  } catch (e) {
    return { nodes, edges };
  }
}

export const handleObj = ({
  chldPth,
  flowConfig,
  edges,
  itrblObjct,
  nodes,
  isInverted,
  path,
  newConfig,
  forceIsInverted = false,
  ctx,
}: any) => {
  let { hideDefaultObject, sprtObjctKy } = flowConfig;
  return Object.entries(itrblObjct).forEach(([key, value], index) => {
    value = collectObjWithRefs(value, ctx.initalObjIds);
    const orgJsnObjct = value;

    const plnObjct = collectPlainObject(value);
    const itrblObjct = collectIterObject(value);
    const { newConfig, arrayObject } = collectConfigObject(value);

    if (arrayObject.length) {
      value = arrayObject;
    }

    if (
      (newConfig as any).collapsed === undefined &&
      (Object.keys(itrblObjct).length > 0 || isArray(value))
    ) {
      (newConfig as any).collapsed = false;
    }

    const {
      hideConfig,
      sourceLabel,
      label,
      content,
      target,
      targetLabel,
      collapsed,
      isEdgeAnimated,
      parent,
    } = newConfig as any;
    hideDefaultObject = hideDefaultObject || hideConfig;

    const isRoot = path === "root" && flowConfig.isCntr;
    const rootPath = path.split(".").slice(0, 2).join(".");
    const isChldOfRt = ctx.invrtdRtPths.includes(rootPath);

    if (!forceIsInverted)
      isInverted =
        (flowConfig.isCntr && isChldOfRt) || (index % 2 === 0 && isRoot);

    let sbChldPth = chldPth ? `${chldPth}.${key}` : `${path}.${key}`;
    sbChldPth = processIdenticalPaths(sbChldPth, nodes);

    if (isInverted) {
      ctx.invrtdRtPths.push(sbChldPth);
    }

    if (!!target) {
      edges.push(
        createEdge(
          sbChldPth,
          target,
          null,
          targetLabel,
          isInverted,
          isEdgeAnimated,
        ),
      );
    }

    if (isObject(value) && !isArray(value)) {
      edges.push(
        createEdge(
          path,
          sbChldPth,
          null,
          sourceLabel,
          isInverted,
          isEdgeAnimated,
        ),
      );

      const crtKyNd = sprtObjctKy || Object.keys(plnObjct).length === 0;
      if (crtKyNd) {
        const configToUse = !!content ? "object" : "array";
        const { config } = getCustomizations(configToUse, newConfig);
        config.data.headerTitle = !!content ? label : null;
        nodes.push(
          createNode(
            config,
            sbChldPth,
            { label: label || key, parent },
            plnObjct,
            orgJsnObjct,
          ),
        );
      }

      if (Object.keys(plnObjct).length && !hideDefaultObject && !collapsed) {
        let cPath = sbChldPth;
        if (crtKyNd) {
          const vlCntLbl = isArray(value)
            ? ` ${value.length || ""}`
            : `{${Object.keys(value).length || ""}}`;
          cPath = `${sbChldPth}.${vlCntLbl}`;
          cPath = processIdenticalPaths(cPath, nodes);
          edges.push(
            createEdge(
              sbChldPth,
              cPath,
              null,
              sourceLabel,
              isInverted,
              isEdgeAnimated,
            ),
          );
        }
        createFlowDiagram(
          value,
          cPath,
          nodes,
          edges,
          label || key,
          flowConfig,
          {},
          ctx,
        );
      } else if (
        Object.keys(itrblObjct).length &&
        !isArray(value) &&
        !collapsed
      ) {
        handleObj({
          chldPth: sbChldPth,
          flowConfig,
          itrblObjct,
          path: sbChldPth,
          edges,
          nodes,
          newConfig: {},
          isInverted,
          ctx,
        });
      } else if (!collapsed) {
        createFlowDiagram(
          value,
          sbChldPth,
          nodes,
          edges,
          key,
          flowConfig,
          {},
          ctx,
        );
      }
    } else if (isArray(value) && !collapsed) {
      edges.push(
        createEdge(
          path,
          sbChldPth,
          null,
          sourceLabel,
          isInverted,
          isEdgeAnimated,
        ),
      );
      createFlowDiagram(
        value,
        sbChldPth,
        nodes,
        edges,
        key,
        flowConfig,
        {},
        ctx,
      );
    }
  });
};

export const handleArray = ({
  flowConfig,
  chldPth,
  edges,
  isInverted,
  item,
  nodes,
  path,
  ctx,
}: any) => {
  return item.forEach((itm, i) => {
    let sbChldPth = `${chldPth}.${i}`;
    sbChldPth = processIdenticalPaths(sbChldPth, nodes);
    const orgJsnObjct = itm;
    itm = collectObjWithRefs(itm, ctx.initalObjIds);

    const itrblObjct = collectIterObject(itm);
    const plnObjct = collectPlainObject(itm);
    const { newConfig } = collectConfigObject(itm);

    const { collapsed, label, parent, sourceLabel, isEdgeAnimated, content } =
      newConfig as any;

    if (!isObject(itm)) {
      edges.push(
        createEdge(
          path,
          sbChldPth,
          null,
          sourceLabel,
          isInverted,
          isEdgeAnimated,
        ),
      );
      nodes.push(
        createNode(
          nodePlainTextConfig,
          sbChldPth,
          { label: label || String(itm), parent },
          itm,
          orgJsnObjct,
        ),
      );
    } else if (!isArray(itm) && Object.keys(plnObjct).length && !collapsed) {
      edges.push(
        createEdge(
          path,
          sbChldPth,
          null,
          sourceLabel,
          isInverted,
          isEdgeAnimated,
        ),
      );
      createFlowDiagram(
        itm,
        sbChldPth,
        nodes,
        edges,
        i,
        flowConfig,
        newConfig,
        ctx,
      );
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
        ctx,
      });
    } else if (isArray(itm) && !collapsed) {
      handleArray({
        flowConfig,
        chldPth: sbChldPth,
        edges,
        isInverted,
        item: itm,
        nodes,
        path,
        ctx,
      });
    }
  });
};
