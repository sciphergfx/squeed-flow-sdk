import { useEffect, useRef, useState } from "react";
import { Box } from "@chakra-ui/react";
import { PiArrowsIn, PiArrowsOut } from "react-icons/pi";
import { ToolbarIconButton } from "../components/toolbarControls";
import type { ContentFormat, NodeContent } from "../types";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";

export function ContentPreview({
  content,
  format,
  onEdit,
}: {
  content: NodeContent;
  format: Exclude<ContentFormat, "markdown">;
  onEdit?: () => void;
}) {
  const { config, colorMode } = useFlowDiagramContext();
  const JsxContent = config.customViews?.jsxContent;
  const source = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  let components: Record<string, unknown>[] | undefined;
  let contentError: string | undefined;
  if (format === "jsx") {
    try {
      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      if (!Array.isArray(parsed) || parsed.some((component) => !component || typeof component !== "object" || Array.isArray(component) || typeof component.type !== "string"))
        throw new Error("JSX content must be an array of components with a type.");
      components = parsed;
    } catch (error) {
      contentError = error instanceof Error ? error.message : "Invalid components array.";
    }
  }
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const wasFullscreen = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const editable = !!onEdit;
  useEffect(() => {
    const changed = () => {
      const active = document.fullscreenElement === viewport.current;
      setFullscreen(active);
      if (wasFullscreen.current && !active && !document.fullscreenElement)
        fullscreenButton.current?.focus({ preventScroll: true });
      wasFullscreen.current = active;
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const toggleFullscreen = async () => {
    setFullscreenError("");
    try {
      if (document.fullscreenElement === viewport.current)
        await document.exitFullscreen();
      else if (viewport.current?.requestFullscreen)
        await viewport.current.requestFullscreen();
      else throw new Error("Fullscreen is not supported in this browser.");
    } catch (error) {
      setFullscreenError(
        error instanceof Error ? error.message : "Unable to change fullscreen.",
      );
    }
  };
  const [preview, setPreview] = useState<{
    content: string;
    format: string;
    editable: boolean;
    document?: string;
    error?: string;
  }>();
  useEffect(() => {
    if (format === "jsx") return;
    let cancelled = false;
    import("./contentPreviewDocument")
      .then(({ contentPreviewDocument }) =>
        contentPreviewDocument(source, format, editable),
      )
      .then(
        (document) => {
          if (!cancelled) setPreview({ content: source, format, editable, document });
        },
        (error) => {
          if (!cancelled)
            setPreview({
              content: source,
              format,
              editable,
              error: error instanceof Error ? error.message : String(error),
            });
        },
      );
    return () => {
      cancelled = true;
    };
  }, [source, format, editable]);
  useEffect(() => {
    if (!onEdit) return;
    const edit = async (event: MessageEvent) => {
      if (
        !frame.current?.contentWindow ||
        event.source !== frame.current.contentWindow ||
        event.data?.type !== "squeed:content-edit"
      )
        return;
      try {
        if (document.fullscreenElement === viewport.current)
          await document.exitFullscreen();
        onEdit();
      } catch (error) {
        setFullscreenError(
          error instanceof Error
            ? error.message
            : "Unable to close fullscreen.",
        );
      }
    };
    window.addEventListener("message", edit);
    return () => window.removeEventListener("message", edit);
  }, [onEdit]);
  const current =
    preview?.content === source &&
    preview.format === format &&
    preview.editable === editable
      ? preview
      : undefined;
  return (
    <div
      data-flow-content-preview=""
      style={{ width: "100%", height: 360, fontSize: 16, overflow: "auto" }}
    >
      <pre
        data-flow-preview-source=""
        style={{ display: "none", whiteSpace: "pre-wrap" }}
      >
        {source}
      </pre>
      <Box
        ref={viewport}
        position="relative"
        w="100%"
        h="100%"
        bg={format === "jsx" && colorMode === "dark" ? "gray.900" : "white"}
        onDoubleClick={(event) => {
          if (format !== "jsx" || !onEdit || event.defaultPrevented || (event.target as Element).closest('button, a, input, textarea, select, [contenteditable], [role="button"], [role="textbox"]')) return;
          event.stopPropagation();
          void (async () => {
            if (document.fullscreenElement === viewport.current) await document.exitFullscreen();
            onEdit();
          })().catch((error) => setFullscreenError(String(error)));
        }}
        onKeyDownCapture={(event) => {
          if (
            event.key !== "Escape" ||
            document.fullscreenElement !== viewport.current
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          void toggleFullscreen();
        }}
        css={{
          "&:fullscreen": {
            width: "100vw",
            height: "100dvh",
            maxWidth: "none",
            maxHeight: "none",
            padding: 0,
          },
          "&:hover > [data-flow-fullscreen], &:focus-within > [data-flow-fullscreen]":
            { opacity: 1, pointerEvents: "auto" },
          "@media (hover: none)": {
            "& > [data-flow-fullscreen]": { opacity: 1, pointerEvents: "auto" },
          },
        }}
      >
        <ToolbarIconButton
          ref={fullscreenButton}
          data-flow-fullscreen=""
          aria-label={fullscreen ? "Exit fullscreen" : "Expand preview"}
          title={fullscreen ? "Exit fullscreen" : "Expand preview"}
          aria-expanded={fullscreen}
          icon={fullscreen ? <PiArrowsIn /> : <PiArrowsOut />}
          position="absolute"
          top="8px"
          right="8px"
          zIndex={1}
          opacity={fullscreen ? 1 : 0}
          pointerEvents={fullscreen ? "auto" : "none"}
          onClick={(event) => {
            event.stopPropagation();
            void toggleFullscreen();
          }}
        />
        {fullscreenError && (
          <Box
            role="alert"
            position="absolute"
            bottom={0}
            insetInline={0}
            bg="white"
            color="red.700"
            fontSize="14px"
          >
            {fullscreenError}
          </Box>
        )}
        {format === "jsx" ? (
          contentError ? <pre role="alert" style={{ whiteSpace: "pre-wrap" }}>{contentError}</pre>
            : JsxContent && components ? <JsxContent components={components} colorMode={colorMode} fillHeight />
              : <Box role="status" fontSize="14px">JSX content renderer is not available.</Box>
        ) : current?.error ? (
          <pre role="alert" style={{ whiteSpace: "pre-wrap" }}>
            {current.error}
          </pre>
        ) : current?.document ? (
          <iframe
            ref={frame}
            title={`${format.toUpperCase()} content preview`}
            sandbox={editable ? "allow-scripts" : ""}
            allowFullScreen
            referrerPolicy="no-referrer"
            srcDoc={current.document}
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              display: "block",
              background: "white",
            }}
          />
        ) : (
          <span role="status">Loading preview...</span>
        )}
      </Box>
    </div>
  );
}
