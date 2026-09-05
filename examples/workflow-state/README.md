# Independent Workflow State

In SDK Test choose **workflow-state**, then upload **interface.ts** through
**Upload workflow interface**. Select a node and use its gear. The **json**
and **state** controls inspect the separate documents.

- `state.json`: workflow data only. No Squeed keys, form bindings or layout.
- `view.json`: Squeed design only, including optional state references.
- `bindings.json`: view-node address to state address and interface name.
- `interface.ts`: field types, optionality and literal-union dropdown options.
- `callbacks.ts`: host-owned sample choices and dependent trigger-field edits.

```tsx
const [view, setView] = useState(initialView);
const [state, setState] = useState(initialState);

<FlowDiagram
  json={view}
  forms={{ state, bindings, onChange: setState }}
  callbacks={{
    onJsonChange: setView,
    onFormChange: onExampleFormChange,
    resolveFormOptions: resolveExampleOptions,
  }}
/>
```

For preloaded types, supply `config.formSchema`. Uploads read the interface
names declared in bindings; they do not execute TypeScript.

## References

Use `$view: "icon-label"` for an icon surface with a centered caption below.
The caption uses `$label` (including state references); form bindings and the
gear remain available. This compact view does not display `$content`.

```json
{
  "assistant": {
    "$label": { "$state": "root.steps.0.name" },
    "$content": { "$state": "root.steps.0.config.prompt" }
  }
}
```

References are resolved into a temporary render document. Original reference
objects remain in the view. They support `$label`, `$content`, `$icon`,
`$bgColor`, `$textColor` and `$borderColor`; missing values render blank,
objects render as JSON. No JavaScript or expression evaluation is performed.
The resolved `$content` value uses the existing Markdown renderer.

Bindings are explicit and need not share addresses with state. The host must
update index-based bindings if it reorders steps. Removing a visual node does
not delete state. Drawing visual connections does not change execution logic.
The host owns those operations; the SDK does not infer workflow semantics.

## Scope

This is an editing example, not an executable integration. HTTP endpoints are
empty and model/tool choices are local samples, not fetched tenant resources.
LLM `memory` represents the existing editor's entity-type knowledge context.
The backend executor still owns condition evaluation, branch dispatch and full
validation. The interface exposes the supported config subset, not arbitrary
JSON, complete backend refinements or all workflow step types.

Form callbacks receive only independent state. Dependent edits are applied as
one state update; Squeed metadata is rejected. Display changes emit
`onJsonChange`; state changes emit `forms.onChange`. Without `forms.onChange`,
the form is read-only. Legacy `$form` document mode remains available for
compatibility but should not be used for independent workflow state.