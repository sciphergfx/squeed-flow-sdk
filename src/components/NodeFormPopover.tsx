import styled from "@emotion/styled";
import { useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { resolveFormNode } from "../core/forms";
import { FormDocumentContext, NodeForm } from "../nodes/NodeForm";
import { getChakraColorHex } from "../theme/colorUtils";
import { getInteractionSurface } from "../theme/interactionShadow";
import { useCustomColors } from "../theme/useCustomColors";
import { resolveStateForm } from "../utils/formState";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import { ToolbarCloseButton, ToolbarIconButton } from "./toolbarControls";
import { PiArrowLeft } from "react-icons/pi";

const FormDialog = styled.dialog<{ $surface: string; $border: string }>`
  ${(props) => getInteractionSurface(props.$surface, props.$border)}
  &,
  &:hover {
    box-shadow: none !important;
    animation: none !important;
    border-color: transparent;
  }
  @media (hover: hover) {
    &:has(:hover) {
      border-color: ${(props) => props.$border};
    }
  }
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

const FormContent = styled.div<{ $divider: string }>`
  min-height: 0;
  container-type: inline-size;
  @container (min-width: 520px) {
    & [data-flow-form] {
      position: relative;
    }
    & [data-flow-form]::after {
      content: "";
      position: absolute;
      inset: 0 auto 0 50%;
      width: 1px;
      background: ${(props) => props.$divider};
      pointer-events: none;
    }
    & [data-flow-form],
    & [data-flow-form] > details {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 16px;
    }
    & [data-flow-form] > :not([data-form-field]),
    & [data-flow-form] > details > summary {
      grid-column: 1 / -1;
    }
    & [data-flow-form] > details:not([open]) > :not(summary) {
      display: none;
    }
  }
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
  onBack,
  children,
  filter,
  height,
  width,
}: {
  nodeAddress: string;
  active: boolean;
  label: string;
  open?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  children?: ReactNode;
  filter?: ReactNode;
  height?: number;
  width?: number;
}) {
  const { background, border, colorText } = useCustomColors();
  const { colorMode } = useFlowDiagramContext();
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
            onClose={(event: React.SyntheticEvent<HTMLDialogElement>) => {
              // Nested popovers portal into the React tree, so a child dialog's
              // close event would otherwise bubble to this form's onClose and
              // close the form too. Stop it here.
              event.stopPropagation();
              onClose?.();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              if (event.target === event.currentTarget) dialog.current?.close();
            }}
            style={{
              position: "fixed",
              inset: "94px 20px auto auto",
              margin: 0,
              padding: 20,
              width: width ?? "var(--top-toolbar-width, 360px)",
              boxSizing: "border-box",
              maxWidth: "calc(100vw - 40px)",
              maxHeight: "calc(100dvh - 114px)",
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    {onBack && (
                      <ToolbarIconButton
                        aria-label="Back"
                        title="Back"
                        icon={<PiArrowLeft size={18} />}
                        size="sm"
                        variant="ghost"
                        onClick={onBack}
                      />
                    )}
                    <strong style={{ overflowWrap: "anywhere", minWidth: 0 }}>
                      {label}
                    </strong>
                  </div>
                  <ToolbarCloseButton
                    aria-label="Close node configuration"
                    onClick={() => dialog.current?.close()}
                  />
                </div>
                {filter && (
                  <div data-form-filter="" style={{ flexShrink: 0 }}>
                    {filter}
                  </div>
                )}
                <FormContent
                  $divider={`var(--chakra-colors-gray-${colorMode === "dark" ? "700" : "200"})`}
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
