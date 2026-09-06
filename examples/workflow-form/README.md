# Workflow Form Validation Probe

## Backend Validator Interface

Upload **backend-interface.ts** through **Upload workflow interface** on the
Workflow dataset. It is a form-compatible projection of
`backflow/src/lib/agent/workflow-config-validation.ts`, not the executable Zod
validator. `WorkflowForm` represents `WorkflowConfigSchema`; `WorkflowStep`
represents `StepSchema`. Existing graph bindings work unchanged.

Trigger options are manual, event, schedule, webhook, api, auto and on_violation.
Execution Mode uses local, server and hybrid. Step action/type remain strings:
the backend permits custom tool names, not just its built-in action list.

Projection limits:

- System-owned tenantVisible, cache and cacheable are intentionally excluded
  from editable forms; existing document values are preserved.
- Trigger uses the string-enum branch; object triggers are not represented.
- Mixed-value fields `version`, `loop` and `tools` are omitted because the
  current form controls cannot faithfully edit both branches.
- Arbitrary JSON fields are omitted: step input/params/config/conditions/defaultValue,
  workflow onError/input/config, config onError/input/context/monitoring,
  pausePoint metadata, prefetch filter and goalConfig validators.
- Files, images and RAG preserve declared fields only; passthrough keys are not modeled.
- Numeric bounds, nonempty strings/arrays, strict unknown-key checks, cross-field
  refinements and per-action parameter checks remain backend validation concerns.
- Backend config requires an ID. The existing admin-oriented graph has no ID;
  enter one in its form. Admin-only values such as isPublic are not backend fields.

The older supported/full interfaces and inventory below remain admin-editor probes.

## Editable Form Preview

Open `http://127.0.0.1:4197/?graph=json` while the preview server is running.
It loads `ui.json`, containing Workflow and Check Order, without a form schema.
Use **Upload workflow interface** to upload `supported-interface.ts`, then
double-click a bound node to edit its properties. This single upload
supplies both node forms and connection validation in Nodes or Properties mode.

Refreshing restores `ui.json`; upload the schema again after a refresh.
The original Alpha/Beta fixture remains available at `?graph=basic-json`.

## Connection Validation

Extracted from Backflow admin's `Workflows.tsx` editor path: workflow types,
editor-loaded settings, workflow tab, and all `STEP_CONFIG_SCHEMAS` entries.
No production workflows were saved or executed. No environment files were read.

- `full-interface.ts`: full static snapshot, including permissive `any` and index signatures.
- `coverage.json`: 26 schemas, 138 schema fields, defaults, options, conditional visibility and 93 unsupported member omissions.
- `supported-interface.ts`: explicitly limited projection plus validation samples. It is NOT a complete workflow validation contract.
- `graph.json`: 31-node field inventory with 17 advanced property mappings.
- `results.json`: per-case expectations, reasons, and results.

The full interface is accepted by the named form importer: `any`/`unknown`
become JSON editors, and string-keyed records/index signatures retain their
value schemas. A dictionary-only root such as `CustomConfig` has a whole-object
JSON editor. Strict `parseTypeScriptContract` still rejects `any`; form-derived
connections involving arbitrary JSON or dictionaries are marked unverified.
The supported projection passes 17 checks: 8 compatible, 8 incompatible,
1 unverified. Cases cover arrays, optionality, literal unions, nested retry
objects, nested approval/resource requirements, booleans and numbers.
The browser upload reproduces those counts and retains all 17 mappings.

Dynamic tool parameters, arbitrary custom config, index signatures and JSON
fields do not have exhaustive static shapes. String/textarea controls parse
JSON when possible, and selects accept advanced values. Their restrictions
must not be inferred from display labels or dropdown options alone.
Conditional requiredness is preserved in the coverage metadata but is not
enforced by the current structural compatibility checker.

## Reusable Configuration Catalog

SDK Test's **Config Catalog** dataset uses `catalog.ts`, the full interface and
the coverage metadata. Each of the 25 enabled step types has a separate config
node and explicit `configRef` binding. Two HTTP steps share one config node.
The **Configuration type** selector focuses the matching node; double-click
opens its form. State and view stay separate, including after form edits.

All 138 declared fields from 26 schemas are retained. `firebase` and
`while_loop` are schema-only, disabled types; `custom` uses the open dictionary
schema. Defaults, static options and conditional field visibility/requiredness
come from the editor metadata. Dynamic options, provider/model selectors,
custom tool schemas and advanced-value UI behavior still need host adapters.
An empty required field is not a valid executable configuration.

`materializeStepConfigs(state)` resolves config references to independent
copies of editor-shaped inline configs, retaining unknown values and rejecting
missing references/type mismatches. It does not save, validate or execute a
workflow, or resolve the nested resource IDs in the workflow-state example.
The optional `BACKFLOW_WORKFLOW_SOURCE` unit test compares the result against
the actual editor normalizer; it does not establish backend acceptance.

## Freshness and Readiness

Regenerate with `node examples/workflow-form/extract.mjs <backflow-admin/src/pages/workflows>`.
Append `--check` to check freshness without writing. TypeScript comparison is
structural; the supported projection deliberately narrows `WorkflowForm.trigger`,
recorded in `coverage.json`. The 93 omitted members apply to that limited
projection, not to the full catalog's field coverage.

After building, run
`node examples/workflow-form/readiness.mjs <backflow-admin/src/pages/workflows>`.
It checks freshness, form field retention and config bindings, and lists the
remaining production integration blockers. `--require-deployable` exits with
failure while deployment readiness is unverified. Production save/load,
tenant-scoped adapters, resource resolution, backend validation and the full
release gate are still required; field counts alone do not establish readiness.

Run `node examples/workflow-form/validate.mjs` after building the SDK.
Compile the two interface files separately because they intentionally declare
the same interface names. The temporary browser preview holds graph state
in memory; refreshing it resets the fixture.
