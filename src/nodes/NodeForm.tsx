import { createContext, useContext, useEffect, useId, useState, useRef } from "react";
import styled from "@emotion/styled";
import { PiX } from "react-icons/pi";
import { conditionMatches, formOptions, formValueError, resolveFormNode, readOnlyFormData, type FormFieldConfig, type FormOption, type FormRequest, type FormSchema } from "../core/forms";
import { getNode, type SqueedJson } from "../core/squeedEdits";
import type { ContractProperty } from "../core/workflowContract";
import type { FlowDiagramCallbacks } from "../types";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { useStopPropagation } from "../hooks/useStopPropagation";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";

export const FormDocumentContext = createContext<{
  data?: SqueedJson;
  schema?: FormSchema;
  callbacks: FlowDiagramCallbacks;
}>({ callbacks: {} });

const Fields = styled.div`
  padding: 40px;
  font-size: 32px;
  line-height: 1.4;
  width: 100%;
  box-sizing: border-box;
  & [data-form-field] { padding: 14px 0; min-width: 0; }
  & label { display: block; margin-bottom: 10px; font-size: 28px; }
  & input:not([type="checkbox"]), & textarea, & select {
    width: 100%; min-width: 0; box-sizing: border-box; font: inherit; color: inherit;
    padding: 12px; border: 1px solid currentColor; border-radius: 6px;
    background: transparent;
  }
  & textarea { min-height: 150px; resize: vertical; }
  & input[type="checkbox"] { width: 32px; height: 32px; }
  & button { font: inherit; cursor: pointer; }
  & button:disabled, & input:disabled, & select:disabled, & textarea:disabled { cursor: default; opacity: 0.55; }
  & [role="alert"] { color: #dc2626; font-size: 26px; margin-top: 8px; }
`;

function Field({ request, property, config, value, disabled }: {
  request: FormRequest;
  property: ContractProperty;
  config: FormFieldConfig;
  value: unknown;
  disabled: boolean;
}) {
  const { callbacks } = useContext(FormDocumentContext);
  const { themeColor } = useFlowDiagramContext();
  const { background } = useCustomColors();
  const id = useId();
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const [failure, setFailure] = useState("");
  const [retry, setRetry] = useState(0);
  const [remote, setRemote] = useState<{ key: string; options: FormOption[]; error?: string }>();
  const dynamic = config.$options?.$source === "callback";
  const resolve = callbacks.resolveFormOptions;
  const { data, address, nodeAddress, nodeId } = request;
  const latestData = useRef(data);
  latestData.current = data;
  const optionKey = JSON.stringify([address, nodeId, config.$options?.$dependsOn
    ? config.$options.$dependsOn.map(dependency => getNode(data, dependency))
    : getNode(data, nodeAddress)]);
  useEffect(() => { setDraft(value === undefined ? "" : String(value)); setFailure(""); }, [value, address, nodeId]);
  useEffect(() => {
    if (!dynamic) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!resolve) throw new Error("No options resolver configured");
      return resolve({ address, nodeAddress, nodeId, data: readOnlyFormData(latestData.current), signal: controller.signal });
    }).then(options => {
      if (!Array.isArray(options) || options.some(option => !option || typeof option.label !== "string" || !["string", "number", "boolean"].includes(typeof option.value) && option.value !== null)) throw new Error("Invalid options response");
      if (!controller.signal.aborted) setRemote({ key: optionKey, options });
    }).catch(error => {
      if (!controller.signal.aborted) setRemote({ key: optionKey, options: [], error: error instanceof Error ? error.message : "Options unavailable" });
    });
    return () => controller.abort();
  }, [dynamic, resolve, optionKey, address, nodeAddress, nodeId, retry]);
  const loading = dynamic && remote?.key !== optionKey;
  const options = dynamic ? (remote?.key === optionKey ? remote.options : []) : formOptions(property.type);
  const multiple = property.type.kind === "array";
  const control = config.$control ?? (options ? (multiple ? "pills" : "select") : property.type.kind === "boolean" ? "checkbox" : "input");
  const required = !property.optional || !!config.$requiredWhen && conditionMatches(config.$requiredWhen, data);
  const issue = failure || (dynamic && remote?.key === optionKey && remote.error) || formValueError(property.type, value, required);
  const label = config.$label ?? address.split(".").pop()!;
  const commit = (next: unknown) => {
    if (disabled || Object.is(next, value)) return;
    try {
      callbacks.onFormChange?.({ ...request, previousValue: value, value: next });
      setFailure("");
    } catch (error) { setFailure(error instanceof Error ? error.message : "Unable to update field"); }
  };
  const commitDraft = () => {
    const numeric = property.type.kind === "number" || property.type.kind === "integer";
    const next = draft === "" && property.optional ? undefined : numeric && draft !== "" ? Number(draft) : draft;
    const error = formValueError(property.type, next, required);
    if (numeric && error && draft !== "") { setFailure(error); return; }
    commit(next);
  };
  const props = { id, disabled, "aria-label": label, "aria-required": required, "aria-invalid": !!issue, "aria-describedby": issue ? `${id}-error` : undefined };
  const accent = getChakraColorHex(themeColor);
  return <div data-form-field={address} data-flow-property={address.slice(nodeAddress.length + 1)}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      {property.optional && value !== undefined && <button type="button" aria-label={`Clear ${label}`} title={`Clear ${label}`} disabled={disabled} style={{ border: 0, background: "transparent", color: "inherit" }} onClick={() => commit(undefined)}><PiX size={28} /></button>}
    </div>
    {control === "checkbox" ? <input {...props} type="checkbox" checked={value === true} style={{ accentColor: accent }} onChange={event => commit(event.target.checked)} />
      : control === "select" ? <select {...props} disabled={disabled || loading || !!remote?.error} value={options?.findIndex(option => Object.is(option.value, value)) ?? -1}
          style={{ background: getChakraColorHex(background) }} onChange={event => { const option = options?.[Number(event.target.value)]; if (option) commit(option.value); }}>
          <option value={-1} disabled>{loading ? "Loading..." : value !== undefined ? `${String(value)} (unavailable)` : "Select..."}</option>
          {options?.map((option, index) => <option key={index} value={index}>{option.label}</option>)}
        </select>
      : control === "pills" ? <div id={id} role="group" aria-label={label} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {options?.map((option, index) => {
            const selected = multiple ? Array.isArray(value) && value.includes(option.value) : Object.is(value, option.value);
            return <button key={index} type="button" disabled={disabled || loading} aria-pressed={selected} style={{ padding: "8px 16px", borderRadius: 24, border: "1px solid currentColor", color: selected ? accent : "inherit", background: selected ? "color-mix(in srgb, currentColor 12%, transparent)" : "transparent" }}
              onClick={() => commit(multiple ? selected ? (value as unknown[]).filter(item => item !== option.value) : [...(Array.isArray(value) ? value : []), option.value] : option.value)}>{option.label}</button>;
          })}
          {loading && <span role="status">Loading...</span>}
        </div>
      : control === "textarea" ? <textarea {...props} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commitDraft} />
      : <input {...props} type={property.type.kind === "number" || property.type.kind === "integer" ? "number" : "text"} step={property.type.kind === "integer" ? 1 : "any"} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commitDraft} onKeyDown={event => { if (event.key === "Enter") commitDraft(); if (event.key === "Escape") setDraft(value === undefined ? "" : String(value)); }} />}
    {issue && <div role="alert" id={`${id}-error`}>{issue}</div>}
    {dynamic && remote?.error && <button type="button" disabled={disabled} onClick={() => { setRemote(undefined); setRetry(retry + 1); }}>Retry</button>}
  </div>;
}

export function NodeForm({ nodeAddress }: { nodeAddress: string }) {
  const { data, schema, callbacks } = useContext(FormDocumentContext);
  const { readOnly, config } = useFlowDiagramContext();
  const ref = useStopPropagation<HTMLDivElement>(true);
  if (!data) return <Fields role="alert">Forms require a JSON document.</Fields>;
  const resolved = schema && resolveFormNode(data, nodeAddress, schema);
  if (!resolved) return <Fields role="status">Form schema unavailable.</Fields>;
  const node = getNode(data, nodeAddress);
  return <Fields ref={ref} data-flow-form={nodeAddress} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    {Object.entries(resolved.type.properties).map(([key, property]) => {
      const fieldConfig = resolved.fields[key] ?? {};
      if (!conditionMatches(fieldConfig.$visibleWhen, data)) return null;
      if (property.type.kind === "object" || property.type.kind === "array" && !formOptions(property.type) && !fieldConfig.$options) return null;
      const address = `${nodeAddress}.${key}`;
      return <Field key={`${node.id ?? nodeAddress}:${key}`} request={{ data, address, nodeAddress, nodeId: typeof node.id === "string" ? node.id : undefined }} property={property} config={fieldConfig} value={node[key]} disabled={readOnly || config.editable === false || !callbacks.onJsonChange} />;
    })}
  </Fields>;
}