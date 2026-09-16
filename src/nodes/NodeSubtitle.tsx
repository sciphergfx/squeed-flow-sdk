import { Box, Text } from "@chakra-ui/react";
import { useCustomColors } from "../theme/useCustomColors";
import type { FlowDiagramNode, NodeEditMetadata } from "../types";
import { useTimeAgo } from "../utils/relativeTime";

function EditSubtitle({
  edited,
  relative,
  helpText,
  fontSize,
}: {
  edited: NodeEditMetadata;
  relative?: string;
  helpText: string;
  fontSize: string;
}) {
  if (!relative || !edited.name) return null;
  return (
    <Text
      data-flow-node-edited=""
      fontSize={fontSize}
      lineHeight={1.3}
      textTransform="none"
      title={helpText}
    >
      {edited.name} · edited{" "}
      <time dateTime={edited.at} title={helpText}>
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
  const relative = useTimeAgo(edited?.at);
  const contentCaption =
    caption ||
    typeof data.config?.content === "string" ||
    Array.isArray(data.config?.content);
  const fontSize =
    data.type === "objectView" || data.config?.labelBelow || contentCaption
      ? "32px"
      : "20px";
  const helpText = [
    subtitle,
    edited?.name,
    edited ? `edited ${relative ?? ""} · ${new Date(edited.at).toLocaleString()}` : undefined,
  ]
    .filter((line): line is string => !!line)
    .join("\n");
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
      title={helpText || undefined}
    >
      {edited && <EditSubtitle edited={edited} relative={relative} helpText={helpText} fontSize={fontSize} />}
      {subtitle && (
        <Text
          data-flow-node-subtitle=""
          fontSize={fontSize}
          lineHeight={1.3}
          whiteSpace="pre-line"
          title={helpText}
        >
          {subtitle}
        </Text>
      )}
    </Box>
  );
}
