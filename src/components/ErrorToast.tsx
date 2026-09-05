import { createPortal } from "react-dom";
import { PiWarningCircle, PiX } from "react-icons/pi";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";

export function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const { background, colorText, border } = useCustomColors();
  if (!message || typeof document === "undefined") return null;
  return createPortal(
    <div role="alert" aria-atomic="true"
      onPointerDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
      style={{ position: "fixed", top: 20, right: 20, zIndex: 10000, width: 360, maxWidth: "calc(100vw - 40px)", boxSizing: "border-box", display: "flex", alignItems: "flex-start", gap: 10, padding: 16, borderRadius: 8, border: `1px solid ${getChakraColorHex(border)}`, background: getChakraColorHex(background), color: getChakraColorHex(colorText), boxShadow: "0 4px 20px #0003", fontSize: 14, lineHeight: 1.5 }}>
      <PiWarningCircle size={20} aria-hidden="true" style={{ flexShrink: 0, color: "#ef4444" }} />
      <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
        <strong>Interface upload failed</strong>
        <div>{message}</div>
      </div>
      <button type="button" aria-label="Dismiss upload error" title="Dismiss upload error" onClick={onDismiss}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: 24, height: 24, padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer" }}>
        <PiX size={16} aria-hidden="true" />
      </button>
    </div>, document.body,
  );
}