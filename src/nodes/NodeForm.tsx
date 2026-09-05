import styled from "@emotion/styled";
import { startCase } from "lodash";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { PiArrowCounterClockwise, PiCaretDown } from "react-icons/pi";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import {
  conditionMatches,
  formOptions,
  formValueError,
  readOnlyFormData,
  resolveFormNode,
  type FormFieldConfig,
  type FormOption,
  type FormRequest,
  type FormSchema,
} from "../core/forms";
import { getNode, type SqueedJson } from "../core/squeedEdits";
import type { ContractProperty } from "../core/workflowContract";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";
import type { FlowDiagramCallbacks } from "../types";
import { resolveStateForm, type StateForms } from "../utils/formState";

export const FormDocumentContext = createContext<{
  setSchema?: (schema: FormSchema | undefined) => void;
  data?: SqueedJson;
  viewData?: SqueedJson;
  bindings?: StateForms["bindings"];
  editable?: boolean;
  schema?: FormSchema;
  callbacks: FlowDiagramCallbacks;
}>({ callbacks: {} });

const Fields = styled.div`
  padding: 0;
  font-size: 14px;
  line-height: 1.4;
  width: 100%;
  box-sizing: border-box;
  & [data-form-field] {
    padding: 8px 0;
    min-width: 0;
  }
  & label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
  }
  & input:not([type="checkbox"]),
  & textarea,
  & select {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    font: inherit;
    color: inherit;
    padding: 8px 12px;
    border: 0;
    border-radius: 16px;
    background: color-mix(in srgb, currentColor 7%, transparent);
    outline: none;
    box-shadow: none;
  }
  & textarea {
    min-height: 96px;
    resize: vertical;
  }
  & [data-form-select] {
    position: relative;
  }
  & [data-form-select] select {
    appearance: none;
    padding-right: 40px;
  }
  & [data-form-select] > svg {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }
  & [data-form-select] select:disabled + svg {
    opacity: 0.55;
  }
  & details {
    border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  }
  & summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    cursor: pointer;
    font-weight: 600;
    list-style: none;
  }
  & summary::-webkit-details-marker {
    display: none;
  }
  & summary > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  & summary > svg {
    flex-shrink: 0;
    transform: rotate(-90deg);
  }
  & details[open] > summary > svg {
    transform: rotate(0deg);
  }
  & input[type="checkbox"] {
    width: 18px;
    height: 18px;
  }
  & button {
    font: inherit;
    cursor: pointer;
  }
  & button:disabled,
  & input:disabled,
  & select:disabled,
  & textarea:disabled {
    cursor: default;
    opacity: 0.55;
  }
  & [role="alert"] {
    color: #dc2626;
    font-size: 12px;
    margin-top: 8px;
  }
`;

function Field({
  request,
  property,
  config,
  value,
  disabled,
}: {
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
  const structured =
    property.type.kind === "object" || property.type.kind === "array";
  const formatted =
    value === undefined
      ? ""
      : structured
        ? JSON.stringify(value, null, 2)
        : String(value);
  const [draft, setDraft] = useState(formatted);
  const [failure, setFailure] = useState("");
  const [retry, setRetry] = useState(0);
  const [remote, setRemote] = useState<{
    key: string;
    options: FormOption[];
    error?: string;
  }>();
  const dynamic = config.$options?.$source === "callback";
  const resolve = callbacks.resolveFormOptions;
  const { data, address, nodeAddress, nodeId } = request;
  const latestData = useRef(data);
  latestData.current = data;
  const optionKey = JSON.stringify([
    address,
    nodeId,
    config.$options?.$dependsOn
      ? config.$options.$dependsOn.map((dependency) =>
          getNode(data, dependency),
        )
      : getNode(data, nodeAddress),
  ]);
  useEffect(() => {
    setDraft(formatted);
    setFailure("");
  }, [formatted, address, nodeId]);
  useEffect(() => {
    if (!dynamic) return;
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        if (!resolve) throw new Error("No options resolver configured");
        return resolve({
          address,
          nodeAddress,
          nodeId,
          data: readOnlyFormData(latestData.current),
          signal: controller.signal,
        });
      })
      .then((options) => {
        if (
          !Array.isArray(options) ||
          options.some(
            (option) =>
              !option ||
              typeof option.label !== "string" ||
              (!["string", "number", "boolean"].includes(typeof option.value) &&
                option.value !== null),
          )
        )
          throw new Error("Invalid options response");
        if (!controller.signal.aborted) setRemote({ key: optionKey, options });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setRemote({
            key: optionKey,
            options: [],
            error:
              error instanceof Error ? error.message : "Options unavailable",
          });
      });
    return () => controller.abort();
  }, [dynamic, resolve, optionKey, address, nodeAddress, nodeId, retry]);
  const loading = dynamic && remote?.key !== optionKey;
  const options = dynamic
    ? remote?.key === optionKey
      ? remote.options
      : []
    : property.type.kind === "boolean"
      ? [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ]
      : formOptions(property.type);
  const multiple = property.type.kind === "array";
  const control =
    (config.$control === "checkbox" ? "pills" : config.$control) ??
    (options
      ? multiple || property.type.kind === "boolean"
        ? "pills"
        : "select"
      : property.type.kind === "boolean"
        ? "checkbox"
        : structured
          ? "textarea"
          : "input");
  const required =
    !property.optional ||
    (!!config.$requiredWhen && conditionMatches(config.$requiredWhen, data));
  const issue =
    failure ||
    (dynamic && remote?.key === optionKey && remote.error) ||
    formValueError(property.type, value, required);
  const label = startCase(config.$label ?? address.split(".").pop()!);
  const commit = (next: unknown) => {
    if (disabled || Object.is(next, value)) return;
    try {
      callbacks.onFormChange?.({
        ...request,
        previousValue: value,
        value: next,
      });
      setFailure("");
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Unable to update field",
      );
    }
  };
  const commitDraft = () => {
    if (structured) {
      try {
        const next =
          draft === "" && property.optional ? undefined : JSON.parse(draft);
        const error = formValueError(property.type, next, required);
        if (error) {
          setFailure(error);
          return;
        }
        commit(next);
      } catch {
        setFailure("Enter valid JSON");
      }
      return;
    }
    const numeric =
      property.type.kind === "number" || property.type.kind === "integer";
    const next =
      draft === "" && property.optional
        ? undefined
        : numeric && draft !== ""
          ? Number(draft)
          : draft;
    const error = formValueError(property.type, next, required);
    if (numeric && error && draft !== "") {
      setFailure(error);
      return;
    }
    commit(next);
  };
  const props = {
    id,
    disabled,
    "aria-label": label,
    "aria-required": required,
    "aria-invalid": !!issue,
    "aria-describedby": issue ? `${id}-error` : undefined,
  };
  const accent = getChakraColorHex(themeColor);
  return (
    <div
      data-form-field={address}
      data-flow-property={address.slice(nodeAddress.length + 1)}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <label htmlFor={id}>
          {label}
          {required ? " *" : ""}
        </label>
        {property.optional && value !== undefined && (
          <button
            type="button"
            aria-label={`Reset ${label}`}
            title={`Reset ${label}`}
            disabled={disabled}
            style={{
              width: 24,
              height: 24,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: 0,
              background: "transparent",
              color: "inherit",
            }}
            onClick={() => commit(undefined)}
          >
            <PiArrowCounterClockwise size={14} />
          </button>
        )}
      </div>
      {control === "select" ? (
        <div data-form-select="">
          <select
            {...props}
            disabled={disabled || loading || !!remote?.error}
            value={
              options?.findIndex((option) => Object.is(option.value, value)) ??
              -1
            }
            onChange={(event) => {
              const option = options?.[Number(event.target.value)];
              if (option) commit(option.value);
            }}
          >
            <option value={-1} disabled>
              {value !== undefined ? String(value) : ""}
            </option>
            {options?.map((option, index) => (
              <option
                key={index}
                value={index}
                style={{ background: getChakraColorHex(background) }}
              >
                {startCase(option.label)}
              </option>
            ))}
          </select>
          <PiCaretDown size={16} aria-hidden="true" />
        </div>
      ) : control === "pills" ? (
        <div
          id={id}
          role="group"
          aria-label={label}
          aria-describedby={props["aria-describedby"]}
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {options?.map((option, index) => {
            const selected = multiple
              ? Array.isArray(value) && value.includes(option.value)
              : Object.is(value, option.value);
            return (
              <button
                key={index}
                type="button"
                disabled={disabled || loading}
                aria-pressed={selected}
                style={{
                  padding: "8px 16px",
                  borderRadius: 24,
                  border: 0,
                  color: selected ? accent : "inherit",
                  background: selected
                    ? "color-mix(in srgb, currentColor 12%, transparent)"
                    : "color-mix(in srgb, currentColor 7%, transparent)",
                }}
                onClick={() =>
                  commit(
                    multiple
                      ? selected
                        ? (value as unknown[]).filter(
                            (item) => item !== option.value,
                          )
                        : [...(Array.isArray(value) ? value : []), option.value]
                      : option.value,
                  )
                }
              >
                {startCase(option.label)}
              </button>
            );
          })}
          {loading && <span role="status">Loading...</span>}
        </div>
      ) : control === "textarea" ? (
        <textarea
          {...props}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
        />
      ) : (
        <input
          {...props}
          type={
            property.type.kind === "number" || property.type.kind === "integer"
              ? "number"
              : "text"
          }
          step={property.type.kind === "integer" ? 1 : "any"}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitDraft();
            if (event.key === "Escape")
              setDraft(value === undefined ? "" : String(value));
          }}
        />
      )}
      {issue && (
        <div role="alert" id={`${id}-error`}>
          {issue}
        </div>
      )}
      {dynamic && remote?.error && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setRemote(undefined);
            setRetry(retry + 1);
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function NodeForm({ nodeAddress }: { nodeAddress: string }) {
  const { data, schema, callbacks, bindings, editable } =
    useContext(FormDocumentContext);
  const { readOnly, config } = useFlowDiagramContext();
  if (!data)
    return <Fields role="alert">Forms require a JSON document.</Fields>;
  const bound = bindings
    ? resolveStateForm(bindings, nodeAddress, schema)
    : undefined;
  const resolved = bindings
    ? bound
    : schema && resolveFormNode(data, nodeAddress, schema);
  if (!resolved) return <Fields role="status">Form schema unavailable.</Fields>;
  const stateAddress = bound?.address ?? nodeAddress;
  const node = getNode(data, stateAddress);
  if (!node || typeof node !== "object")
    return <Fields role="alert">Bound form state is unavailable.</Fields>;
  const entries = Object.entries(resolved.type.properties).filter(([key]) =>
    conditionMatches(resolved.fields[key]?.$visibleWhen, data),
  );
  const sectioned =
    entries.length > 8 ||
    entries.some(([key]) => resolved.fields[key]?.$section);
  const sections = new Map<string, typeof entries>();
  for (const entry of entries) {
    const [key, property] = entry;
    const section = sectioned
      ? startCase(
          resolved.fields[key]?.$section ??
            (property.type.kind === "object" || property.type.kind === "array"
              ? key
              : property.optional
                ? "Options"
                : "General"),
        )
      : "";
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push(entry);
  }
  const renderField = ([key, property]: (typeof entries)[number]) => (
    <Field
      key={`${node.id ?? nodeAddress}:${key}`}
      request={{
        data,
        address: `${stateAddress}.${key}`,
        nodeAddress: stateAddress,
        nodeId: typeof node.id === "string" ? node.id : undefined,
      }}
      property={property}
      config={resolved.fields[key] ?? {}}
      value={node[key]}
      disabled={
        readOnly ||
        config.editable === false ||
        !(editable ?? !!callbacks.onJsonChange)
      }
    />
  );
  return (
    <Fields
      data-flow-form={nodeAddress}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {[...sections].map(([section, fields]) =>
        sectioned && fields.length > 1 ? (
          <details key={section} open>
            <summary>
              <span>{section}</span>
              <PiCaretDown size={16} aria-hidden="true" />
            </summary>
            {fields.map(renderField)}
          </details>
        ) : (
          fields.map(renderField)
        ),
      )}
    </Fields>
  );
}
