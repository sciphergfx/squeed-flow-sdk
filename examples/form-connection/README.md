# Bind Your Own Properties

[MinimalExample.tsx](MinimalExample.tsx) is a two-node React example: double-click
the settings node to edit three fields; the preview displays their current values.
It uses the public SDK API, with no Backflow account, workflow executor, or backend.
The existing **Form Connection** template in SDK Test explains the same binding
using a larger annotated diagram.

## Run the Minimal Example

Use the SDK's [installation prerequisites](../../README.md#install) in an
existing React + Vite app, then render `<MinimalExample />` from
[MinimalExample.tsx](MinimalExample.tsx). Keep its four imported files together.
Use the Chakra provider from the [quick start](../../README.md#quick-start), or
keep your app's existing provider. The component supplies the required height.
Vite's `?raw` import loads the interface as text; with another bundler, supply that
text using its raw-text loader or fetch it as a static file. Include `vite/client`
types for TypeScript raw imports. The interface is parsed, never executed.

## Four Small Inputs

| Input                                  | Purpose                                             | What to change                                   |
| -------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| [state.json](state.json)               | Plain application values under `step`               | Your objects and initial property values         |
| [minimal-view.json](minimal-view.json) | Node appearance, labels, preview, visual connection | Node keys, icons, colors, and display references |
| [bindings.json](bindings.json)         | Associates a view node with state and a form type   | View-node address, state address, interface name |
| [interface.ts](interface.ts)           | Types for generated form fields                     | Property names, types, and optionality           |

The essential binding is:

```json
{
  "root.form": { "address": "root.step", "type": "SampleStep" }
}
```

`root.form` identifies the `form` node in the view. `root.step` identifies the
editable object in state. `SampleStep` selects the parsed interface. These names
do **not** have to match: the binding connects them. `root` means the document
root; it is not an extra key to add to either JSON file.

## Use Your Own Data

For state shaped like `{ "jobs": { "email": { "title": "Send receipt",
"active": true, "timeout": 30 } } }`:

1. Define `interface EmailSettings { title: string; active: boolean; timeout: number; }`
   in [interface.ts](interface.ts).
2. Change the binding to `{ "root.form": { "address": "root.jobs.email", "type": "EmailSettings" } }`.
3. Set the form node's `$label` reference to `{ "$state": "root.jobs.email.title" }`
   and the preview's `$content` reference to `{ "$state": "root.jobs.email" }`.
4. Replace [state.json](state.json) with that application state. The React wiring
   remains unchanged; it derives required interface names from the bindings.

Add another node and binding to edit another object. Two bindings can point to
the same state address to share values. Prefer stable object keys such as
`root.jobs.email`; array addresses such as `root.jobs.0` must be updated when
items reorder. Addresses use dot-separated segments, so avoid literal dots in keys.

## Configure Fields and Appearance

Strings, numbers, and booleans generate their respective controls. A literal
union such as `mode: "fast" | "safe"` supplies choices; `note?: string` is optional.
For display-only field overrides, extend the binding:

```json
{
  "root.form": {
    "address": "root.jobs.email",
    "type": "EmailSettings",
    "fields": {
      "title": { "$label": "Job title", "$control": "textarea" },
      "active": { "$label": "Enabled" }
    }
  }
}
```

Field keys are relative to the bound object. `$label` changes the UI label, not
the property name stored in state. Dynamic choices use `$options` and the host's
`callbacks.resolveFormOptions`; fetch them through your own authenticated API.

Node `$view`, `$icon`, `$bgColor`, and `$label` belong in the view, not state.
Diagram-wide settings belong in `config`: `direction`, `colorMode`, `themeColor`,
`edgeType`, and `compactPropertyLayout`. Keep `edgeMode: "auto"` to show all
connections. `"properties"` hides ordinary `$target` links; `"nodes"` hides
port connections. These are visibility filters, not data deletion.

## Edits, Connections, and Saving

`forms.onStateChange(nextState, change)` receives immutable application-data edits;
`callbacks.onJsonChange(nextView, change)` receives visual edits. The example
stores both separately in React state. Persist them separately using your own API;
nothing is saved or executed remotely by this component. Omitting
`forms.onStateChange` (and its older `onChange` alias) makes forms read-only.

`$state` references resolve for display without adding diagram keys to application
data. `$target: "root.preview"` creates a visual connection only. For explicit
ports, use `$ports` plus `$connections` with matching `sourceProperty` and
`targetProperty` names; see [ports and edge modes](../../README.md#custom-node-editing).
Drawing or deleting a link does not infer your application's dependency rules.
Map those callbacks to state explicitly when your domain needs that behavior.

For JSON-configured collections, stable ID fields, automatic dependencies,
reusable resources, and portable packages, continue with the
[declarative configuration guide](../workflow-state/README.md#declarative-configuration)
and its [binding contract](../declarative/types.ts). Those adapters are client
examples, not additional exports required by the minimal SDK setup.
