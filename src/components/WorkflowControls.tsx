import { useEffect, useRef, useState } from "react";
import { PiUploadSimple, PiX, PiTreeStructure, PiTable } from "react-icons/pi";
import {
  connectionIssue,
  readWorkflowContract,
} from "../core/workflowContract";
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
  }, [readOnly, edgeMode]);
  const invalid = workflowContract
    ? [...edgeById.values()].filter((edge) =>
        connectionIssue(workflowContract, edge.data),
      ).length
    : 0;
  const status =
    error ||
    (workflowContract
      ? `${workflowContract.name}: ${invalid} invalid or unverified connections`
      : "");
  return (
    <>
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
      {edgeMode === "properties" && (
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
                const contract = await readWorkflowContract(file);
                if (request !== version.current) return;
                setWorkflowContract(contract);
                callbacks.onWorkflowContractChange?.(contract);
              } catch (failure) {
                if (request === version.current)
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Unable to load interface.",
                  );
              } finally {
                if (request === version.current) setBusy(false);
              }
            }}
          />
          {(status || busy) && (
            <span
              role={error ? "alert" : "status"}
              title={status}
              style={{
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
