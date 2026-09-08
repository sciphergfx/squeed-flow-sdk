import { startCase } from "lodash";
import { useContext, useState } from "react";
import {
  PiArrowDown,
  PiArrowUp,
  PiBracketsCurly,
  PiCaretDown,
  PiListNumbers,
  PiMagnifyingGlass,
  PiPlus,
  PiTrash,
} from "react-icons/pi";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { ToolbarIconButton } from "../components/toolbarControls";
import { getNode } from "../core/squeedEdits";
import type { ContractType } from "../core/workflowContract";
import {
  emptyValue,
  structuredTypeOptions,
  valueType,
} from "../utils/structuredForms";
import { FormDocumentContext } from "./NodeForm";

export function StructuredFieldControls({
  nodeAddress,
}: {
  nodeAddress: string;
}) {
  const { structured, data, callbacks, editable } =
    useContext(FormDocumentContext);
  const diagram = useFlowDiagramContext();
  const [key, setKey] = useState("");
  const [kind, setKind] = useState("0");
  const [error, setError] = useState("");
  const descriptor = structured?.containers.get(nodeAddress);
  if (!descriptor || !data || !structured) return null;
  const disabled =
    diagram.readOnly || diagram.config.editable === false || !editable;
  const value = getNode(data, descriptor.address);
  const typeOptions = structuredTypeOptions(descriptor.declared);
  const entryType =
    descriptor.type.kind === "array"
      ? descriptor.type.items
      : descriptor.type.kind === "object"
        ? descriptor.type.additionalProperties
        : undefined;
  const entryOptions = entryType ? structuredTypeOptions(entryType) : [];
  const typeLabel = (type: ContractType) =>
    type.kind === "literal"
      ? String(type.value)
      : type.kind === "string"
        ? "Text"
        : startCase(type.kind);
  const slots = [...structured.slots.values()].filter(
    (slot) => slot.owner === nodeAddress,
  );
  const change = (address: string, next: unknown) =>
    callbacks.onFormChange?.({
      data,
      nodeAddress: descriptor.address,
      address,
      previousValue: getNode(data, address),
      value: next,
    });
  const focus = (id: string) => {
    diagram.setSelectedNodeIds([id]);
    diagram.engineRef.current?.focusNode(id, 90, false);
  };
  const move = (index: number, offset: number) => {
    if (!Array.isArray(value)) return;
    const next = [...value];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    change(descriptor.address, next);
  };
  const add = () => {
    const type = entryOptions[Number(kind)] ?? entryOptions[0];
    if (!type) return;
    if (descriptor.type.kind === "array") {
      change(descriptor.address, [
        ...(Array.isArray(value) ? value : []),
        emptyValue(type),
      ]);
    } else {
      if (
        !key ||
        key.includes(".") ||
        key.startsWith("$") ||
        ["__proto__", "constructor", "prototype"].includes(key)
      ) {
        setError("Choose a property name without dots or reserved prefixes.");
        return;
      }
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        setError("Property already exists.");
        return;
      }
      change(`${descriptor.address}.${key}`, emptyValue(type));
      setKey("");
      setError("");
    }
  };
  const dictionary =
    descriptor.type.kind === "object" && !!descriptor.type.additionalProperties;
  const array = descriptor.type.kind === "array";
  return (
    <div
      data-structured-controls=""
      style={{ display: "grid", gap: 8, minWidth: 0 }}
    >
      {typeOptions.length > 1 && (
        <label>
          Value type
          <span data-form-select="" style={{ display: "block" }}>
            <select
              aria-label="Value type"
              disabled={disabled}
              value={typeOptions.findIndex(
                (type) => valueType(type, value).kind === descriptor.type.kind,
              )}
              onChange={(event) =>
                change(
                  descriptor.address,
                  emptyValue(typeOptions[Number(event.target.value)]),
                )
              }
            >
              {typeOptions.map((type, index) => (
                <option key={index} value={index}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>
            <PiCaretDown size={16} aria-hidden="true" />
          </span>
        </label>
      )}
      {slots.map((slot, index) => (
        <div
          key={slot.address}
          data-structured-slot={slot.address}
          style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}
        >
          {slot.type.kind === "array" ? (
            <PiListNumbers size={20} />
          ) : (
            <PiBracketsCurly size={20} />
          )}
          <span style={{ flex: 1, overflowWrap: "anywhere" }}>
            {startCase(slot.label)}
          </span>
          <ToolbarIconButton
            aria-label={`${slot.present ? "Focus" : "Create"} ${startCase(slot.label)}`}
            title={`${slot.present ? "Focus" : "Create"} ${startCase(slot.label)}`}
            icon={
              slot.present ? (
                <PiMagnifyingGlass size={18} />
              ) : (
                <PiPlus size={18} />
              )
            }
            size="sm"
            variant="ghost"
            disabled={disabled && !slot.present}
            onClick={(event) => {
              if (slot.present) {
                event.currentTarget.closest("dialog")?.close();
                focus(slot.nodeId);
              } else change(slot.address, emptyValue(slot.type));
            }}
          />
          {array && (
            <>
              <ToolbarIconButton
                aria-label={`Move item ${index + 1} up`}
                icon={<PiArrowUp size={18} />}
                size="sm"
                variant="ghost"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              />
              <ToolbarIconButton
                aria-label={`Move item ${index + 1} down`}
                icon={<PiArrowDown size={18} />}
                size="sm"
                variant="ghost"
                disabled={disabled || index === slots.length - 1}
                onClick={() => move(index, 1)}
              />
            </>
          )}
          {slot.present && (
            <ToolbarIconButton
              aria-label={`Remove ${startCase(slot.label)}`}
              icon={<PiTrash size={18} />}
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() =>
                array
                  ? change(
                      descriptor.address,
                      value.filter(
                        (_: unknown, item: number) => item !== index,
                      ),
                    )
                  : change(slot.address, undefined)
              }
            />
          )}
        </div>
      ))}
      {(array || dictionary) && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "end",
          }}
        >
          {dictionary && (
            <label style={{ flex: "1 1 120px", minWidth: 0, display: "grid", gap: 8 }}>
              Property name
              <input
                aria-label="Property name"
                placeholder="Required"
                value={key}
                disabled={disabled}
                onChange={(event) => setKey(event.target.value)}
              />
            </label>
          )}
          {entryOptions.length > 1 && (
            <label style={{ flex: "1 1 100px", minWidth: 0, display: "grid", gap: 8 }}>
              New value type
              <span data-form-select="" style={{ display: "block" }}>
                <select
                  aria-label="New value type"
                  value={kind}
                  disabled={disabled}
                  onChange={(event) => setKind(event.target.value)}
                >
                  {entryOptions.map((type, index) => (
                    <option key={index} value={index}>
                      {typeLabel(type)}
                    </option>
                  ))}
                </select>
                <PiCaretDown size={16} aria-hidden="true" />
              </span>
            </label>
          )}
          <span
            style={{
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
              ...(dictionary || entryOptions.length > 1
                ? {
                    height: "calc(1.4em + 20px)",
                    fontSize: 15,
                    marginBottom: 6,
                  }
                : {}),
            }}
          >
            <ToolbarIconButton
              aria-label={array ? "Add item" : "Add property"}
              icon={<PiPlus size={20} />}
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={add}
            />
          </span>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
