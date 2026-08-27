import { useEffect, useRef, useState } from "react";
import { Input, Text } from "@chakra-ui/react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { useStopPropagation } from "../hooks/useStopPropagation";

interface EditableLabelProps {
  nodeId: string;
  label: string;
  color: string;
  fontWeight?: string;
  fontSize?: string;
  isEditing: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
}

export const EditableLabel = ({ nodeId, label, color, fontWeight = "bold", fontSize = "5xl", isEditing, onEditStart, onEditEnd }: EditableLabelProps) => {
  const { callbacks, config, readOnly } = useFlowDiagramContext();
  const editable = config.editable && !readOnly;
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const wrapperRef = useStopPropagation<HTMLDivElement>(isEditing);

  useEffect(() => {
    if (isEditing) {
      committedRef.current = false;
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
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
        onDoubleClick={editable ? (e) => { e.stopPropagation(); setEditValue(label); onEditStart(); } : undefined}
        cursor={editable ? "text" : undefined}
      >
        {label}
      </Text>
    );
  }

  return (
    <div ref={wrapperRef}>
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onEditEnd();
        }}
        color={color}
        fontWeight={fontWeight}
        fontSize={fontSize}
        bg="transparent"
        borderWidth={0}
        p={0}
        h="auto"
        lineHeight="normal"
      />
    </div>
  );
};
