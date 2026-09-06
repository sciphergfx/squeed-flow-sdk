import { createCastSessionExample } from "./example";
import type { ResourceMapping } from "../workflow-state/resourceMapping";
import type { SqueedJson } from "../../src/core/squeedEdits";

export const CAST_DESIGNS = [
  { id: "minimal", label: "Minimal", mapping: { version: 1, fields: [{ type: "CastLlmConfig", field: "prompt" }] } },
  { id: "groups", label: "Step Groups", mapping: { version: 1, fields: [
    { type: "CastLlmConfig", field: "prompt" }, { type: "CastLlmConfig", field: "model", createEmpty: true },
  ] } },
  { id: "tools", label: "Reusable Tools", mapping: { version: 1, fields: [
    { type: "CastLlmConfig", field: "prompt" }, { type: "CastLlmConfig", field: "model", createEmpty: true },
    { type: "CastNotificationConfig", field: "templateData" },
  ] } },
  { id: "data", label: "Data Inspection", mapping: { version: 1, templates: true, fields: [
    { type: "CastDatabaseConfig", field: "data" }, { type: "CastOutputConfig", field: "mapping" },
  ] } },
  { id: "full", label: "Full Bindings", mapping: { version: 1, templates: true, fields: [
    { type: "CastLlmConfig", field: "prompt" }, { type: "CastLlmConfig", field: "model", createEmpty: true },
    { type: "CastDatabaseConfig", field: "data" },
  ] } },
] as const satisfies readonly { id: string; label: string; mapping: ResourceMapping }[];

export type CastDesignId = typeof CAST_DESIGNS[number]["id"];

export function createCastDesign(id: CastDesignId) {
  const design = CAST_DESIGNS.find(entry => entry.id === id)!;
  const example = createCastSessionExample();
  const { view, bindings, state } = example;
  view.step_agent_act = {
    ...view.step_agent_act,
    $view: "object",
    $content: "Drive the browser session.\n\nReturn **status** and **summary** for the session result.",
  };
  if (id === "minimal" || id === "data") {
    view.$hideRoot = true;
    for (const node of Object.values(view)) if (node && typeof node === "object") (node as SqueedJson).$hideParentEdge = true;
  }
  if (id === "groups") {
    view.session = { $label: "Session", $icon: "PiDatabase", $collapsed: false };
    view.browser = { $label: "Browser", $icon: "PiBrowser", $collapsed: false };
    view.reporting = { $label: "Reporting", $icon: "PiBroadcast", $collapsed: false };
    for (const step of state.workflow.steps) {
      const group = ["find", "mark_running", "announce_running"].includes(step.id) ? "session"
        : ["launch", "navigate", "stream", "agent_act", "stop_cast"].includes(step.id) ? "browser" : "reporting";
      view[`step_${step.id}`].$parent = `root.${group}`;
    }
    view.tools.$parent = "root.browser";
  }
  if (id === "tools") {
    view.tools = { $label: "Reusable Tools", $icon: "PiWrench", $collapsed: false };
    delete bindings["root.tools"];
    for (const name of Object.keys(state.tools)) {
      const key = `tool_${name}`;
      view[key] = {
        $parent: "root.tools", $view: "icon-label", $label: { $state: `root.tools.${name}.name` },
        $icon: "PiWrench", $bgColor: "gray.600", $hideParentEdge: true,
        $connections: [{ id: `tool:${name}:agent_act`, target: "root.step_agent_act", sourceProperty: "output:resource", targetProperty: "config:tools", style: "dashed" }],
      };
      bindings[`root.${key}`] = { address: `root.tools.${name}`, type: "CastToolConfig" };
    }
  }
  return { ...example, id, label: design.label, mapping: structuredClone(design.mapping) as ResourceMapping };
}

export const CAST_DESIGN_EXAMPLES = Object.fromEntries(CAST_DESIGNS.map(design => [design.id, createCastDesign(design.id)])) as Record<CastDesignId, ReturnType<typeof createCastDesign>>;