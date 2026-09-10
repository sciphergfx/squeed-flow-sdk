import { Box, HStack } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { PiArrowsIn, PiArrowsOut, PiCode } from "react-icons/pi";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { LoadingBorder } from "../components/LoadingBorder";
import { ToolbarIconButton } from "../components/toolbarControls";
import { ToolbarScrollContainer } from "../components/ToolbarScrollContainer";
import { useCustomColors } from "../theme/useCustomColors";
import type { ContentFormat, NodeContent } from "../types";

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
  const { background, border, colorInactive } = useCustomColors();
  const JsxContent = config.customViews?.jsxContent;
  const source =
    typeof content === "string" ? content : JSON.stringify(content, null, 2);
  let components: Record<string, unknown>[] | undefined;
  let contentError: string | undefined;
  if (format === "jsx") {
    try {
      const parsed =
        typeof content === "string" ? JSON.parse(content) : content;
      if (
        !Array.isArray(parsed) ||
        parsed.some(
          (component) =>
            !component ||
            typeof component !== "object" ||
            Array.isArray(component) ||
            typeof component.type !== "string",
        )
      )
        throw new Error(
          "JSX content must be an array of components with a type.",
        );
      components = parsed;
    } catch (error) {
      contentError =
        error instanceof Error ? error.message : "Invalid components array.";
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
  const [loadedPreview, setLoadedPreview] = useState<typeof preview>();
  const [failedPreview, setFailedPreview] = useState<typeof preview>();
  useEffect(() => {
    if (format === "jsx") return;
    let cancelled = false;
    import("./contentPreviewDocument")
      .then(({ contentPreviewDocument }) =>
        contentPreviewDocument(source, format, editable),
      )
      .then(
        (document) => {
          if (!cancelled)
            setPreview({ content: source, format, editable, document });
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
  const frameFailed = !!current && current === failedPreview;
  const loading = format !== "jsx" && !current?.error && !frameFailed && (!current || loadedPreview !== current);
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
        aria-busy={format !== "jsx" ? loading : undefined}
        bg={format === "jsx" && colorMode === "dark" ? "gray.900" : "white"}
        onDoubleClick={(event) => {
          if (
            format !== "jsx" ||
            !onEdit ||
            event.defaultPrevented ||
            (event.target as Element).closest(
              'button, a, input, textarea, select, [contenteditable], [role="button"], [role="textbox"]',
            )
          )
            return;
          event.stopPropagation();
          void (async () => {
            if (document.fullscreenElement === viewport.current)
              await document.exitFullscreen();
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
          "&:hover > [data-flow-content-toolbar], &:focus-within > [data-flow-content-toolbar]":
            { opacity: 1, pointerEvents: "auto" },
          "@media (hover: none)": {
            "& > [data-flow-content-toolbar]": {
              opacity: 1,
              pointerEvents: "auto",
            },
          },
        }}
      >
        <Box
          role="toolbar"
          aria-label="Content controls"
          data-flow-content-toolbar=""
          position="absolute"
          top="8px"
          right="8px"
          zIndex={1}
          w="max-content"
          maxW="calc(100% - 16px)"
          opacity={fullscreen ? 1 : 0}
          pointerEvents={fullscreen ? "auto" : "none"}
        >
          <ToolbarScrollContainer
            background={background}
            border={colorMode === "dark" ? border : "gray.300"}
          >
            <HStack
              px="8px"
              gap="8px"
              h="100%"
              w="max-content"
              css={{
                "& button > svg": {
                  width: "20px",
                  height: "20px",
                  minWidth: "20px",
                  minHeight: "20px",
                  flexShrink: 0,
                },
              }}
            >
              {onEdit && (
                <ToolbarIconButton
                  data-flow-content-edit=""
                  aria-label="Edit content source"
                  title="Edit content source"
                  icon={<PiCode size={20} />}
                  size="sm"
                  variant="plain"
                  bg="transparent"
                  color={colorInactive}
                  borderRadius="30px"
                  w="32px"
                  h="32px"
                  minW="32px"
                  p={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    void (async () => {
                      if (document.fullscreenElement === viewport.current)
                        await document.exitFullscreen();
                      onEdit();
                    })().catch((error) => setFullscreenError(String(error)));
                  }}
                />
              )}
              <ToolbarIconButton
                ref={fullscreenButton}
                data-flow-fullscreen=""
                aria-label={fullscreen ? "Exit fullscreen" : "Expand preview"}
                title={fullscreen ? "Exit fullscreen" : "Expand preview"}
                aria-expanded={fullscreen}
                icon={
                  fullscreen ? (
                    <PiArrowsIn size={20} />
                  ) : (
                    <PiArrowsOut size={20} />
                  )
                }
                size="sm"
                variant="plain"
                bg="transparent"
                color={colorInactive}
                borderRadius="30px"
                w="32px"
                h="32px"
                minW="32px"
                p={0}
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleFullscreen();
                }}
              />
            </HStack>
          </ToolbarScrollContainer>
        </Box>
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
          contentError ? (
            <pre role="alert" style={{ whiteSpace: "pre-wrap" }}>
              {contentError}
            </pre>
          ) : JsxContent && components ? (
            <JsxContent
              components={components}
              colorMode={colorMode}
              fillHeight
            />
          ) : (
            <Box role="status" fontSize="14px">
              JSX content renderer is not available.
            </Box>
          )
        ) : current?.error || frameFailed ? (
          <pre role="alert" style={{ whiteSpace: "pre-wrap" }}>
            {current?.error || "Content preview could not be loaded."}
          </pre>
        ) : current?.document ? (
          <iframe
            key={current.document}
            ref={frame}
            title={`${format.toUpperCase()} content preview`}
            sandbox={editable ? "allow-scripts" : ""}
            allowFullScreen
            referrerPolicy="no-referrer"
            srcDoc={current.document}
            onLoad={() => setLoadedPreview(current)}
            onError={() => setFailedPreview(current)}
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              display: "block",
              background: "white",
              visibility: loading ? "hidden" : "visible",
            }}
          />
        ) : null}
        <LoadingBorder active={loading} label="Loading HTML content" />
      </Box>
    </div>
  );
}
