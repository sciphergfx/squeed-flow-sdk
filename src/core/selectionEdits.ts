import {
  getNode,
  setCollapsed,
  updateNode,
  type SqueedJson,
} from "./squeedEdits";

export function reparentNode(
  json: SqueedJson,
  nodeId: string | readonly string[],
  parentId: string,
): SqueedJson {
  if (Array.isArray(nodeId)) {
    const ids = new Set(nodeId);
    if (!getNode(json, parentId) || [...ids].some(id => id === "root" || !getNode(json, id)))
      throw new Error("The source or Parent no longer exists.");
    const seen = new Set<string>();
    let ancestor: string | undefined = parentId;
    while (ancestor) {
      if (seen.has(ancestor) || [...ids].some(id => ancestor === id || ancestor!.startsWith(`${id}.`)))
        throw new Error("A node cannot be moved inside itself or its descendants.");
      seen.add(ancestor);
      const explicit = getNode(json, ancestor)?.$parent;
      ancestor = typeof explicit === "string" ? explicit : ancestor.includes(".") ? ancestor.slice(0, ancestor.lastIndexOf(".")) : undefined;
    }
    const visit = (value: SqueedJson, address: string): SqueedJson => {
      let next = value;
      const assign = (key: string, child: SqueedJson) => {
        if (next === value) next = Array.isArray(value) ? [...value] : { ...value };
        next[key] = child;
      };
      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          if (key.startsWith("$") && key !== "$") continue;
          const result = visit(child, key === "$" ? address : `${address}.${key}`);
          if (result !== child) assign(key, result);
        }
      }
      if (ids.has(address)) next = { ...(next && typeof next === "object" && !Array.isArray(next) ? next : { $: next }), $parent: parentId };
      return next;
    };
    return setCollapsed(visit(json, "root"), parentId, false);
  }
  nodeId = nodeId as string;
  if (nodeId === "root" || !getNode(json, nodeId) || !getNode(json, parentId))
    throw new Error("The source or Parent no longer exists.");
  const seen = new Set<string>();
  let ancestor: string | undefined = parentId;
  while (ancestor) {
    if (
      ancestor === nodeId ||
      ancestor.startsWith(`${nodeId}.`) ||
      seen.has(ancestor)
    )
      throw new Error(
        "A node cannot be moved inside itself or its descendants.",
      );
    seen.add(ancestor);
    const explicit = getNode(json, ancestor)?.$parent;
    ancestor =
      typeof explicit === "string"
        ? explicit
        : ancestor.includes(".")
          ? ancestor.slice(0, ancestor.lastIndexOf("."))
          : undefined;
  }
  return setCollapsed(
    updateNode(json, nodeId, (node) => ({ ...node, $parent: parentId })),
    parentId,
    false,
  );
}

export function getSelectionRoots(json: SqueedJson, ids: string[]): string[] {
  const selected = new Set(ids.filter((id) => getNode(json, id) !== undefined));
  const entries: [string, any][] = [];
  const visit = (value: any, address: string) => {
    if (!value || typeof value !== "object") return;
    entries.push([address, value]);
    for (const [key, child] of Object.entries(value))
      if (!key.startsWith("$")) visit(child, `${address}.${key}`);
  };
  visit(json, "root");
  const inside = (id: string) =>
    [...selected].some(
      (parent) => id === parent || id.startsWith(`${parent}.`),
    );
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, value] of entries)
      if (
        !inside(id) &&
        typeof value.$parent === "string" &&
        inside(value.$parent)
      ) {
        selected.add(id);
        changed = true;
      }
  }
  return [...selected].filter(
    (id) =>
      ![...selected].some(
        (parent) => parent !== id && id.startsWith(`${parent}.`),
      ),
  );
}

export function copySelection(json: SqueedJson, ids: string[]): SqueedJson {
  const roots = getSelectionRoots(json, ids);
  const addresses = new Map(
    roots.map((id, index) => [id, `root.node_${index + 1}`]),
  );
  const address = (id: string) => {
    const root = roots.find(
      (parent) => id === parent || id.startsWith(`${parent}.`),
    );
    return root ? `${addresses.get(root)}${id.slice(root.length)}` : undefined;
  };
  const rewrite = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value.$connections))
      value.$connections = value.$connections.flatMap((connection) => {
        const target =
          typeof connection.target === "string" && address(connection.target);
        return target ? [{ ...connection, id: undefined, target }] : [];
      });
    for (const key of ["$parent", "$target"])
      if (typeof value[key] === "string") {
        const target = address(value[key]);
        if (target) value[key] = target;
        else delete value[key];
      }
    for (const [key, child] of Object.entries(value))
      if (!key.startsWith("$")) rewrite(child);
  };
  const result: SqueedJson = { $hideRoot: true };
  roots.forEach((id, index) => {
    const node = structuredClone(getNode(json, id));
    rewrite(node);
    result[`node_${index + 1}`] = node;
  });
  return result;
}

export function duplicateSelection(json: SqueedJson, ids: string[]) {
  const copied = copySelection(json, ids);
  const keys = Object.keys(copied).filter((key) => !key.startsWith("$"));
  const addresses = new Map(
    keys.map((key) => [key, `copy_${crypto.randomUUID()}`]),
  );
  const rewrite = (value: any) => {
    if (!value || typeof value !== "object") return;
    const address = (id: string) => {
      const parts = id.split(".");
      if (parts[0] === "root" && addresses.has(parts[1]))
        parts[1] = addresses.get(parts[1])!;
      return parts.join(".");
    };
    for (const connection of value.$connections ?? []) {
      connection.target = address(connection.target);
      connection.id = crypto.randomUUID();
    }
    for (const key of ["$parent", "$target"])
      if (typeof value[key] === "string") value[key] = address(value[key]);
    for (const [key, child] of Object.entries(value))
      if (!key.startsWith("$")) rewrite(child);
  };
  const additions = Object.fromEntries(
    keys.map((key) => {
      const node = copied[key];
      rewrite(node);
      return [addresses.get(key)!, node];
    }),
  );
  return {
    json: updateNode(json, "root", (root) => ({ ...root, ...additions })),
    ids: [...addresses.values()].map((key) => `root.${key}`),
  };
}
