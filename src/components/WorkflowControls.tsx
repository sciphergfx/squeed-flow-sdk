import { useContext, useEffect, useRef, useState } from "react";
import { PiUploadSimple, PiX, PiTreeStructure, PiTable } from "react-icons/pi";
import {
  connectionIssue,
} from "../core/workflowContract";
import { readWorkflowInterface } from "../core/workflowInterface";
import { readFormSchema } from "../core/forms";
import { FormDocumentContext } from "../nodes/NodeForm";
import { ErrorToast } from "./ErrorToast";
import { useCustomColors } from "../theme/useCustomColors";
import { getChakraColorHex } from "../theme/colorUtils";
import { useFlowData, useFlowDiagramContext } from "./FlowDiagramContext";
import {
  ToolbarIconButton,
  ToolbarSelect,
  ToolbarTooltip,
  ToolbarDivider,
} from "./toolbarControls";

export function WorkflowControls() {
  const {
    edgeMode,
    setEdgeMode,
    workflowContract,
    setWorkflowContract,
    callbacks,
    readOnly,
  } = useFlowDiagramContext();
  const { edgeById } = useFlowData();
  const { data, schema, setSchema, bindings } = useContext(FormDocumentContext);
  const { colorText } = useCustomColors();
  const input = useRef<HTMLInputElement>(null);
  const version = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  useEffect(() => {
    version.current++;
    setBusy(false);
  }, [readOnly, data, bindings]);
  const invalid = workflowContract
    ? [...edgeById.values()].filter((edge) =>
        connectionIssue(workflowContract, edge.data),
      ).length
    : 0;
  const status =
    (workflowContract
      ? `${workflowContract.name}: ${schema ? `${Object.keys(schema).length} form types loaded; ` : ""}${invalid} invalid or unverified connections`
      : "");
  return (
    <>
      <ErrorToast message={error} onDismiss={() => setError("")} />
      <ToolbarDivider />
      <ToolbarSelect
        aria-label="Edge mode"
        title={
          edgeMode === "properties"
            ? "Connections: Properties"
            : "Connections: Nodes"
        }
        icon={
          edgeMode === "properties" ? (
            <PiTable size={20} />
          ) : (
            <PiTreeStructure size={20} />
          )
        }
        style={{ width: 36 }}
        value={edgeMode}
        disabled={readOnly}
        onValueChange={(value) => {
          const mode = value === "properties" ? "properties" : "nodes";
          setEdgeMode(mode);
          callbacks.onEdgeModeChange?.(mode);
        }}
      >
        <option value="nodes">Nodes</option>
        <option value="properties">Properties</option>
      </ToolbarSelect>
      {(
        <>
          <ToolbarTooltip
            label={
              workflowContract
                ? `Replace ${workflowContract.name}`
                : "Upload workflow interface"
            }
          >
            <ToolbarIconButton
              aria-label="Upload workflow interface"
              icon={<PiUploadSimple size={20} />}
              size="sm"
              variant="ghost"
              disabled={busy || readOnly}
              onClick={() => input.current?.click()}
            />
          </ToolbarTooltip>
          <input
            ref={input}
            type="file"
            hidden
            accept=".ts,.json"
            aria-label="Workflow interface file"
            disabled={readOnly || busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const request = ++version.current;
              setBusy(true);
              setError("");
              try {
                const loaded = bindings
                  ? await readFormSchema(file, [...new Set(Object.values(bindings).map(binding => binding.type))])
                  : undefined;
                if (bindings && loaded) {
                  for (const binding of Object.values(bindings))
                    if (!Object.prototype.hasOwnProperty.call(loaded, binding.type)) throw new Error(`Missing form type: ${binding.type}`);
                }
                const { contract, schema: nextSchema } = bindings && loaded
                  ? { schema: loaded, contract: { name: file.name, nodes: Object.fromEntries(Object.entries(bindings).map(([address, binding]) => [address, { type: loaded[binding.type], optional: false }])) } }
                  : await readWorkflowInterface(file, data);
                if (request !== version.current) return;
                setSchema?.(nextSchema);
                setWorkflowContract(contract);
                callbacks.onWorkflowContractChange?.(contract);
              } catch (failure) {
                if (request === version.current)
                  setError(
                    `${file.name}: ${failure instanceof Error
                      ? failure.message
                      : "Unable to load interface."}`,
                  );
              } finally {
                if (request === version.current) setBusy(false);
              }
            }}
          />
          {(status || busy) && (
            <span
              role="status"
              title={status}
              style={{
                color: getChakraColorHex(colorText),
                fontSize: 12,
                maxWidth: 180,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {busy ? "Loading interface..." : status}
            </span>
          )}
          {workflowContract && (
            <ToolbarTooltip label="Remove workflow interface">
              <ToolbarIconButton
                aria-label="Remove workflow interface"
                icon={<PiX size={16} />}
                size="sm"
                variant="ghost"
                disabled={readOnly || busy}
                onClick={() => {
                  setSchema?.(undefined);
                  setWorkflowContract(undefined);
                  callbacks.onWorkflowContractChange?.(undefined);
                  setError("");
                }}
              />
            </ToolbarTooltip>
          )}
        </>
      )}
    </>
  );
}
