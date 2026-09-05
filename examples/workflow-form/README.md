# Workflow Form Validation Probe

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