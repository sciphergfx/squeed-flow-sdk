import {
  EditableLabel,
  NodeView,
  getChakraColorHex,
  type FlowDiagramNode,
} from "@squeed/flow-sdk";

export function EditableCustomNode({ data }: FlowDiagramNode) {
  return (
    <NodeView data={data}>
      {({ isActive, isEditing, onEditStart, onEditEnd }) => (
        <div
          data-custom-selected={isActive}
          style={{ width: 240, height: 160, position: "relative" }}
        >
          <svg width="240" height="160" aria-hidden="true">
            <ellipse
              cx="120"
              cy="80"
              rx="116"
              ry="76"
              fill={getChakraColorHex(data.viewProps?.bgColor ?? "blue.100")}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: "55px 30px",
              textAlign: "center",
            }}
          >
            <EditableLabel
              nodeId={data.id}
              label={data.label ?? "Custom"}
              color="gray.900"
              fontSize="24px"
              isEditing={isEditing}
              onEditStart={onEditStart}
              onEditEnd={onEditEnd}
            />
          </div>
        </div>
      )}
    </NodeView>
  );
}
