import { v4 as uuidv4 } from "uuid";

import {
  nodeArrayConfig,
  nodeJsonObjectConfig,
  nodePlainTextConfig,
  nodeWorkflowStepConfig,
} from "./nodeConfigs";
export const isObject = (value) => typeof value === "object";
export const isObj = (value) =>
  typeof value === "object" && !Array.isArray(value);
export const isObjectEmpty = (value) => Object.keys(value).length === 0;
const isArray = (value) => Array.isArray(value);

/**
 * Reserved Cytoscape property names that conflict with user data.
 * These are used internally by Cytoscape and its layout algorithms.
 */
const CYTOSCAPE_RESERVED_KEYS = [
  "order",
  "position",
  "selected",
  "locked",
  "grabbed",
  "grabbable",
  "scratch",
];

export const collectPlainObject = (data) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (!isObject(value) && !key.startsWith("$")) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

export const collectNonInterObject = (data) => {
  if (typeof data === "string") {
    return {};
  }

  return Object.entries(data).reduce((acc, [key, value]) => {
    if (!isObject(value)) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

export const collectObjWithRefs = (data, obj) => {
  if (typeof data === "string" && data.startsWith("$")) {
    return findRefPropertyObject(data, obj);
  } else if (isObject(data) && !isArray(data)) {
    return Object.entries(data).reduce((acc, [key, value]: any) => {
      if (typeof value === "string" && value.startsWith("$") && key === "...") {
        delete acc["..."];
        acc[key] = { ...findRefPropertyObject(value, obj), ...data };
      } else if (typeof value === "string" && value.startsWith("$")) {
        acc[key] = findRefPropertyObject(value, obj);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
  } else return data;
};

export const collectIterObject = (data) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (isObject(value) && key && value && !key.startsWith("$")) {
      if (CYTOSCAPE_RESERVED_KEYS.includes(key)) {
        key = key + "#";
      }
      acc[key] = value;
    }
    return acc;
  }, {});
};

export const createNode = (
  config,
  id,
  { label, parent = undefined },
  description,
  jsonCode = null,
) => {
  if (jsonCode !== null)
    if (isObject(jsonCode) || isArray(jsonCode))
      jsonCode = JSON.stringify(jsonCode, null, 2);

  return {
    data: {
      parent,
      ...config.data,
      id,
      text: label || "",
      label,
      code: jsonCode || null,
      type: config.type,
      description,
    },
  };
};

export const createEdge = (
  sourceId,
  targetId,
  customId = null,
  label = null,
  isInverted = null,
  isEdgeAnimated = false,
  parent = null,
) => {
  const id = uuidv4();
  return {
    data: {
      id,
      source: isInverted ? targetId : sourceId,
      target: isInverted ? sourceId : targetId,
      label: label || "",
      isInverted,
      isEdgeAnimated,
      parent,
    },
  };
};

export const collectConfigObject = (data, exclude = []) => {
  const newConfig = {};
  const updatedObject = {};
  let arrayObject = [];
  if (data)
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("$") && key !== "$") {
        newConfig[key.slice(1)] = value;
      } else if (key !== "$") {
        updatedObject[key] = value;
      } else if (key === "$") {
        arrayObject = value as any;
      }
    }
  return { newConfig, updatedObject, arrayObject };
};

export const getCustomizations = (view, newConfig) => {
  let config: any = nodeJsonObjectConfig;

  const {
    view: configView,
    borderColor,
    borderRadius,
    bgColor,
    textColor,
    fontSize,
    stepType,
  } = newConfig as any;

  view = configView || view;

  if (stepType) {
    config = { ...nodeWorkflowStepConfig };
  } else if (view === "object") {
    config = nodeJsonObjectConfig;
  } else if (view === "text") {
    config = nodePlainTextConfig;
  } else if (view === "array") {
    config = nodeArrayConfig;
  } else if (view === "workflowStep") {
    config = { ...nodeWorkflowStepConfig };
  }
  const style = config.data.viewProps;

  config["data"]["viewProps"] = {
    ...style,
    borderRadius: borderRadius || (stepType ? 15 : 53),
    bgColor,
    borderColor,
    textColor,
    fontSize,
  };
  config["data"]["config"] = newConfig;

  return { config };
};

export const processIdenticalPaths = (path, nodes) => {
  const hsPth = nodes.find((i) => i.data.id === path);
  path = hsPth ? `${path}.#` : path;
  return path;
};

export const findRefPropertyObject = (key, { ids, jsnObjct }) => {
  if (typeof key === "string" && key?.startsWith("$")) {
    const prop = key.replace("$", "").replace("*", "");
    const shouldCollectAllObject = key?.endsWith("*");

    const path = ids.find((i) => {
      const lastItem = i.split(".").slice(-1)[0];
      return lastItem === prop || prop === i;
    });

    if (!path) return key;

    const obj = collectObjWithId(path, jsnObjct);
    const hasKey = JSON.stringify(obj).includes(key);

    if (hasKey) return key;

    return obj || key;
  }
  return key;
};

export const collectObjWithId = (path, jsonObj) => {
  let ids = path.split(".").splice(1);
  const isDecorator =
    ids[ids.length - 1] === "#" || ids[ids.length - 1].includes("{");

  ids = isDecorator ? ids.slice(0, -2) : ids;
  const rst = (obj) =>
    ids.reduce((acc, id) => {
      id = id.replace("[", "").replace("]", "");
      const { arrayObject } = collectConfigObject(acc);
      acc = arrayObject.length ? arrayObject : acc;
      return acc[id];
    }, obj);

  return rst(jsonObj);
};
