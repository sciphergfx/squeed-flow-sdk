import assert from "node:assert/strict";
import { test } from "node:test";
import { createConfiguredDiagram } from "../examples/declarative/adapter";
import type { DiagramBindings, DiagramDesign } from "../examples/declarative/types";
import { reconcileWorkflowDependencies } from "../examples/workflow-state/dependencies";
import { reconcileWorkflowConnections, projectWorkflowPorts } from "../examples/workflow-state/ports";
import type { FormSchema } from "../src/core/forms";
import { applyConfiguredAppearance, captureConfiguredDesign, exportConfiguredSource, parseConfiguration, validateConfiguration } from "../examples/declarative/configuration";

const config: DiagramBindings = {
  version: 1, title: "root.title", exportAddress: "root", nodes: {},
  collection: { address: "root.jobs", idField: "key", typeField: "kind", propertiesField: "settings", labelField: "title", subtitleFields: ["kind"], nodePrefix: "job_", types: { task: "Task" } },
  dependencies: { field: "requires", sourceProperty: "output:result", targetProperty: "input:request" },
};
const design: DiagramDesign = { version: 1, defaults: { $view: "icon-label" }, types: { task: { $icon: "PiGear" } }, nodes: {}, mapping: { version: 1, fields: [] } };
const source = { title: "Independent data", jobs: [
  { key: "first", kind: "task", title: "First", settings: { value: 1 } },
  { key: "second", kind: "task", title: "Second", requires: ["first"], settings: { value: 2 } },
] };

test("declarative binding and design generate arbitrary data without workflow-specific keys", () => {
  const result = createConfiguredDiagram(source, config, design);
  assert.deepEqual(result.state, source);
  assert.notEqual(result.state, source);
  assert.equal(result.bindings["root.job_second"].address, "root.jobs.1.settings");
  assert.equal(result.view.job_first.$icon, "PiGear");
  assert.deepEqual(result.view.job_first.$connections[0], { id: "depends:job_first:second", target: "root.job_second", sourceProperty: "output:result", targetProperty: "input:request" });
  const next = reconcileWorkflowDependencies({ ...result.view, job_first: { ...result.view.job_first, $connections: [] } }, result.view, result.state, result.dependencyMapping);
  assert.deepEqual(next.jobs[1].requires, []);
  assert.deepEqual(source.jobs[1].requires, ["first"]);
});

test("configuration rejects duplicate identities and missing collection/type mappings", () => {
  assert.throws(() => createConfiguredDiagram({ ...source, jobs: [source.jobs[0], source.jobs[0]] }, config, design), /unique/);
  assert.throws(() => createConfiguredDiagram({}, config, design), /Collection not found/);
  assert.throws(() => createConfiguredDiagram(source, { ...config, collection: { ...config.collection, types: {} } }, design), /interface/);
});

test("configuration is portable JSON and rejects unsafe paths before applying changes", () => {
  const restored = parseConfiguration(JSON.stringify({ bindings: config, design })) as { bindings: DiagramBindings; design: DiagramDesign };
  assert.deepEqual(createConfiguredDiagram(source, restored.bindings, restored.design).state, source);
  assert.throws(() => parseConfiguration('{"__proto__":{}}'), /Unsafe/);
  assert.throws(() => validateConfiguration({ ...config, exportAddress: "root.__proto__" }, design), /Invalid/);
  assert.deepEqual(exportConfiguredSource(source, config), source);
  const captured = captureConfiguredDesign(design, { job_first: { $icon: "PiBell", $label: { $state: "root.jobs.0.title" }, $ports: [] } });
  assert.equal(captured.overrides!.job_first.$icon, "PiBell");
  assert.equal(captured.overrides!.job_first.$ports, undefined);
});

test("appearance overrides retain edits and resets without freezing generated defaults", () => {
  const base = { job_first: { $view: "icon-label", $icon: "PiGear", $bgColor: "green.600" } };
  const changed = { job_first: { $view: "icon-label", $icon: "PiBell" } };
  const captured = captureConfiguredDesign(design, changed, base);
  assert.equal(captured.overrides!.job_first.$view, undefined);
  const regenerated = { job_first: { ...base.job_first, $view: "object" } };
  assert.deepEqual(applyConfiguredAppearance(regenerated, captured), { job_first: { $view: "object", $icon: "PiBell" } });
  assert.equal(regenerated.job_first.$bgColor, "green.600");
});

test("resource registry ports are derived from data and config links update source references", () => {
  const resourceConfig: DiagramBindings = { ...config, resources: [{ field: "settings.refs", registry: "catalog", type: "Item", registryType: "Registry", sourceProperty: "output:resource", targetProperty: "config:refs", nodePrefix: "item_" }] };
  const data = { ...source, jobs: [{ ...source.jobs[0], settings: { value: 1, refs: ["new_resource"] } }, source.jobs[1]] };
  const schema: FormSchema = {
    Task: { kind: "object", properties: { value: { type: { kind: "number" }, optional: false }, refs: { type: { kind: "array", items: { kind: "string" } }, optional: true } }, ports: { refs: { kind: "config", resourceType: "Item", multiple: true } } },
    Item: { kind: "object", properties: { name: { type: { kind: "string" }, optional: false } }, ports: { resource: { kind: "output" } } },
    Registry: { kind: "object", properties: {} },
  };
  const example = createConfiguredDiagram(data, resourceConfig, design);
  const ports = projectWorkflowPorts(example.view, schema, "TB", example.bindings);
  assert.ok(ports.catalog.$ports.some(port => port.id === "output:new_resource"));
  const changed = { ...example.view, catalog: { ...example.view.catalog, $connections: [] } };
  const reconciled = reconcileWorkflowConnections(changed, example.state, schema, example.view, example.bindings);
  assert.deepEqual(reconciled.state.jobs[0].settings.refs, []);
  assert.equal(reconciled.state.jobs[0].settings.value, 1);
});

test("record collections use configurable identities for reverse dependency edits", () => {
  const recordSource = { ...source, jobs: { alpha: source.jobs[0], beta: source.jobs[1] } };
  const example = createConfiguredDiagram(recordSource, config, design);
  const next = reconcileWorkflowDependencies({ ...example.view, job_first: {} }, example.view, example.state, example.dependencyMapping);
  assert.deepEqual(next.jobs.beta.requires, []);
  assert.equal(next.jobs.alpha, example.state.jobs.alpha);
});

test("edge appearance round-trips independently of dependency identities", () => {
  const base = { job_first: { $connections: [{ target: "root.job_second", sourceProperty: "output:result", targetProperty: "input:request", label: "Original" }] } };
  const edited = { job_first: { $connections: [{ ...base.job_first.$connections[0], label: "Edited", style: "animated", animationVariant: "traveling" }] } };
  const captured = captureConfiguredDesign(design, edited, base);
  assert.deepEqual(applyConfiguredAppearance(base, captured), edited);
  assert.equal(base.job_first.$connections[0].label, "Original");
});

test("generated registries cannot overwrite input data", () => {
  const resources = [{ field: "settings.refs", registry: "jobs", type: "Item", registryType: "Registry", sourceProperty: "output:resource", targetProperty: "config:refs", nodePrefix: "item_" }];
  assert.throws(() => createConfiguredDiagram(source, { ...config, resources }, design), /conflicts with source data/);
  assert.deepEqual(source.jobs[1].requires, ["first"]);
});

test("malformed configuration and structural appearance overrides are rejected", () => {
  assert.throws(() => validateConfiguration({ ...config, collection: { ...config.collection, subtitleFields: null as any } }, design), /collection/);
  assert.throws(() => validateConfiguration(config, { ...design, groups: {} as any }), /Groups/);
  assert.throws(() => validateConfiguration(config, { ...design, overrides: { job_first: { $connections: [] } } }), /cannot change/);
  assert.throws(() => validateConfiguration(config, { ...design, edgeOverrides: { test: { set: { target: "other" }, remove: [] } } }), /endpoints/);
  assert.throws(() => validateConfiguration(config, { ...design, canvas: { edgeRadius: -1 } }), /radius/);
});