import { useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "@emotion/styled";
import { PiGearFill, PiX } from "react-icons/pi";
import { FormDocumentContext, NodeForm } from "../nodes/NodeForm";
import { resolveFormNode } from "../core/forms";
import { resolveStateForm } from "../utils/formState";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";
import { ToolbarIconButton, ToolbarTooltip } from "./toolbarControls";

const FormDialog = styled.dialog`
  &, & * { scrollbar-width: none; }
  &::-webkit-scrollbar, & *::-webkit-scrollbar { display: none; }
`;

export function NodeFormPopover({ nodeAddress, active, label }: {
  nodeAddress: string;
  active: boolean;
  label: string;
}) {
  const { background, border, colorText } = useCustomColors();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const { data, schema, bindings } = useContext(FormDocumentContext);
  const available = !!(data && schema && (bindings ? resolveStateForm(bindings, nodeAddress, schema) : resolveFormNode(data, nodeAddress, schema)));
  useEffect(() => {
    if (!active || !available) {
      dialog.current?.close();
      setOpen(false);
    }
  }, [active, available]);
  const surface = getChakraColorHex(background);
  if (!available) return null;
  return <>
    <ToolbarTooltip label="Configure node">
      <ToolbarIconButton ref={trigger} aria-label={`Configure ${label}`} aria-haspopup="dialog"
        aria-expanded={open} aria-controls={id} icon={<PiGearFill size={64} />}
        variant="ghost" w="80px" h="80px" minW="80px" color="inherit"
        style={{ visibility: active ? "visible" : "hidden", flexShrink: 0, marginLeft: "auto" }}
        onClick={event => { event.stopPropagation(); setOpen(true); dialog.current?.showModal(); }} />
    </ToolbarTooltip>
    {typeof document !== "undefined" && createPortal(
      <FormDialog ref={dialog} id={id} aria-label={`Configure ${label}`}
        onClose={() => { setOpen(false); if (active) trigger.current?.focus({ preventScroll: true }); }}
        onPointerDown={event => event.stopPropagation()}
        onWheel={event => event.stopPropagation()}
        onKeyDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) dialog.current?.close(); }}
        style={{ margin: "auto", padding: 20, width: 380, boxSizing: "border-box", maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100dvh - 32px)", overflowY: "auto", borderRadius: 30, border: `1px solid ${getChakraColorHex(border)}`, background: surface, color: getChakraColorHex(colorText), boxShadow: `0 0 0 8px color-mix(in srgb, ${surface} 60%, transparent)`, fontSize: 14, textTransform: "none" }}>
        {open && <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <strong style={{ overflowWrap: "anywhere", minWidth: 0 }}>{label}</strong>
            <form method="dialog" style={{ margin: 0 }} onSubmit={event => event.stopPropagation()}>
              <ToolbarIconButton type="submit" aria-label="Close node configuration" icon={<PiX size={18} />} size="sm" variant="ghost" />
            </form>
          </div>
          <NodeForm nodeAddress={nodeAddress} />
        </>}
      </FormDialog>, document.body,
    )}
  </>;
}