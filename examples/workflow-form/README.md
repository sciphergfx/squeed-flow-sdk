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
select a node and click its gear to edit its properties. This single upload
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

The full interface is rejected with `Unsupported TypeScript type: any`.
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

Regenerate with `node examples/workflow-form/extract.mjs <backflow-admin/src/pages/workflows>`.
Run `node examples/workflow-form/validate.mjs` after building the SDK.
Compile the two interface files separately because they intentionally declare
the same interface names. The temporary browser preview holds graph state
in memory; refreshing it resets the fixture.
