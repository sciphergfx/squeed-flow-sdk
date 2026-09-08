import { chakra, Tabs } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import {
  PiArrowRight,
  PiCaretLeft,
  PiCaretRight,
  PiShapes,
  PiTrash,
  PiUploadSimple,
} from "react-icons/pi";
import { getChakraColorHex, LIGHT_BLACK } from "../theme/colorUtils";
import { getInteractionSurface } from "../theme/interactionShadow";
import { useCustomColors } from "../theme/useCustomColors";
import DynamicIcon from "../utils/DynamicIcon";
import {
  isIconImage,
  SVG_DATA_PREFIX,
  svgIconDataUrl,
} from "../utils/iconSources";
import { useFlowDiagramContext } from "./FlowDiagramContext";
import {
  ToolbarCloseButton,
  ToolbarIconButton,
  ToolbarTooltip,
} from "./toolbarControls";

export function NodeIconPicker({
  nodeId,
  edgeId,
  value,
  open: requestedOpen,
  onOpenChange,
}: {
  nodeId?: string;
  edgeId?: string;
  value?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { callbacks, readOnly, themeColor, colorMode } =
    useFlowDiagramContext();
  const { background, backgroundSecondary, border, colorText, colorInactive } =
    useCustomColors();
  const indicatorColor =
    colorMode === "dark" ? LIGHT_BLACK : getChakraColorHex(colorInactive);
  const dialog = useRef<HTMLDialogElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const uploadVersion = useRef(0);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("icons");
  const [icons, setIcons] = useState<string[]>([]);
  const [catalogState, setCatalogState] = useState("loading");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
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
  useEffect(() => {
    if (requestedOpen === undefined) return;
    if (!requestedOpen || readOnly) {
      dialog.current?.close();
      return;
    }
    if (dialog.current?.open) return;
    setError("");
    setMode(
      value === "PiFileSvg" || (value && isIconImage(value))
        ? "custom"
        : "icons",
    );
    setUrl(
      value && !value.startsWith(SVG_DATA_PREFIX) && isIconImage(value)
        ? value
        : "",
    );
    setOpen(true);
    dialog.current?.showModal();
  }, [requestedOpen, readOnly, value]);
  const pick = (icon: string) => {
    if (readOnly) return;
    if (edgeId) callbacks.onEdgeIconChange?.(edgeId, icon);
    else if (nodeId) callbacks.onNodeIconChange?.(nodeId, icon);
    onOpenChange?.(false);
    dialog.current?.close();
  };
  const matches = icons.filter((name) =>
    name
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const pageSize = 36;
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const filtered = matches.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  const inputStyle = {
    width: "100%",
    padding: "8px 14px",
    background: "transparent",
    color: "inherit",
    border: `1px solid ${getChakraColorHex(border)}`,
    borderRadius: 30,
  };
  return (
    <>
      {requestedOpen === undefined && (
        <ToolbarTooltip
          label={edgeId ? "Choose edge icon" : "Choose node icon"}
        >
          <ToolbarIconButton
            aria-label={edgeId ? "Choose edge icon" : "Choose node icon"}
            icon={<PiShapes size={20} />}
            size="sm"
            variant="ghost"
            color={getChakraColorHex(themeColor)}
            disabled={readOnly}
            onClick={() => {
              setError("");
              setMode(value && isIconImage(value) ? "custom" : "icons");
              setUrl(
                value &&
                  !value.startsWith(SVG_DATA_PREFIX) &&
                  isIconImage(value)
                  ? value
                  : "",
              );
              setOpen(true);
              dialog.current?.showModal();
            }}
          />
        </ToolbarTooltip>
      )}
      <chakra.dialog
        ref={dialog}
        aria-label={edgeId ? "Choose edge icon" : "Choose node icon"}
        css={getInteractionSurface(
          getChakraColorHex(background),
          getChakraColorHex(border),
        )}
        onClose={() => {
          setOpen(false);
          onOpenChange?.(false);
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
          padding: 12,
          width: 336,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          borderRadius: 30,
          background: getChakraColorHex(background),
          color: getChakraColorHex(colorText),
        }}
      >
        {open && (
          <div style={{ display: "grid", gap: 8 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <strong>{edgeId ? "Edge icon" : "Node icon"}</strong>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginLeft: "auto",
                  gap: 4,
                }}
              >
                {value && (
                  <ToolbarTooltip label="Remove icon">
                    <ToolbarIconButton
                      aria-label={
                        edgeId ? "Remove edge icon" : "Remove node icon"
                      }
                      icon={<PiTrash size={18} />}
                      size="sm"
                      variant="ghost"
                      disabled={readOnly || busy}
                      onClick={() => pick("")}
                    />
                  </ToolbarTooltip>
                )}
                <ToolbarCloseButton
                  aria-label="Close icon picker"
                  onClick={() => dialog.current?.close()}
                />
              </div>
            </div>
            <Tabs.Root
              value={mode}
              onValueChange={({ value }) => {
                setMode(value);
                setError("");
              }}
              display="contents"
              css={{ "--indicator-thickness": "1px" }}
            >
              <Tabs.List
                aria-label="Icon source"
                width="100%"
                borderBottomWidth={0}
              >
                {(["icons", "custom"] as const).map((source) => (
                  <Tabs.Trigger
                    key={source}
                    value={source}
                    flex={1}
                    minW={0}
                    justifyContent="center"
                    px={3}
                    py={2}
                    fontSize="13px"
                    _selected={{
                      color: themeColor,
                      borderColor: indicatorColor,
                      "--indicator-color": indicatorColor,
                    }}
                  >
                    {source === "icons" ? "React icons" : "Custom SVG"}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
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
              <Tabs.Content
                value={mode}
                p={0}
                style={{ display: "grid", gap: 8 }}
              >
                {mode === "icons" ? (
                  <>
                    <input
                      aria-label="Search icons"
                      placeholder="Search icons..."
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(0);
                      }}
                      style={inputStyle}
                    />
                    <div
                      style={{
                        height: 244,
                        overflowY: "auto",
                        display: "grid",
                        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                        gridAutoRows: 36,
                        gap: 4,
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span role="status" style={{ fontSize: 12 }}>
                        {matches.length} icons · {currentPage + 1} / {pageCount}
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <ToolbarTooltip label="Previous icons">
                          <ToolbarIconButton
                            aria-label="Previous icons"
                            icon={<PiCaretLeft size={18} />}
                            size="sm"
                            variant="ghost"
                            disabled={currentPage === 0}
                            onClick={() => setPage(currentPage - 1)}
                          />
                        </ToolbarTooltip>
                        <ToolbarTooltip label="Next icons">
                          <ToolbarIconButton
                            aria-label="Next icons"
                            icon={<PiCaretRight size={18} />}
                            size="sm"
                            variant="ghost"
                            disabled={currentPage + 1 >= pageCount}
                            onClick={() => setPage(currentPage + 1)}
                          />
                        </ToolbarTooltip>
                      </div>
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
                    <form
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        minWidth: 0,
                      }}
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (busy || readOnly) return;
                        if (
                          !isIconImage(url.trim()) ||
                          url.trim().startsWith(SVG_DATA_PREFIX)
                        )
                          setError("Enter an HTTP or HTTPS image URL.");
                        else pick(url.trim());
                      }}
                    >
                      <input
                        type="url"
                        aria-label="SVG URL"
                        placeholder="https://example.com/icon.svg"
                        value={url}
                        disabled={busy || readOnly}
                        onChange={(event) => setUrl(event.target.value)}
                        style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                      />
                      <ToolbarTooltip label="Apply URL">
                        <ToolbarIconButton
                          type="submit"
                          aria-label="Apply URL"
                          icon={<PiArrowRight size={20} />}
                          size="sm"
                          variant="ghost"
                          disabled={busy || readOnly || !url.trim()}
                          style={{ flexShrink: 0 }}
                        />
                      </ToolbarTooltip>
                    </form>
                  </>
                )}
              </Tabs.Content>
            </Tabs.Root>
            {error && (
              <div role="alert" style={{ fontSize: 13 }}>
                {error}
              </div>
            )}
          </div>
        )}
      </chakra.dialog>
    </>
  );
}
