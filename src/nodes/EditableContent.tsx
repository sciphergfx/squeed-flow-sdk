import { Box, Textarea } from "@chakra-ui/react";
import Markdown from "markdown-to-jsx/react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { useStopPropagation } from "../hooks/useStopPropagation";

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
        w="100%"
        minH="1.2em"
        whiteSpace="normal"
        overflowWrap="anywhere"
        css={{
          "& > :first-child": { marginTop: 0 },
          "& > :last-child": { marginBottom: 0 },
          "& h1, & h2, & h3, & h4, & h5, & h6": {
            fontWeight: 700,
            lineHeight: 1.2,
            margin: "0.6em 0 0.3em",
          },
          "& h1": { fontSize: "1.5em" },
          "& h2": { fontSize: "1.3em" },
          "& h3": { fontSize: "1.1em" },
          "& p": { margin: "0.4em 0", whiteSpace: "pre-wrap" },
          "& ul, & ol": { margin: "0.4em 0", paddingInlineStart: "1.3em" },
          "& ul": { listStyleType: "disc" },
          "& ol": { listStyleType: "decimal" },
          "& li > p": { margin: 0 },
          "& a": { color: "inherit", textDecoration: "underline" },
          "& code": { fontFamily: "monospace", fontSize: "0.85em" },
          "& pre": {
            margin: "0.4em 0",
            padding: "0.4em",
            border: "1px solid currentColor",
            maxWidth: "100%",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          },
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
          {content}
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
        lineHeight="inherit"
        bg="transparent"
        display="block"
        borderWidth={0}
        _focus={{ outline: "none", boxShadow: "none" }}
        _focusVisible={{ outline: "none", boxShadow: "none" }}
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
