# Independent Workflow State

In SDK Test choose **workflow-state**. Its bundled **interface.ts** loads
automatically; **Upload workflow interface** can replace it. Double-click a bound
node to configure it. The **json** and **state** controls inspect the separate documents.

Choose **form-connection** for a minimal working diagram showing UI JSON,
bindings, the TypeScript interface, a generated form, and its separate state.

- `state.json`: workflow data only. No Squeed keys, form bindings or layout.
- `view.json`: Squeed design only, including optional state references.
- `bindings.json`: view-node address to state address and interface name.
- `interface.ts`: field types, optionality and literal-union dropdown options.
- `callbacks.ts`: shared-resource links and choices, plus dependent trigger-field edits.

```tsx
const [view, setView] = useState(initialView);
const [state, setState] = useState(initialState);
const displayView = useMemo(
  () => projectWorkflowStateView(view, state),
  [view, state],
);

<FlowDiagram
  json={displayView}
  forms={{ state, bindings, onChange: setState }}
  callbacks={{
    onJsonChange: setView,
    onFormChange: onExampleFormChange,
    resolveFormOptions: resolveExampleOptions,
  }}
/>;
```

For preloaded types, supply `config.formSchema`. Uploads read the interface
names declared in bindings; they do not execute TypeScript.

## References

Use `$view: "icon-label"` for an icon surface with a centered caption below.
The caption uses `$label` (including state references); double-click opens its
bound form. This compact view does not display `$content` or configuration rows.
`$subtitle` adds one muted line beneath the label and supports `$state`
references. The trigger uses its event name, schedule expression, or mode name.
For raw nodes, set `data.config.subtitle` on an icon-label view.

Loading a form schema preserves the node's view type. Configuration summaries
appear only in object/property presentation, not beside content or icon labels.

```json
{
  "prompt": {
    "$label": { "$state": "root.texts.user_review.name" },
    "$content": { "$state": "root.texts.user_review.content" }
  }
}
```

References are resolved into a temporary render document. Original reference
objects remain in the view. They support `$label`, `$subtitle`, `$content`, `$icon`,
`$bgColor`, `$textColor` and `$borderColor`; missing values render blank,
objects render as JSON. No JavaScript or expression evaluation is performed.
The resolved `$content` value uses the existing Markdown renderer.

Tools live in `state.tools`, keyed by stable ID. Steps reference those IDs in
`config.tools`; multiple steps can point to the same tool without duplicating
its configuration. Each tool has its own node and `ToolConfig` form. Removing
a tool from a step removes its resource link, not the shared tool.

Prompts and instructions live in `state.texts` and render as editable content
nodes, not tool forms. Steps store `promptId` and `instructionIds`. Inline text
and title edits update the referenced state value while preserving `$state`
references. The example projection derives dashed links and bottom/top ports
from these IDs; it does not execute the workflow.

Bindings are explicit and need not share addresses with state. The host must
update index-based bindings if it reorders steps. Removing a visual node does
not delete state. Drawing visual connections does not change execution logic.
The host owns those operations; the SDK does not infer workflow semantics.

## Scope

This is an editing example, not an executable integration. HTTP endpoints are
local examples and model/tool choices are local samples, not fetched tenant resources.
LLM `memory` represents the existing editor's entity-type knowledge context.
The backend executor still owns condition evaluation, branch dispatch and full
validation. The interface exposes the supported config subset, not arbitrary
JSON, complete backend refinements or all workflow step types.

Form callbacks receive only independent state. Dependent edits are applied as
one state update; Squeed metadata is rejected. Display changes emit
`onJsonChange`; state changes emit `forms.onChange`. Without `forms.onChange`,
the form is read-only. Legacy `$form` document mode remains available for
compatibility but should not be used for independent workflow state.
