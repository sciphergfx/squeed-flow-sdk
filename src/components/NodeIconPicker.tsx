import { useEffect, useRef, useState } from "react";
import { PiImage, PiUploadSimple, PiX, PiTrash } from "react-icons/pi";
import DynamicIcon from "../utils/DynamicIcon";
import {
  isIconImage,
  SVG_DATA_PREFIX,
  svgIconDataUrl,
} from "../utils/iconSources";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import {
  ToolbarIconButton,
  ToolbarSelect,
  ToolbarTooltip,
} from "./toolbarControls";

export function NodeIconPicker({
  nodeId,
  edgeId,
  value,
}: {
  nodeId?: string;
  edgeId?: string;
  value?: string;
}) {
  const { callbacks, readOnly, themeColor } = useFlowDiagramContext();
  const { background, backgroundSecondary, border, colorText } =
    useCustomColors();
  const dialog = useRef<HTMLDialogElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const uploadVersion = useRef(0);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("icons");
  const [icons, setIcons] = useState<string[]>([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [search, setSearch] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      uploadVersion.current++;
    },
    [],
  );
  useEffect(() => {
    if (!open) return;
    let active = true;
    import("react-icons/pi")
      .then((module) => {
        if (!active) return;
        setIcons(
          Object.keys(module)
            .filter((name) => name.startsWith("Pi"))
            .sort(),
        );
        setCatalogState("ready");
      })
      .catch(() => {
        if (active) setCatalogState("unavailable");
      });
    return () => {
      active = false;
    };
  }, [open]);
  useEffect(() => {
    if (readOnly) dialog.current?.close();
  }, [readOnly]);
  const pick = (icon: string) => {
    if (readOnly) return;
    if (edgeId) callbacks.onEdgeIconChange?.(edgeId, icon);
    else if (nodeId) callbacks.onNodeIconChange?.(nodeId, icon);
    dialog.current?.close();
  };
  const filtered = icons
    .filter((name) =>
      name
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    )
    .slice(0, 40);
  const inputStyle = {
    width: "100%",
    padding: "8px",
    background: "transparent",
    color: "inherit",
    border: `1px solid ${getChakraColorHex(border)}`,
    borderRadius: 4,
  };
  return (
    <>
      <ToolbarTooltip label={edgeId ? "Choose edge icon" : "Choose node icon"}>
        <ToolbarIconButton
          aria-label={edgeId ? "Choose edge icon" : "Choose node icon"}
          icon={<PiImage size={20} />}
          size="sm"
          variant="ghost"
          disabled={readOnly}
          onClick={() => {
            setError("");
            setMode(value && isIconImage(value) ? "custom" : "icons");
            setUrl(
              value && !value.startsWith(SVG_DATA_PREFIX) && isIconImage(value)
                ? value
                : "",
            );
            setOpen(true);
            dialog.current?.showModal();
          }}
        />
      </ToolbarTooltip>
      <dialog
        ref={dialog}
        aria-label={edgeId ? "Choose edge icon" : "Choose node icon"}
        onClose={() => {
          setOpen(false);
          uploadVersion.current++;
          setBusy(false);
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        onKeyDown={(event) => event.stopPropagation()}
        style={{
          margin: "auto",
          padding: 16,
          width: 360,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          border: `1px solid ${getChakraColorHex(border)}`,
          borderRadius: 8,
          background: getChakraColorHex(background),
          color: getChakraColorHex(colorText),
        }}
      >
        {open && (
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <strong>{edgeId ? "Edge icon" : "Node icon"}</strong>
              <ToolbarIconButton
                aria-label="Close icon picker"
                icon={<PiX size={20} />}
                size="sm"
                variant="ghost"
                onClick={() => dialog.current?.close()}
              />
            </div>
            <ToolbarSelect
              aria-label="Icon source"
              value={mode}
              onValueChange={(value) => {
                setMode(value);
                setError("");
                if (value === "custom") upload.current?.click();
              }}
            >
              {catalogState !== "unavailable" && (
                <option value="icons">React icons</option>
              )}
              <option value="custom">Custom SVG</option>
            </ToolbarSelect>
            <input
              ref={upload}
              type="file"
              accept=".svg,image/svg+xml"
              aria-label="Upload SVG icon"
              hidden
              disabled={busy || readOnly}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const version = ++uploadVersion.current;
                setBusy(true);
                setError("");
                try {
                  const source = await svgIconDataUrl(file);
                  if (version === uploadVersion.current) pick(source);
                } catch (failure) {
                  if (version === uploadVersion.current)
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : "Unable to read SVG.",
                    );
                } finally {
                  if (version === uploadVersion.current) setBusy(false);
                }
              }}
            />
            {mode === "icons" ? (
              <>
                <input
                  aria-label="Search icons"
                  placeholder="Search icons..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  style={inputStyle}
                />
                <div
                  style={{
                    height: 300,
                    overflowY: "auto",
                    display: "grid",
                    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                    gridAutoRows: 40,
                    gap: 6,
                  }}
                >
                  {filtered.map((name) => (
                    <button
                      key={name}
                      type="button"
                      aria-label={`Choose ${name}`}
                      aria-pressed={value === name}
                      title={name}
                      onClick={() => pick(name)}
                      style={{
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 5,
                        border: `${value === name ? 2 : 1}px solid ${getChakraColorHex(value === name ? themeColor : border)}`,
                        background: getChakraColorHex(
                          value === name ? background : backgroundSecondary,
                        ),
                        color: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      <DynamicIcon name={name} size={24} />
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <span role="status" style={{ gridColumn: "1 / -1" }}>
                      {catalogState === "loading"
                        ? "Loading icons..."
                        : catalogState === "unavailable"
                          ? "React icons unavailable"
                          : "No icons found"}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                {value && isIconImage(value) && (
                  <DynamicIcon name={value} size={64} />
                )}
                <button
                  type="button"
                  disabled={busy || readOnly}
                  onClick={() => upload.current?.click()}
                  style={{
                    ...inputStyle,
                    display: "flex",
                    justifyContent: "center",
                    gap: 8,
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <PiUploadSimple />
                  {busy ? "Uploading..." : "Upload SVG"}
                </button>
                <input
                  type="url"
                  aria-label="SVG URL"
                  placeholder="https://example.com/icon.svg"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  style={inputStyle}
                />
                <button
                  type="button"
                  disabled={busy || readOnly}
                  onClick={() => {
                    if (
                      !isIconImage(url.trim()) ||
                      url.trim().startsWith(SVG_DATA_PREFIX)
                    )
                      setError("Enter an HTTP or HTTPS image URL.");
                    else pick(url.trim());
                  }}
                  style={inputStyle}
                >
                  Apply URL
                </button>
              </>
            )}
            {error && (
              <div role="alert" style={{ fontSize: 13 }}>
                {error}
              </div>
            )}
            <ToolbarTooltip label="Remove icon">
              <ToolbarIconButton
                aria-label={edgeId ? "Remove edge icon" : "Remove node icon"}
                icon={<PiTrash size={18} />}
                size="sm"
                variant="ghost"
                disabled={readOnly}
                onClick={() => pick("")}
              />
            </ToolbarTooltip>
          </div>
        )}
      </dialog>
    </>
  );
}
