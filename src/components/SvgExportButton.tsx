import { useState } from "react";
import { PiDownloadSimpleFill } from "react-icons/pi";
import { downloadSvg } from "../utils/exportSvg";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { ToolbarIconButton, ToolbarTooltip } from "./toolbarControls";

export function SvgExportButton() {
  const { themeColor } = useFlowDiagramContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <>
    <ToolbarTooltip label="Download SVG (current view)">
      <ToolbarIconButton aria-label="Download SVG" icon={<PiDownloadSimpleFill size={20} />} disabled={busy} borderRadius="30%" color={themeColor} variant="ghost"
        onClick={async event => {
          const canvas = event.currentTarget.closest("[data-flow-diagram]")?.querySelector<HTMLElement>("[data-flow-background]");
          if (!canvas) { setError("Diagram not available for export."); return; }
          setBusy(true); setError("");
          try { await downloadSvg(canvas); }
          catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to export SVG."); }
          finally { setBusy(false); }
        }} />
    </ToolbarTooltip>
    {error && <span role="alert" style={{ fontSize: 12, maxWidth: 220 }}>{error}</span>}
  </>;
}