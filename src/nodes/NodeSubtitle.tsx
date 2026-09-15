import { Box, Text } from "@chakra-ui/react";
import { useCustomColors } from "../theme/useCustomColors";
import type { FlowDiagramNode, NodeEditMetadata } from "../types";
import { useTimeAgo } from "../utils/relativeTime";

function EditSubtitle({
  edited,
  fontSize,
}: {
  edited: NodeEditMetadata;
  fontSize: string;
}) {
  const relative = useTimeAgo(edited.at);
  if (!relative || !edited.name) return null;
  return (
    <Text
      data-flow-node-edited=""
      fontSize={fontSize}
      lineHeight={1.3}
      textTransform="none"
    >
      {edited.name} · edited{" "}
      <time dateTime={edited.at} title={new Date(edited.at).toLocaleString()}>
        {relative}
      </time>
    </Text>
  );
}

export function NodeSubtitle({
  data,
  caption = false,
}: {
  data: FlowDiagramNode["data"];
  caption?: boolean;
}) {
  const { colorText } = useCustomColors();
  const subtitle =
    typeof data.config?.subtitle === "string" ? data.config.subtitle : "";
  const edited = data.config?.edited as NodeEditMetadata | undefined;
  const contentCaption =
    caption ||
    typeof data.config?.content === "string" ||
    Array.isArray(data.config?.content);
  const fontSize =
    data.type === "objectView" || data.config?.labelBelow || contentCaption
      ? "32px"
      : "20px";
  if (!edited && !contentCaption) return null;
  if (!edited && !subtitle) return null;
  return (
    <Box
      data-flow-node-subtitles=""
      color={colorText}
      opacity={0.7}
      pt={2}
      minW={0}
      maxW="100%"
      textAlign="center"
      overflowWrap="anywhere"
    >
      {subtitle && (
        <Text data-flow-node-subtitle="" fontSize={fontSize} lineHeight={1.3}>
          {subtitle}
        </Text>
      )}
      {edited && <EditSubtitle edited={edited} fontSize={fontSize} />}
    </Box>
  );
}
