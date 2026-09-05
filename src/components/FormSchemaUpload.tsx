import { useContext, useEffect, useRef, useState } from "react";
import { PiFileTs } from "react-icons/pi";
import { FormDocumentContext } from "../nodes/NodeForm";
import { readFormSchema } from "../core/forms";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { ToolbarIconButton, ToolbarTooltip } from "./toolbarControls";

export function FormSchemaUpload() {
  const { data, setSchema } = useContext(FormDocumentContext);
  const { readOnly } = useFlowDiagramContext();
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { generation.current++; setBusy(false); return () => { generation.current++; }; }, [data, readOnly]);
  const names = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const object = value as Record<string, any>;
    if (typeof object.$form?.$type === "string") names.add(object.$form.$type);
    for (const [key, child] of Object.entries(object)) if (!key.startsWith("$") || key === "$") visit(child);
  };
  visit(data);
  if (!names.size) return null;
  return <>
    <ToolbarTooltip label="Upload form schema">
      <ToolbarIconButton aria-label="Upload form schema" icon={<PiFileTs size={20} />} disabled={readOnly || busy} onClick={() => input.current?.click()} />
    </ToolbarTooltip>
    <input ref={input} hidden type="file" accept=".ts,.json" aria-label="Form schema file" disabled={readOnly || busy}
      onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        const request = ++generation.current;
        setBusy(true); setFailed(false); setStatus("Loading form schema...");
        try {
          const schema = await readFormSchema(file, [...names]);
          if (request !== generation.current) return;
          for (const name of names) if (!Object.prototype.hasOwnProperty.call(schema, name)) throw new Error(`Missing form type: ${name}`);
          setSchema?.(schema); setStatus(`${file.name}: ${Object.keys(schema).length} form types loaded`);
        } catch (error) {
          if (request === generation.current) { setFailed(true); setStatus(error instanceof Error ? error.message : "Unable to load forms"); }
        } finally { if (request === generation.current) setBusy(false); }
      }} />
    {status && <span role={failed ? "alert" : "status"} style={{ fontSize: 12, maxWidth: 240, whiteSpace: "normal" }}>{status}</span>}
  </>;
}