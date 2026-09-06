import styled from "@emotion/styled";
import { useContext, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { PiX } from "react-icons/pi";
import { resolveFormNode } from "../core/forms";
import { FormDocumentContext, NodeForm } from "../nodes/NodeForm";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";
import { resolveStateForm } from "../utils/formState";
import { ToolbarIconButton } from "./toolbarControls";

const FormDialog = styled.dialog`
  &[open] {
    display: flex;
    flex-direction: column;
  }
  &,
  & * {
    scrollbar-width: none;
  }
  &::-webkit-scrollbar,
  & *::-webkit-scrollbar {
    display: none;
  }
`;

const FormContent = styled.div`
  min-height: 0;
  overflow: auto;
  padding: 32px 0;
  mask-image: linear-gradient(
    to bottom,
    transparent,
    black 32px,
    black calc(100% - 32px),
    transparent
  );
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent,
    black 32px,
    black calc(100% - 32px),
    transparent
  );
`;

export function NodeFormPopover({
  nodeAddress,
  active,
  label,
  open = false,
  onClose,
}: {
  nodeAddress: string;
  active: boolean;
  label: string;
  open?: boolean;
  onClose?: () => void;
}) {
  const { background, border, colorText } = useCustomColors();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { data, schema, bindings } = useContext(FormDocumentContext);
  const available = !!(
    data &&
    schema &&
    (bindings
      ? resolveStateForm(bindings, nodeAddress, schema)
      : resolveFormNode(data, nodeAddress, schema))
  );
  useEffect(() => {
    if (!active || !available || !open) {
      dialog.current?.close();
    } else if (!dialog.current?.open) {
      dialog.current?.showModal();
    }
  }, [active, available, open]);
  const surface = getChakraColorHex(background);
  if (!available) return null;
  return (
    <>
      {typeof document !== "undefined" &&
        createPortal(
          <FormDialog
            ref={dialog}
            id={id}
            aria-label={`Configure ${label}`}
            onClose={onClose}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (event.target === event.currentTarget) dialog.current?.close();
            }}
            style={{
              margin: "auto",
              padding: 20,
              width: 380,
              boxSizing: "border-box",
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "calc(100dvh - 32px)",
              overflow: "hidden",
              borderRadius: 30,
              border: `1px solid ${getChakraColorHex(border)}`,
              background: surface,
              color: getChakraColorHex(colorText),
              boxShadow: `0 0 0 8px color-mix(in srgb, ${surface} 60%, transparent)`,
              fontSize: 16,
              textTransform: "none",
            }}
          >
            {open && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexShrink: 0,
                  }}
                >
                  <strong style={{ overflowWrap: "anywhere", minWidth: 0 }}>
                    {label}
                  </strong>
                  <form
                    method="dialog"
                    style={{ margin: 0 }}
                    onSubmit={(event) => event.stopPropagation()}
                  >
                    <ToolbarIconButton
                      type="submit"
                      aria-label="Close node configuration"
                      icon={<PiX size={18} />}
                      size="sm"
                      variant="ghost"
                    />
                  </form>
                </div>
                <FormContent data-form-scroll="">
                  <NodeForm nodeAddress={nodeAddress} />
                </FormContent>
              </>
            )}
          </FormDialog>,
          document.body,
        )}
    </>
  );
}
