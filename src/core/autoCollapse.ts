import { collectIterObject } from "./createFlowDiagramComponents";

export function getJsonSize(data: any): { lines: number; depth: number; nodes: number } {
  let nodeCount = 0;
  let maxDepth = 0;
  let lines = 0;

  const traverse = (obj: any, currentDepth: number): void => {
    maxDepth = Math.max(maxDepth, currentDepth);
    nodeCount++;
    if (obj && typeof obj === "object") {
      const count = Array.isArray(obj) ? obj.length : Object.keys(obj).length;
      lines += count + 2;
      if (Array.isArray(obj)) {
        for (const item of obj) traverse(item, currentDepth + 1);
      } else {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) traverse(obj[key], currentDepth + 1);
        }
      }
    } else {
      lines += 1;
    }
  };

  traverse(data, 0);
  return { lines, depth: maxDepth, nodes: nodeCount };
}

export function applyAutoCollapse(data: any, collapseEveryN: number): any {
  const applyAtLevel = (obj: any, currentLevel: number, parent: any = null, parentKey: string | number = ""): void => {
    if (currentLevel > 0 && currentLevel % collapseEveryN === 0) {
      if (obj && typeof obj === "object") {
        if (Array.isArray(obj)) {
          if (parent && parentKey !== "" && obj.length > 0) {
            parent[parentKey] = { $: obj, $collapsed: true };
          }
          return;
        } else {
          if (obj.$collapsed === false) return;
          const hasIter = collectIterObject(obj);
          if (Object.keys(hasIter).length > 0) {
            obj.$collapsed = true;
            return;
          }
        }
      }
    }

    if (obj && typeof obj === "object") {
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          if (obj[i] && typeof obj[i] === "object") {
            applyAtLevel(obj[i], currentLevel + 1, obj, i);
          }
        }
      } else {
        for (const key in obj) {
          if (obj.hasOwnProperty(key) && !key.startsWith("$")) {
            if (obj[key] && typeof obj[key] === "object") {
              applyAtLevel(obj[key], currentLevel + 1, obj, key);
            }
          }
        }
      }
    }
  };

  if (collapseEveryN > 0 && data && typeof data === "object") {
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        if (data[i] && typeof data[i] === "object") {
          applyAtLevel(data[i], 1, data, i);
        }
      }
    } else {
      for (const key in data) {
        if (data.hasOwnProperty(key) && !key.startsWith("$")) {
          if (data[key] && typeof data[key] === "object") {
            applyAtLevel(data[key], 1, data, key);
          }
        }
      }
    }
  }

  return data;
}
