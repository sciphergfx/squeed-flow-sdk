import styled from "@emotion/styled";
import { useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { resolveFormNode } from "../core/forms";
import { FormDocumentContext, NodeForm } from "../nodes/NodeForm";
import { getChakraColorHex } from "../theme/colorUtils";
import { getInteractionSurface } from "../theme/interactionShadow";
import { useCustomColors } from "../theme/useCustomColors";
import { resolveStateForm } from "../utils/formState";
import { ToolbarCloseButton } from "./toolbarControls";

const FormDialog = styled.dialog<{ $surface: string; $border: string }>`
  ${(props) => getInteractionSurface(props.$surface, props.$border)}
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
  children,
  filter,
  height,
}: {
  nodeAddress: string;
  active: boolean;
  label: string;
  open?: boolean;
  onClose?: () => void;
  children?: ReactNode;
  filter?: ReactNode;
  height?: number;
}) {
  const { background, border, colorText } = useCustomColors();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { data, schema, bindings } = useContext(FormDocumentContext);
  const available =
    children !== undefined ||
    !!(
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
      dialog.current
        ?.querySelector<HTMLInputElement>("[data-form-filter] input")
        ?.focus();
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
            $surface={surface}
            $border={getChakraColorHex(border)}
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
              height,
              overflow: "hidden",
              borderRadius: 30,
              background: surface,
              color: getChakraColorHex(colorText),
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
                    <ToolbarCloseButton
                      type="submit"
                      aria-label="Close node configuration"
                    />
                  </form>
                </div>
                {filter && (
                  <div data-form-filter="" style={{ flexShrink: 0 }}>
                    {filter}
                  </div>
                )}
                <FormContent
                  data-form-scroll=""
                  style={height ? { flex: 1 } : undefined}
                >
                  {children ?? <NodeForm nodeAddress={nodeAddress} />}
                </FormContent>
              </>
            )}
          </FormDialog>,
          document.body,
        )}
    </>
  );
}
