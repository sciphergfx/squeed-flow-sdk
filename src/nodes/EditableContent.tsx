import { Box, Textarea } from "@chakra-ui/react";
import Markdown from "markdown-to-jsx/react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { useStopPropagation } from "../hooks/useStopPropagation";

const CONTENT_LINE_HEIGHT = 1.55;

export function EditableContent({
  nodeId,
  content,
  color,
}: {
  nodeId: string;
  content: string;
  color: string;
}) {
  const { callbacks, config, readOnly } = useFlowDiagramContext();
  const editable = !!config.editable && !readOnly;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [size, setSize] = useState<{ width: number; height: number }>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);
  const wrapperRef = useStopPropagation<HTMLDivElement>(editing);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!editing || !input) return;
    input.style.height = "auto";
    input.style.height = `${Math.max(size?.height ?? 0, input.scrollHeight)}px`;
  }, [draft, editing, size]);

  useEffect(() => {
    if (!editable) setEditing(false);
    else if (editing) {
      committedRef.current = false;
      inputRef.current?.focus();
    }
  }, [editing, editable]);

  const startEditing = (element: HTMLElement) => {
    if (!editable) return;
    setSize({ width: element.offsetWidth, height: element.offsetHeight });
    setDraft(content);
    setEditing(true);
  };
  const commit = () => {
    if (committedRef.current || !editable) return;
    committedRef.current = true;
    if (draft !== content) callbacks.onNodeContentChange?.(nodeId, draft);
    setEditing(false);
  };

  if (!editing || !editable)
    return (
      <Box
        data-flow-content=""
        color={color}
        opacity={content ? undefined : 0.6}
        w="100%"
        minH="1.2em"
        whiteSpace="normal"
        lineHeight={CONTENT_LINE_HEIGHT}
        overflowWrap="anywhere"
        css={{
          "& > :first-of-type": { marginTop: 0 },
          "& > :last-of-type": { marginBottom: 0 },
          "& h1, & h2, & h3, & h4, & h5, & h6": {
            fontWeight: 700,
            lineHeight: 1.2,
            margin: "1em 0 0.45em",
          },
          "& h1": { fontSize: "1.5em" },
          "& h2": { fontSize: "1.3em" },
          "& h3": { fontSize: "1.1em" },
          "& p": { margin: "0.65em 0", whiteSpace: "pre-wrap" },
          "& ul, & ol": { margin: "0.65em 0", paddingInlineStart: "1.6em" },
          "& ul": { listStyleType: "disc" },
          "& ol": { listStyleType: "decimal" },
          "& li": {
            display: "list-item",
            margin: "0.3em 0",
            paddingInlineStart: "0.15em",
          },
          "& li > ul, & li > ol": { margin: "0.25em 0" },
          "& li > p": { margin: 0 },
          "& a": { color: "inherit", textDecoration: "underline" },
          "& code": { fontFamily: "monospace", fontSize: "0.85em" },
          "& :not(pre) > code": {
            background: "color-mix(in srgb, currentColor 10%, transparent)",
            padding: "0.1em 0.25em",
            borderRadius: "0.2em",
          },
          "& pre": {
            margin: "0.75em 0",
            padding: "0.75em",
            background: "color-mix(in srgb, currentColor 8%, transparent)",
            border: 0,
            borderRadius: "6px",
            maxWidth: "100%",
            overflowX: "auto",
            whiteSpace: "pre",
            overflowWrap: "normal",
            lineHeight: 1.5,
          },
          "& pre code": {
            background: "transparent",
            padding: 0,
            whiteSpace: "inherit",
          },
          "& strong": { fontWeight: 700 },
          "& em": { fontStyle: "italic" },
          "& blockquote": {
            margin: "0.4em 0",
            borderInlineStart: "0.1em solid currentColor",
            paddingInlineStart: "0.6em",
          },
          "& table": {
            width: "100%",
            tableLayout: "fixed",
            borderCollapse: "collapse",
            margin: "0.4em 0",
          },
          "& th, & td": {
            border: "1px solid currentColor",
            padding: "0.2em 0.3em",
            textAlign: "left",
          },
          "& th": { fontWeight: 700 },
          "& img": { maxWidth: "100%", height: "auto" },
        }}
        cursor={editable ? "text" : undefined}
        tabIndex={editable ? 0 : undefined}
        onDoubleClick={(event) => {
          event.stopPropagation();
          startEditing(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (
            editable &&
            event.key === "Enter" &&
            event.target === event.currentTarget
          ) {
            event.preventDefault();
            event.stopPropagation();
            startEditing(event.currentTarget);
          }
        }}
      >
        <Markdown
          options={{
            forceBlock: true,
            wrapper: Fragment,
            disableParsingRawHTML: true,
            overrides: {
              a: { props: { target: "_blank", rel: "noopener noreferrer" } },
              img: {
                props: { loading: "lazy", referrerPolicy: "no-referrer" },
              },
            },
          }}
        >
          {content || (editable ? "Write your content here" : "")}
        </Markdown>
      </Box>
    );

  return (
    <div
      ref={wrapperRef}
      style={{ width: size?.width, minHeight: size?.height, maxWidth: "100%" }}
    >
      <Textarea
        ref={inputRef}
        aria-label="Node content"
        placeholder="Write your content here"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            committedRef.current = true;
            setEditing(false);
          }
        }}
        color={color}
        fontFamily="inherit"
        fontSize="inherit"
        lineHeight={CONTENT_LINE_HEIGHT}
        overflowWrap="anywhere"
        whiteSpace="pre-wrap"
        rows={1}
        bg="transparent"
        display="block"
        style={{ border: 0, outline: "none", boxShadow: "none" }}
        p={0}
        w="100%"
        h="100%"
        minW={0}
        minH={0}
        resize="none"
      />
    </div>
  );
}
