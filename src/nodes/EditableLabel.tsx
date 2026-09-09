import { Input, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { useStopPropagation } from "../hooks/useStopPropagation";

interface EditableLabelProps {
  nodeId: string;
  label: string;
  color: string;
  fontWeight?: string;
  fontSize?: string;
  wrap?: boolean;
  isEditing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
}

export const EditableLabel = ({
  nodeId,
  label,
  color,
  fontWeight = "bold",
  fontSize = "5xl",
  wrap = false,
  isEditing,
  onEditStart,
  onEditEnd,
}: EditableLabelProps) => {
  const { callbacks, config, readOnly } = useFlowDiagramContext();
  const editable = config.editable && !readOnly;
  const [editValue, setEditValue] = useState(label);
  const [editorSize, setEditorSize] = useState<{
    width: number;
    height: number;
  }>();
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const wrapperRef = useStopPropagation<HTMLDivElement>(isEditing);

  useEffect(() => {
    if (isEditing) {
      committedRef.current = false;
      if (inputRef.current) {
        inputRef.current.focus();
        const position = inputRef.current.value.length;
        inputRef.current.setSelectionRange(position, position);
      }
    }
  }, [isEditing]);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      callbacks.onNodeLabelChange?.(nodeId, trimmed);
    }
    onEditEnd();
  };

  if (!editable || !isEditing) {
    return (
      <Text
        color={color}
        fontWeight={fontWeight}
        fontSize={fontSize}
        minW={0}
        maxW="100%"
        whiteSpace={wrap ? "normal" : "nowrap"}
        overflowWrap={wrap ? "anywhere" : undefined}
        overflow="hidden"
        textOverflow="ellipsis"
        title={label}
        onDoubleClick={
          editable
            ? (e) => {
                e.stopPropagation();
                setEditorSize({
                  width: e.currentTarget.offsetWidth,
                  height: e.currentTarget.offsetHeight,
                });
                setEditValue(label);
                onEditStart();
              }
            : undefined
        }
        cursor={editable ? "text" : undefined}
      >
        {label}
      </Text>
    );
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        width: "max-content",
        minWidth: editorSize?.width,
        maxWidth: 900,
        height: editorSize?.height,
      }}
    >
      <Text
        as="span"
        aria-hidden="true"
        display="block"
        visibility="hidden"
        fontWeight={fontWeight}
        fontSize={fontSize}
        lineHeight="normal"
        whiteSpace="pre"
        overflow="hidden"
      >
        {editValue || " "}
      </Text>
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            committedRef.current = true;
            onEditEnd();
          }
        }}
        color={color}
        fontWeight={fontWeight}
        fontSize={fontSize}
        bg="transparent"
        borderWidth={0}
        _focus={{ outline: "none", boxShadow: "none" }}
        _focusVisible={{ outline: "none", boxShadow: "none" }}
        p={0}
        display="block"
        position="absolute"
        top={0}
        left={0}
        w="100%"
        h="100%"
        minW={0}
        minH={0}
        lineHeight="normal"
      />
    </div>
  );
};
