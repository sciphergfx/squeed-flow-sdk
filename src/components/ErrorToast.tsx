import { chakra } from "@chakra-ui/react";
import { createPortal } from "react-dom";
import { PiWarningCircle } from "react-icons/pi";
import { getChakraColorHex } from "../theme/colorUtils";
import { getInteractionSurface } from "../theme/interactionShadow";
import { useCustomColors } from "../theme/useCustomColors";
import { ToolbarCloseButton } from "./toolbarControls";

export function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const { background, colorText, border } = useCustomColors();
  if (!message || typeof document === "undefined") return null;
  return createPortal(
    <chakra.div
      role="alert"
      aria-atomic="true"
      css={getInteractionSurface(
        getChakraColorHex(background),
        getChakraColorHex(border),
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 10000,
        width: 360,
        maxWidth: "calc(100vw - 40px)",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: 16,
        borderRadius: 8,
        background: getChakraColorHex(background),
        color: getChakraColorHex(colorText),
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <PiWarningCircle
        size={20}
        aria-hidden="true"
        style={{ flexShrink: 0, color: "#ef4444" }}
      />
      <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
        <strong>Interface upload failed</strong>
        <div>{message}</div>
      </div>
      <ToolbarCloseButton
        type="button"
        aria-label="Dismiss upload error"
        title="Dismiss upload error"
        onClick={onDismiss}
        flexShrink={0}
        width="24px"
        height="24px"
        minWidth="24px"
        padding={0}
      />
    </chakra.div>,
    document.body,
  );
}
