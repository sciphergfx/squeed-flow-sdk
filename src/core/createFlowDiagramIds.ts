import { isArray } from "lodash";
import {
  collectConfigObject,
  collectIterObject,
  collectPlainObject,
  getCustomizations,
  isObject,
} from "./createFlowDiagramComponents";

export function createFlowDiagramIds(
  jsnObjct: any,
  path: string = "root",
  nodes: any[] = [],
): { nodes: any[] } {
  try {
    const { arrayObject } = collectConfigObject(jsnObjct);

    if (arrayObject.length) {
      jsnObjct = arrayObject;
    }

    const plnObjct = collectPlainObject(jsnObjct);
    const itrblObjct = collectIterObject(jsnObjct);

    if (!isObject(jsnObjct)) {
      nodes.push(path);
    } else if (isArray(jsnObjct) || (isArray(jsnObjct) && path === "root")) {
      nodes.push(path);
    } else if ((!isArray(jsnObjct) && Object.keys(plnObjct).length) || path === "root") {
      nodes.push(path);
    }

    if (Object.keys(itrblObjct).length && !isArray(jsnObjct)) {
      handleObj({ chldPth: null, itrblObjct, nodes, path });
    } else if (isArray(jsnObjct)) {
      jsnObjct.forEach((item, index) => {
        const plnObjct = collectPlainObject(item);
        const itrblObjct = collectIterObject(item);
        const { newConfig, arrayObject } = collectConfigObject(item);

        let chldPth = `${path}.${index}`;

        if (!isObject(item)) {
          nodes.push(chldPth);
        } else if (Object.keys(plnObjct).length) {
          createFlowDiagramIds(plnObjct, chldPth, nodes);

          if (Object.keys(itrblObjct).length && !isArray(item))
            handleObj({ chldPth, itrblObjct, nodes, path });
        } else if (Object.keys(itrblObjct).length && !isArray(item)) {
          handleObj({ chldPth, itrblObjct, nodes, path });
        } else if (isArray(item)) {
          handleArray({ chldPth, item, nodes, path });
        }
      });
    }

    return { nodes };
  } catch (e) {
    return { nodes };
  }
}

const handleObj = ({ chldPth, itrblObjct, nodes, path }) => {
  return Object.entries(itrblObjct).forEach(([key, value], index) => {
    const plnObjct = collectPlainObject(value);
    const itrblObjct = collectIterObject(value);
    const { newConfig, arrayObject } = collectConfigObject(value);

    if (arrayObject.length) {
      value = arrayObject;
    }

    let sbChldPth = chldPth ? `${chldPth}.${key}` : `${path}.${key}`;

    if (isObject(value) && !isArray(value)) {
      const crtKyNd = Object.keys(plnObjct).length === 0;
      if (crtKyNd) {
        const { config } = getCustomizations("array", newConfig);
        nodes.push(sbChldPth);
      }

      if (Object.keys(plnObjct).length) {
        const vlCntLbl = isArray(value) ? `${value.length || ""}` : `{${Object.keys(value).length || ""}}`;
        let cPath = sbChldPth;
        if (crtKyNd) {
          cPath = `${sbChldPth}.${vlCntLbl}`;
        }
        createFlowDiagramIds(value, cPath, nodes);
      } else if (Object.keys(itrblObjct).length && !isArray(value)) {
        handleObj({ chldPth: sbChldPth, itrblObjct, path: sbChldPth, nodes });
      } else {
        createFlowDiagramIds(value, sbChldPth, nodes);
      }
    } else if (isArray(value)) {
      createFlowDiagramIds(value, sbChldPth, nodes);
    }
  });
};

const handleArray = ({ chldPth, item, nodes, path }) => {
  return item.forEach((itm, i) => {
    let sbChldPth = `${chldPth}.${i}`;

    const itrblObjct = collectIterObject(itm);
    const plnObjct = collectPlainObject(itm);

    if (!isObject(itm)) {
      nodes.push(sbChldPth);
    } else if (!isArray(itm) && Object.keys(plnObjct).length) {
      createFlowDiagramIds(itm, sbChldPth, nodes);
    } else if (Object.keys(itrblObjct).length && !isArray(itm)) {
      handleObj({ chldPth: sbChldPth, itrblObjct, path, nodes });
    } else if (isArray(itm)) {
      handleArray({ chldPth: sbChldPth, item: itm, nodes, path });
    }
  });
};
