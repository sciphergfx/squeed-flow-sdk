import workflow from "./workflow.json";
import type { SqueedJson } from "../../src/core/squeedEdits";
import type { StateFormBinding } from "../../src/utils/formState";

const presentations: Record<string, { type: string; icon: string; color: string }> = {
  database: { type: "CastDatabaseConfig", icon: "PiDatabase", color: "blue.600" },
  browser: { type: "CastBrowserConfig", icon: "PiBrowser", color: "teal.600" },
  llm: { type: "CastLlmConfig", icon: "PiRobot", color: "gray.700" },
  transform: { type: "CastTransformConfig", icon: "PiArrowsClockwise", color: "cyan.700" },
  emit_event: { type: "CastEventConfig", icon: "PiBroadcast", color: "green.700" },
  notification: { type: "CastNotificationConfig", icon: "PiBell", color: "pink.700" },
  output: { type: "CastOutputConfig", icon: "PiExport", color: "gray.600" },
};

export function createCastSessionExample() {
  const state = { workflow: structuredClone(workflow), tools: {} as Record<string, { name: string }> };
  const view: SqueedJson = { $label: workflow.name,
    trigger: { $view: "icon-label", $label: { $state: "root.workflow.name" }, $subtitle: { $state: "root.workflow.trigger" }, $icon: "PiPlay", $bgColor: "teal.700" },
    tools: { $label: "Tools", $view: "icon-label", $icon: "PiWrench", $bgColor: "gray.600", $connections: [] },
  };
  const bindings: Record<string, StateFormBinding> = {
    "root.trigger": { address: "root.workflow", type: "CastWorkflow" },
    "root.tools": { address: "root", type: "CastToolRegistry", resourceType: "CastToolConfig", portResources: {} },
  };
  for (const [index, step] of state.workflow.steps.entries()) {
    const presentation = presentations[step.type];
    const key = `step_${step.id}`;
    view[key] = {
      $view: "icon-label", $label: { $state: `root.workflow.steps.${index}.name` },
      $subtitle: step.condition ?? step.config.action ?? step.config.operation ?? step.type,
      $icon: presentation.icon, $bgColor: presentation.color,
    };
    bindings[`root.${key}`] = { address: `root.workflow.steps.${index}.config`, type: presentation.type,
      fields: { prompt: { $control: "textarea" }, tools: { $options: { $source: "callback", $dependsOn: ["root.tools"] } } },
    };
    for (const tool of step.config.tools ?? []) {
      state.tools[tool] = { name: tool };
      view.tools[tool] = tool;
      view.tools.$connections.push({ id: `tool:${tool}:${step.id}`, target: `root.${key}`, sourceProperty: `output:${tool}`, targetProperty: "config:tools", style: "dashed" });
      bindings["root.tools"].portResources![`output:${tool}`] = `root.tools.${tool}`;
    }
  }
  for (const step of state.workflow.steps) {
    const sources = step.dependsOn?.length ? step.dependsOn.map(id => `step_${id}`) : ["trigger"];
    for (const source of sources) {
      view[source].$connections = [...(view[source].$connections ?? []), {
        id: `depends:${source}:${step.id}`, target: `root.step_${step.id}`,
        sourceProperty: "output:output", targetProperty: "input:input",
        ...(step.condition ? { label: step.condition } : {}),
      }];
    }
  }
  return { state, view, bindings };
}

export const CAST_SESSION_EXAMPLE = createCastSessionExample();