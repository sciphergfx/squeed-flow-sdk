import styled from "@emotion/styled";
import { startCase } from "lodash";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PiArrowLeft,
  PiArrowCounterClockwise,
  PiCaretDown,
  PiCheck,
  PiFile,
  PiPlus,
  PiTrash,
  PiUploadSimple,
} from "react-icons/pi";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { NodeFormPopover } from "../components/NodeFormPopover";
import {
  ToolbarIconButton,
  ToolbarSelect,
} from "../components/toolbarControls";
import {
  conditionMatches,
  formOptions,
  formValueError,
  readOnlyFormData,
  resolveFormNode,
  type FormChange,
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
import DynamicIcon from "../utils/DynamicIcon";
import { resolveStateForm, type StateForms } from "../utils/formState";
import { isIconImage } from "../utils/iconSources";
import {
  projectStructuredForms,
  type StructuredForms,
} from "../utils/structuredForms";
import { RuntimeBindingEditor } from "./RuntimeBindingEditor";
import { StructuredFieldControls } from "./StructuredFieldControls";

export const FormDocumentContext = createContext<{
  setSchema?: (schema: FormSchema | undefined) => void;
  data?: SqueedJson;
  viewData?: SqueedJson;
  bindings?: StateForms["bindings"];
  editable?: boolean;
  schema?: FormSchema;
  renderForm?: StateForms["renderForm"];
  onFieldCreate?: (change: FormChange, config: FormFieldConfig) => void;
  structured?: StructuredForms;
  references?: StateForms["references"];
  callbacks: FlowDiagramCallbacks;
}>({ callbacks: {} });

const Fields = styled.div<{ $colorMode: "light" | "dark" }>`
  --flow-form-input-radius: 16px;
  --flow-form-input-background: color-mix(
    in srgb,
    currentColor 7%,
    transparent
  );
  padding: 0;
  font-size: 16px;
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
    font-size: 15px;
  }
  & input:not([type="checkbox"]),
  & textarea,
  & [data-form-select] > [role="combobox"] {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    font: inherit;
    color: inherit;
    padding: 10px 14px;
    border: 0;
    border-radius: var(--flow-form-input-radius);
    background: var(--flow-form-input-background);
    outline: none;
    box-shadow: none;
  }
  & textarea {
    min-height: 98px;
    resize: vertical;
  }
  & [data-upload-items] {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: start;
  }
  & [data-upload-drop],
  & [data-upload-preview] {
    width: 120px;
    max-width: 100%;
    aspect-ratio: 1;
    box-sizing: border-box;
    border-radius: var(--flow-form-input-radius);
    position: relative;
  }
  & [data-upload-drop] {
    display: grid;
    place-items: center;
    padding: 0;
    border: 2px dashed currentColor;
    background: transparent;
    color: var(--flow-form-input-background);
    cursor: pointer;
  }
  & [data-upload-drop]:focus-visible,
  & [data-upload-preview]:focus-within {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
  & [data-upload-preview] {
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    background: var(--flow-form-input-background);
    overflow: hidden;
  }
  & [data-upload-preview] > a {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    color: inherit;
  }
  & [data-upload-preview] img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  & [data-upload-actions] {
    position: absolute;
    right: 4px;
    bottom: 4px;
    display: flex;
    gap: 4px;
    background: var(--flow-upload-surface);
    border-radius: 4px;
  }
  & [data-form-select] {
    position: relative;
  }
  & [data-form-select] > [role="combobox"] {
    height: auto;
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
    width: 20px;
    height: 20px;
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
  &[role="alert"],
  & [role="alert"] {
    color: ${({ $colorMode }) =>
      `var(--chakra-colors-red-${$colorMode === "dark" ? "300" : "500"})`};
    font-size: 14px;
    margin-top: 8px;
  }
`;

function ToolPicker({
  options,
  onPick,
  disabled,
  label,
  selected,
}: {
  options?: FormOption[];
  onPick: (value: string) => void;
  disabled: boolean;
  label: string;
  selected?: string[];
}) {
  const { colorMode } = useFlowDiagramContext();
  const dark = colorMode === "dark";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const all = (options ?? []).map((option) => String(option.value));
  const filtered = all.filter((value) =>
    value.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Add ${label}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          padding: "8px 12px",
          borderRadius: 20,
          border: "1px dashed",
          borderColor: dark
            ? "var(--chakra-colors-gray-600)"
            : "var(--chakra-colors-gray-300)",
          background: "transparent",
          color: "inherit",
          textAlign: "center",
          cursor: disabled ? "default" : "pointer",
          fontSize: 14,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        + Add tool
      </button>
      <NodeFormPopover
        active
        nodeAddress=""
        label={`Add ${label}`}
        open={open}
        onClose={close}
        onBack={close}
        height={440}
        filter={
          <input
            aria-label={`Search ${label}`}
            placeholder="Search tools..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{
              width: "100%",
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 20,
              border: "1px solid",
              borderColor: dark
                ? "var(--chakra-colors-gray-600)"
                : "var(--chakra-colors-gray-200)",
              background: dark
                ? "var(--chakra-colors-gray-700)"
                : "var(--chakra-colors-gray-100)",
              color: "inherit",
              fontSize: 15,
              boxSizing: "border-box",
            }}
          />
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%" }}>
          {filtered.map((value) => {
            const isSelected = (selected ?? []).includes(value);
            const selectedBackground = "color-mix(in srgb, currentColor 10%, transparent)";
            return (
              <button
                key={value}
                type="button"
                aria-selected={isSelected}
                onClick={() => {
                  onPick(value);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textAlign: "left",
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: 0,
                  background: isSelected ? selectedBackground : "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: isSelected ? 700 : 400,
                }}
                onMouseEnter={(event) => {
                  if (isSelected) return;
                  event.currentTarget.style.background = dark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.05)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = isSelected ? selectedBackground : "transparent";
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{value}</span>
                <PiCheck
                  size={16}
                  aria-hidden="true"
                  style={{ flexShrink: 0, visibility: isSelected ? "visible" : "hidden" }}
                />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <span style={{ opacity: 0.55, fontSize: 13, padding: "8px 14px" }}>
              No tools match “{query}”
            </span>
          )}
        </div>
      </NodeFormPopover>
    </>
  );
}

function InlineEntries({
  value,
  kind,
  itemKind,
  nameOnly,
  options,
  accent = "currentColor",
  disabled,
  label,
  onChange,
}: {
  value: unknown;
  kind: "object" | "array";
  itemKind?: string;
  nameOnly?: boolean;
  options?: FormOption[];
  accent?: string;
  disabled: boolean;
  label: string;
  onChange: (next: unknown) => void;
}) {
  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: 6,
    width: "100%",
    alignItems: "center",
  };
  const removeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    background: "transparent",
    border: 0,
    color: "inherit",
    cursor: disabled ? "default" : "pointer",
    padding: 2,
    flexShrink: 0,
  };
  const parse = (raw: string): any => {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };
  if (kind === "object") {
    const obj =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const nextKey = () => {
      let index = Object.keys(obj).length + 1;
      let key = `entry${index}`;
      while (Object.prototype.hasOwnProperty.call(obj, key)) key = `entry${++index}`;
      return key;
    };
    // Values that are just a redundant `{ name }` (e.g. a tool registry keyed
    // by tool name) are edited as a simple list of names — chips plus an add
    // input that suggests known tools.
    if (nameOnly) {
      const names = Object.keys(obj);
      const addName = (name: string) => {
        if (!name || Object.prototype.hasOwnProperty.call(obj, name)) return;
        onChange({ ...obj, [name]: { name } });
      };
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          {names.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {names.map((name, index) => (
                <span
                  key={`${index}:${name}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 6px 6px 14px",
                    borderRadius: 24,
                    color: accent,
                    background: "color-mix(in srgb, currentColor 12%, transparent)",
                  }}
                >
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${label} ${index + 1}`}
                    disabled={disabled}
                    style={removeStyle}
                    onClick={() => {
                      const next = { ...obj };
                      delete next[name];
                      onChange(next);
                    }}
                  >
                    <PiTrash size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <ToolPicker options={options} onPick={addName} disabled={disabled} label={label} selected={names} />
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        {Object.entries(obj).map(([key, item], index) => (
          <div style={rowStyle} key={`${index}:${key}`}>
            <input
              style={{ flex: 1, minWidth: 0 }}
              aria-label={`${label} key ${index + 1}`}
              placeholder="key"
              value={key}
              disabled={disabled}
              onChange={(event) => {
                const next: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(obj)) next[k === key ? event.target.value : k] = v;
                onChange(next);
              }}
            />
            <input
              style={{ flex: 1, minWidth: 0 }}
              aria-label={`${label} value ${index + 1}`}
              placeholder="value"
              value={typeof item === "string" ? item : JSON.stringify(item)}
              disabled={disabled}
              onChange={(event) => onChange({ ...obj, [key]: parse(event.target.value) })}
            />
            <button
              type="button"
              aria-label={`Remove ${label} ${index + 1}`}
              disabled={disabled}
              style={removeStyle}
              onClick={() => {
                const next = { ...obj };
                delete next[key];
                onChange(next);
              }}
            >
              <PiTrash size={12} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...obj, [nextKey()]: "" })}
        >
          Add entry
        </button>
      </div>
    );
  }
  const arr = Array.isArray(value) ? value : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      {arr.map((item, index) => (
        <div style={{ ...rowStyle, alignItems: "flex-start" }} key={index}>
          <textarea
            style={{ flex: 1, minWidth: 0 }}
            aria-label={`${label} item ${index + 1}`}
            rows={2}
            value={typeof item === "string" ? item : JSON.stringify(item, null, 2)}
            disabled={disabled}
            onChange={(event) => {
              const next = [...arr];
              next[index] = parse(event.target.value);
              onChange(next);
            }}
          />
          <button
            type="button"
            aria-label={`Remove ${label} ${index + 1}`}
            disabled={disabled}
            style={removeStyle}
            onClick={() => onChange(arr.filter((_, position) => position !== index))}
          >
            <PiTrash size={12} aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...arr, itemKind === "string" ? "" : {}])}
      >
        Add item
      </button>
    </div>
  );
}

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
  const {
    callbacks,
    structured: structuredForms,
    references,
  } = useContext(FormDocumentContext);
  const { themeColor } = useFlowDiagramContext();
  const { background } = useCustomColors();
  const id = useId();
  const structured =
    property.type.kind === "object" ||
    property.type.kind === "array" ||
    property.type.kind === "json";
  const formatted =
    value === undefined
      ? ""
      : structured
        ? JSON.stringify(value, null, 2)
        : String(value);
  const [draft, setDraft] = useState(formatted);
  const [failure, setFailure] = useState("");
  const [retry, setRetry] = useState(0);
  const uploadInput = useRef<HTMLInputElement>(null);
  const uploadController = useRef<AbortController>();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [remote, setRemote] = useState<{
    key: string;
    options: FormOption[];
    error?: string;
  }>();
  const dynamic = config.$options?.$source === "callback";
  const resolve = callbacks.resolveFormOptions;
  const { data, address, nodeAddress, nodeId } = request;
  useEffect(() => {
    setUploading(false);
    setDragging(false);
    return () => {
      uploadController.current?.abort();
      uploadController.current = undefined;
    };
  }, [
    address,
    nodeAddress,
    nodeId,
    disabled,
    formatted,
    config.$control,
    config.$upload?.accept,
    config.$upload?.maxSizeBytes,
  ]);
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
    : property.type.kind === "null"
      ? [{ label: "Null", value: null }]
      : property.type.kind === "boolean"
        ? [
            { label: "Yes", value: true },
            { label: "No", value: false },
          ]
        : formOptions(property.type);
  const multiple = property.type.kind === "array";
  const itemKind =
    property.type.kind === "array"
      ? (property.type as { kind: "array"; items: { kind: string } }).items
          ?.kind
      : undefined;
  // Object maps whose values are a bare `{ name }` record (e.g. a tool
  // registry keyed by name) are redundant to edit as key/value — treat them as
  // a simple list of names.
  const recordValue =
    property.type.kind === "object"
      ? (property.type as { kind: "object"; additionalProperties?: { kind: string; properties?: Record<string, { kind: string }> } })
          .additionalProperties
      : undefined;
  const nameOnly =
    (!!recordValue &&
      recordValue.kind === "object" &&
      !!recordValue.properties &&
      Object.keys(recordValue.properties).length === 1 &&
      recordValue.properties.name?.kind === "string") ||
    // Fallback: detect from the current value — every member is a bare
    // `{ name: <key> }` record (e.g. a tool registry keyed by tool name).
    (!!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0 &&
      Object.entries(value as Record<string, unknown>).every(
        ([key, entry]) =>
          !!entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          (entry as Record<string, unknown>).name === key &&
          Object.keys(entry as Record<string, unknown>).length === 1,
      ));
  // Pills need options to pick from. Without options (e.g. no options
  // resolver configured) the group would render empty, so fall back to a
  // manual composer for string arrays and to JSON for anything else.
  const pillsEmpty = (options?.length ?? 0) === 0 && !loading;
  const control =
    (config.$control === "upload"
      ? "upload"
      : structuredForms && structured
        ? "pills"
        : config.$control === "checkbox"
          ? "pills"
          : config.$control) ??
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
  const placeholder = required ? "Required" : "Optional";
  const runtimeBound =
    control !== "upload" &&
    !!references?.length &&
    typeof value === "string" &&
    value.includes("{{");
  const issue =
    failure ||
    (dynamic && remote?.key === optionKey && remote.error) ||
    (!runtimeBound && formValueError(property.type, value, required));
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
  const latestCommit = useRef(commit);
  useLayoutEffect(() => {
    latestCommit.current = commit;
  });
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
  const uploadFiles = async (files: File[]) => {
    if (disabled || uploadController.current || !files.length) return;
    const controller = new AbortController();
    uploadController.current = controller;
    setFailure("");
    setUploading(true);
    try {
      if (
        property.type.kind !== "string" &&
        !(
          property.type.kind === "array" &&
          property.type.items.kind === "string"
        )
      )
        throw new Error("Uploads require a string or string-array field.");
      if (!multiple && files.length !== 1)
        throw new Error("Choose one file for this field.");
      if (!callbacks.uploadFormFile)
        throw new Error("No file upload handler configured.");
      const accept = config.$upload?.accept
        ?.split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
      for (const file of files) {
        if (
          config.$upload?.maxSizeBytes !== undefined &&
          file.size > config.$upload.maxSizeBytes
        )
          throw new Error(`${file.name} exceeds the file size limit.`);
        if (
          accept?.length &&
          !accept.some((entry) =>
            entry.startsWith(".")
              ? file.name.toLowerCase().endsWith(entry)
              : entry.endsWith("/*")
                ? file.type.toLowerCase().startsWith(entry.slice(0, -1))
                : file.type.toLowerCase() === entry,
          )
        )
          throw new Error(`${file.name} is not an accepted file type.`);
      }
      const urls = await Promise.all(
        files.map(async (file) => {
          const result = await callbacks.uploadFormFile!({
            ...request,
            data: readOnlyFormData(data),
            file,
            signal: controller.signal,
          });
          if (typeof result !== "string")
            throw new Error("Upload handler must return an HTTP or HTTPS URL.");
          let url: URL;
          try {
            url = new URL(result);
          } catch {
            throw new Error("Upload handler must return an HTTP or HTTPS URL.");
          }
          if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password
          )
            throw new Error("Upload handler must return an HTTP or HTTPS URL.");
          return result;
        }),
      );
      if (controller.signal.aborted || uploadController.current !== controller)
        return;
      const next = multiple
        ? [...(Array.isArray(value) ? value : []), ...urls]
        : urls[0];
      const error = formValueError(property.type, next, required);
      if (error) throw new Error(error);
      latestCommit.current(next);
    } catch (error) {
      if (!controller.signal.aborted)
        setFailure(
          error instanceof Error ? error.message : "Unable to upload file.",
        );
      controller.abort();
    } finally {
      if (uploadController.current === controller) {
        uploadController.current = undefined;
        setUploading(false);
      }
    }
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
            disabled={disabled || uploading}
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
      {!!references?.length && !structured && control !== "upload" && (
        <RuntimeBindingEditor
          label={label}
          value={value}
          references={references}
          disabled={disabled}
          onChange={commit}
        />
      )}
      {control === "upload" ? (
        <div
          data-form-upload={multiple ? "multiple" : "single"}
          aria-busy={uploading}
          style={
            {
              "--flow-upload-surface": getChakraColorHex(background),
              outline: dragging
                ? "2px dashed var(--flow-form-input-background)"
                : undefined,
              borderRadius: "var(--flow-form-input-radius)",
            } as React.CSSProperties
          }
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!disabled && !uploading) {
              event.dataTransfer.dropEffect = "copy";
              setDragging(true);
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragging(false);
            void uploadFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <input
            ref={uploadInput}
            type="file"
            hidden
            aria-label={`Upload ${label}`}
            accept={config.$upload?.accept}
            multiple={multiple}
            disabled={disabled || uploading}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void uploadFiles(files);
            }}
          />
          <div data-upload-items="">
            {(multiple
              ? Array.isArray(value)
                ? value
                : []
              : value
                ? [value]
                : []
            ).map((url: string, index: number) => (
              <div data-upload-preview="" key={`${index}:${url}`}>
                {typeof url === "string" && isIconImage(url) && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} file ${index + 1}`}
                  >
                    <PiFile size={32} aria-hidden="true" />
                    <DynamicIcon
                      name={url}
                      size={120}
                      onError={(event) => {
                        event.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  </a>
                )}
                <div data-upload-actions="">
                  {!multiple && (
                    <ToolbarIconButton
                      aria-label={`Replace ${label}`}
                      title={`Replace ${label}`}
                      icon={<PiUploadSimple />}
                      size="xs"
                      variant="ghost"
                      disabled={disabled || uploading}
                      onClick={() => uploadInput.current?.click()}
                    />
                  )}
                  <ToolbarIconButton
                    aria-label={`Remove ${label} file ${index + 1}`}
                    title="Remove file"
                    icon={<PiTrash />}
                    size="xs"
                    variant="ghost"
                    disabled={disabled || uploading}
                    onClick={() =>
                      commit(
                        multiple && Array.isArray(value)
                          ? value.filter((_, position) => position !== index)
                          : "",
                      )
                    }
                  />
                </div>
              </div>
            ))}
            {(multiple || !value) && (
              <button
                {...props}
                type="button"
                data-upload-drop=""
                title={`Upload ${label}`}
                disabled={disabled || uploading}
                onClick={() => uploadInput.current?.click()}
              >
                <PiPlus size={28} aria-hidden="true" />
              </button>
            )}
          </div>
          {uploading && <span role="status">Uploading...</span>}
        </div>
      ) : runtimeBound ? null : control === "select" ? (
        <div data-form-select="">
          <ToolbarSelect
            {...props}
            disabled={disabled || loading || !!remote?.error}
            labelCase="preserve"
            value={String(
              options?.findIndex((option) => Object.is(option.value, value)) ??
                -1,
            )}
            onValueChange={(next) => {
              const option = options?.[Number(next)];
              if (option) commit(option.value);
            }}
          >
            <option value={-1} disabled>
              {value !== undefined && value !== ""
                ? String(value)
                : placeholder}
            </option>
            {options?.map((option, index) => (
              <option
                key={index}
                value={index}
                {...(option.description
                  ? { description: option.description }
                  : {})}
              >
                {startCase(option.label) || option.label}
              </option>
            ))}
          </ToolbarSelect>
        </div>
      ) : control === "pills" ? (
        <div
          id={id}
          role="group"
          aria-label={label}
          aria-describedby={props["aria-describedby"]}
          style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
        >
          {property.type.kind === "object" && nameOnly ? (
            <InlineEntries
              value={value}
              kind="object"
              nameOnly
              options={options}
              accent={accent}
              disabled={disabled}
              label={label}
              onChange={commit}
            />
          ) : pillsEmpty ? (
            multiple && itemKind === "string" ? (
              <>
                {(Array.isArray(value) ? value : []).map(
                  (item: unknown, index: number) => (
                    <span
                      key={index}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 8px 8px 16px",
                        borderRadius: 24,
                        border: 0,
                        color: accent,
                        background:
                          "color-mix(in srgb, currentColor 12%, transparent)",
                      }}
                    >
                      {String(item)}
                      <button
                        type="button"
                        aria-label={`Remove ${label} ${index + 1}`}
                        disabled={disabled}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          background: "transparent",
                          border: 0,
                          color: "inherit",
                          cursor: disabled ? "default" : "pointer",
                          padding: 2,
                        }}
                        onClick={() =>
                          commit(
                            (value as unknown[]).filter(
                              (_, position) => position !== index,
                            ),
                          )
                        }
                      >
                        <PiTrash size={12} aria-hidden="true" />
                      </button>
                    </span>
                  ),
                )}
                <input
                  aria-label={`Add ${label}`}
                  placeholder={placeholder}
                  value={newItem}
                  disabled={disabled}
                  onChange={(event) => setNewItem(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    const next = newItem.trim();
                    if (!next) return;
                    const current = Array.isArray(value) ? value : [];
                    if (current.some((item) => String(item) === next)) {
                      setNewItem("");
                      return;
                    }
                    commit([...current, next]);
                    setNewItem("");
                  }}
                />
                <button
                  type="button"
                  disabled={disabled || !newItem.trim()}
                  onClick={() => {
                    const next = newItem.trim();
                    if (!next) return;
                    const current = Array.isArray(value) ? value : [];
                    if (!current.some((item) => String(item) === next))
                      commit([...current, next]);
                    setNewItem("");
                  }}
                >
                  Add
                </button>
              </>
            ) : multiple ? (
              <InlineEntries
                value={value}
                kind="array"
                itemKind={itemKind}
                disabled={disabled}
                label={label}
                onChange={commit}
              />
            ) : property.type.kind === "object" ? (
              <InlineEntries
                value={value}
                kind="object"
                nameOnly={nameOnly}
                disabled={disabled}
                label={label}
                onChange={commit}
              />
            ) : (
              <textarea
                {...props}
                placeholder={placeholder}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
              />
            )
          ) : (
            <>
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
                    {startCase(option.label) || option.label}
                  </button>
                );
              })}
              {loading && <span role="status">Loading...</span>}
            </>
          )}
        </div>
      ) : control === "textarea" ? (
        <textarea
          {...props}
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
        />
      ) : (
        <input
          {...props}
          placeholder={placeholder}
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

export function NodeForm({
  nodeAddress,
  structured = false,
}: {
  nodeAddress: string;
  structured?: boolean;
}) {
  return structured ? (
    <StructuredNodeForm key={nodeAddress} nodeAddress={nodeAddress} />
  ) : (
    <NodeFormFields nodeAddress={nodeAddress} />
  );
}

function StructuredNodeForm({ nodeAddress }: { nodeAddress: string }) {
  const context = useContext(FormDocumentContext);
  const [path, setPath] = useState<string[]>([]);
  const sourceSchema = context.structured?.sourceSchema ?? context.schema;
  const sourceBindings = context.structured?.sourceBindings ?? context.bindings;
  const projection = useMemo(() => {
    if (!context.data || !sourceSchema || !sourceBindings) return;
    return projectStructuredForms(context.data, sourceBindings, sourceSchema, [
      { data: { id: nodeAddress, type: "objectView" } },
    ]);
  }, [context.data, sourceBindings, sourceSchema, nodeAddress]);
  if (!projection) return <NodeFormFields nodeAddress={nodeAddress} />;
  const invalid = path.findIndex(
    (address) => !projection.containers.has(address),
  );
  const currentPath = invalid < 0 ? path : (path.slice(0, invalid) as any);
  const current = currentPath?.at(-1) ?? nodeAddress;
  const label = [...projection.slots.values()].find(
    (slot) => slot.nodeId === current,
  )?.label;
  return (
    <FormDocumentContext.Provider
      value={{
        ...context,
        structured: projection,
        schema: projection.schema,
        bindings: projection.bindings,
        renderForm: undefined,
        onFieldCreate:
          current === nodeAddress ? context.onFieldCreate : undefined,
      }}
    >
      {!!currentPath.length && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <ToolbarIconButton
            aria-label="Back to parent fields"
            title="Back to parent fields"
            icon={<PiArrowLeft size={18} />}
            size="sm"
            variant="ghost"
            onClick={() => setPath(currentPath.slice(0, -1))}
          />
          <strong style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            {startCase(label)}
          </strong>
        </div>
      )}
      <NodeFormFields
        key={current}
        nodeAddress={current}
        onOpen={(address) => setPath([...currentPath, address])}
      />
    </FormDocumentContext.Provider>
  );
}

function NodeFormFields({
  nodeAddress,
  onOpen,
}: {
  nodeAddress: string;
  onOpen?: (nodeAddress: string) => void;
}) {
  const {
    data,
    schema,
    callbacks,
    bindings,
    editable,
    renderForm,
    structured,
  } = useContext(FormDocumentContext);
  const { readOnly, config, colorMode } = useFlowDiagramContext();
  const rendered = renderForm?.(nodeAddress);
  if (rendered !== undefined)
    return (
      <fieldset
        data-flow-form={nodeAddress}
        disabled={readOnly || config.editable === false || !editable}
        style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
      >
        {rendered}
      </fieldset>
    );
  if (!data)
    return (
      <Fields $colorMode={colorMode} role="alert">
        Forms require a JSON document.
      </Fields>
    );
  const bound = bindings
    ? resolveStateForm(bindings, nodeAddress, schema)
    : undefined;
  const resolved = bindings
    ? bound
    : schema && resolveFormNode(data, nodeAddress, schema);
  if (!resolved)
    return (
      <Fields $colorMode={colorMode} role="status">
        Form schema unavailable.
      </Fields>
    );
  const stateAddress = bound?.address ?? nodeAddress;
  const node = getNode(data, stateAddress);
  const scalar = structured?.containers.get(nodeAddress)?.scalar;
  if (node === undefined || (typeof node !== "object" && !scalar))
    return (
      <Fields $colorMode={colorMode} role="alert">
        Bound form state is unavailable.
      </Fields>
    );
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
      key={`${node?.id ?? nodeAddress}:${key}`}
      request={{
        data,
        address: scalar ? stateAddress : `${stateAddress}.${key}`,
        nodeAddress: stateAddress,
        nodeId: typeof node?.id === "string" ? node.id : undefined,
      }}
      property={property}
      config={resolved.fields[key] ?? {}}
      value={scalar ? node : node?.[key]}
      disabled={
        readOnly ||
        config.editable === false ||
        !(editable ?? !!callbacks.onJsonChange)
      }
    />
  );
  return (
    <Fields
      $colorMode={colorMode}
      data-flow-form={nodeAddress}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {structured && (
        <StructuredFieldControls nodeAddress={nodeAddress} onOpen={onOpen} />
      )}
      {!structured &&
        bound &&
        resolved.type.additionalProperties &&
        entries.length === 0 && (
          <Field
            request={{ data, address: stateAddress, nodeAddress: stateAddress }}
            property={{ type: resolved.type, optional: false }}
            config={{ $label: "Configuration", $control: "textarea" }}
            value={node}
            disabled={readOnly || config.editable === false || !editable}
          />
        )}
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
