import coverage from "./coverage.json";
import type { FormFieldConfig, FormOptionsRequest, FormValue } from "../../src/core/forms";
import type { SqueedJson } from "../../src/core/squeedEdits";
import type { StateForms } from "../../src/utils/formState";

interface CatalogField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: (string | { value: string; label: string })[];
  fetchOptions?: unknown;
  showWhen?: { field: string; values: FormValue[] };
}

export interface ConfigCatalogState {
  id: string;
  name: string;
  steps: { id: string; name: string; type: string; configRef: string }[];
  configs: Record<string, { type: string; config: Record<string, unknown> }>;
}

const schemas = coverage.fields as Record<string, CatalogField[]>;
export const configTypeName = (type: string) => type.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join("") + "Config";
const displayName = (type: string) => type.split("_").map(part => part[0].toUpperCase() + part.slice(1)).join(" ");

export function createConfigCatalog() {
  const state: ConfigCatalogState = { id: "config-catalog", name: "Workflow Configuration Catalog", steps: [], configs: {} };
  const view: SqueedJson = { $label: state.name };
  const bindings: StateForms["bindings"] = {};
  for (const type of coverage.enabledStepTypes) {
    const fields = schemas[type] ?? [];
    const index = state.steps.length;
    state.steps.push({ id: `step_${type}`, name: displayName(type), type, configRef: type });
    state.configs[type] = { type, config: Object.fromEntries(fields.filter(field => field.defaultValue !== undefined).map(field => [field.name, field.defaultValue])) };
    const address = `root.configs.${type}.config`;
    const fieldConfig: Record<string, FormFieldConfig> = {};
    for (const field of fields) {
      const condition = field.showWhen ? { $address: `${address}.${field.showWhen.field}`, $in: field.showWhen.values } : undefined;
      fieldConfig[field.name] = {
        $label: field.label,
        ...(field.type === "textarea" ? { $control: "textarea" as const } : {}),
        ...(field.options || field.fetchOptions ? { $options: { $source: "callback" as const, $dependsOn: [] } } : {}),
        ...(condition ? { $visibleWhen: condition, ...(field.required ? { $requiredWhen: condition } : {}) } : {}),
      };
    }
    bindings[`root.config_${type}`] = { address, type: configTypeName(type), fields: fieldConfig };
    view[`step_${type}`] = {
      $view: "icon-label", $label: { $state: `root.steps.${index}.name` }, $icon: "PiFlowArrow", $bgColor: "blue.600",
      $connections: [{ id: `config:${type}`, target: `root.config_${type}`, label: "configRef", style: "dashed" }],
    };
    view[`config_${type}`] = { $view: "icon-label", $label: `${displayName(type)} Config`, $icon: "PiSlidersHorizontal", $bgColor: "teal.600" };
  }
  state.steps.push({ id: "shared_http", name: "Second HTTP Step", type: "http", configRef: "http" });
  view.shared_http = {
    $view: "icon-label", $label: "Second HTTP Step", $icon: "PiFlowArrow", $bgColor: "blue.600",
    $connections: [{ id: "config:shared-http", target: "root.config_http", label: "same configRef", style: "dashed" }],
  };
  return { state, view, bindings };
}

export function resolveCatalogOptions(request: FormOptionsRequest) {
  const parts = request.address.split(".");
  const field = schemas[parts[2]]?.find(field => field.name === parts.at(-1));
  return (field?.options ?? []).map(option => typeof option === "string" ? { value: option, label: option } : option);
}

export function materializeStepConfigs(state: ConfigCatalogState) {
  const { configs, ...workflow } = state;
  return {
    ...workflow,
    steps: state.steps.map(step => {
      const resource = Object.prototype.hasOwnProperty.call(configs, step.configRef) ? configs[step.configRef] : undefined;
      if (!resource) throw new Error(`Missing configuration: ${step.configRef}`);
      if (resource.type !== step.type) throw new Error(`Configuration type mismatch: ${step.id}`);
      const { configRef, ...metadata } = step;
      return { ...metadata, config: structuredClone(resource.config) };
    }),
  };
}

export const CONFIG_CATALOG = createConfigCatalog();