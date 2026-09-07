import { useState } from "react";
import { PiCaretDown, PiCheck, PiLink, PiPlus, PiTrash, PiX } from "react-icons/pi";
import { ToolbarIconButton } from "../components/toolbarControls";
import { parseRuntimeBinding, runtimePart, serializeRuntimeBinding, type RuntimeBindingValue, type RuntimePart, type RuntimeReference } from "../utils/runtimeBindings";

function Parts({ parts, references, onChange, disabled }: {
  parts: RuntimePart[]; references: RuntimeReference[]; onChange: (parts: RuntimePart[]) => void; disabled: boolean;
}) {
  const update = (index: number, patch: Partial<RuntimePart>) => onChange(parts.map((part, position) => position === index ? { ...part, ...patch } : part));
  return <div style={{ display: "grid", gap: 12 }}>
    {parts.map((part, index) => <fieldset data-binding-part={index} key={index} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend>Part {index + 1}</legend>
      <div style={{ display: "flex", gap: 8 }}><span data-form-select="" style={{ flex: 1 }}><select aria-label="Part type" disabled={disabled} value={part.kind}
        onChange={event => update(index, { kind: event.target.value as RuntimePart["kind"] })}>
        <option value="reference">Reference</option><option value="text">Text</option><option value="conditional">Conditional text</option>
      </select><PiCaretDown size={16} aria-hidden="true" /></span>
        <ToolbarIconButton aria-label={`Remove part ${index + 1}`} title="Remove part" icon={<PiTrash size={18} />} size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(parts.filter((_, position) => position !== index))} />
      </div>
      {part.kind !== "text" && <>
        {part.paths.map((path, referenceIndex) => <label key={referenceIndex}>Reference {referenceIndex + 1}<span data-form-select="" style={{ display: "block" }}>
          <select aria-label={`Reference ${referenceIndex + 1}`} disabled={disabled} value={path} onChange={event => update(index, { paths: part.paths.map((entry, position) => position === referenceIndex ? event.target.value : entry) })}>
            <option value="">Select reference</option>
            {references.map(reference => <option key={reference.path} value={reference.path}>{reference.label}</option>)}
          </select><PiCaretDown size={16} aria-hidden="true" /></span></label>)}
        {part.kind === "reference" && <>
          <ToolbarIconButton aria-label="Add fallback reference" title="Add fallback reference" icon={<PiPlus size={18} />} size="sm" variant="ghost" disabled={disabled} onClick={() => update(index, { paths: [...part.paths, ""] })} />
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" aria-label="Default value enabled" disabled={disabled} checked={part.fallback !== undefined} onChange={event => update(index, { fallback: event.target.checked ? "" : undefined })} />Default value</label>
          {part.fallback !== undefined && <input aria-label="Default value" disabled={disabled} value={part.fallback} onChange={event => update(index, { fallback: event.target.value })} />}
        </>}
      </>}
      {part.kind !== "reference" && <label>Text<textarea aria-label="Part text" disabled={disabled} value={part.text} onChange={event => update(index, { text: event.target.value })} /></label>}
    </fieldset>)}
    <ToolbarIconButton aria-label="Add part" title="Add part" icon={<PiPlus size={18} />} size="sm" variant="ghost" disabled={disabled} onClick={() => onChange([...parts, runtimePart()])} />
  </div>;
}

export function RuntimeBindingEditor({ label, value, references, disabled, onChange }: {
  label: string; value: unknown; references: RuntimeReference[]; disabled: boolean; onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState<RuntimeBindingValue>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true); setError("");
    try { setDraft(await parseRuntimeBinding(typeof value === "string" ? value : "")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to read binding."); }
    finally { setLoading(false); }
  };
  return <div data-runtime-binding={label} style={{ marginBottom: 8 }}>
    <ToolbarIconButton aria-label={`Bind ${label}`} title={`Bind ${label}`} icon={<PiLink size={18} />} size="sm" variant="ghost" disabled={disabled || loading} onClick={open} />
    {typeof value === "string" && value.includes("{{") && <span>Bound value</span>}
    {draft && <fieldset disabled={disabled} style={{ border: 0, margin: 0, padding: "8px 0", minWidth: 0 }}>
      <label>Binding mode<span data-form-select="" style={{ display: "block" }}><select aria-label="Binding mode" value={draft.mode} onChange={event => setDraft({ ...draft, mode: event.target.value as RuntimeBindingValue["mode"], parts: [runtimePart()] })}>
        <option value="reference">Reference</option><option value="condition">Equals</option><option value="template">Text template</option><option value="json">JSON output</option>
      </select><PiCaretDown size={16} aria-hidden="true" /></span></label>
      {draft.mode === "json" ? <>
        {draft.fields.map((field, index) => <fieldset data-output-field={index} key={index} style={{ border: 0, margin: 0, padding: "8px 0", minWidth: 0 }}>
          <label>Output field name<input aria-label="Output field name" value={field.key} onChange={event => setDraft({ ...draft, fields: draft.fields.map((entry, position) => position === index ? { ...entry, key: event.target.value } : entry) })} /></label>
          <Parts parts={field.parts} references={references} disabled={disabled} onChange={parts => setDraft({ ...draft, fields: draft.fields.map((entry, position) => position === index ? { ...entry, parts } : entry) })} />
          <ToolbarIconButton aria-label="Remove output field" title="Remove output field" icon={<PiTrash size={18} />} size="sm" variant="ghost" onClick={() => setDraft({ ...draft, fields: draft.fields.filter((_, position) => position !== index) })} />
        </fieldset>)}
        <ToolbarIconButton aria-label="Add output field" title="Add output field" icon={<PiPlus size={18} />} size="sm" variant="ghost" onClick={() => setDraft({ ...draft, fields: [...draft.fields, { key: "", parts: [runtimePart()] }] })} />
      </> : <Parts parts={draft.parts} references={references} disabled={disabled} onChange={parts => setDraft({ ...draft, parts })} />}
      {draft.mode === "condition" && <label>Equals<input aria-label="Comparison value" value={draft.comparison} onChange={event => setDraft({ ...draft, comparison: event.target.value })} /></label>}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <ToolbarIconButton aria-label="Apply binding" title="Apply binding" icon={<PiCheck size={20} />} size="sm" variant="ghost" onClick={() => {
          try { onChange(serializeRuntimeBinding(draft, references)); setDraft(undefined); setError(""); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to apply binding."); }
        }} />
        <ToolbarIconButton aria-label="Cancel binding" title="Cancel binding" icon={<PiX size={20} />} size="sm" variant="ghost" onClick={() => { setDraft(undefined); setError(""); }} />
      </div>
    </fieldset>}
    {error && <p role="alert">{error}</p>}
  </div>;
}