import { Box, Flex, Text } from "@chakra-ui/react";
import { useFlowData } from "../components/FlowDiagramContext";
import { contentObjTheme } from "../theme/colorUtils";
import { OBJECT_VALUE_WIDTH, truncateText } from "./objectViewTheme";

export function ObjectPropertyTable({
  data,
  resourcePorts,
  inspecting,
  form,
  inspectionPorts,
  extraPorts,
  colors,
  direction,
  uniformKeyWidth,
}) {
  const { edgeById } = useFlowData();
  const connectedPorts = new Set<string>();
  for (const { data: edge } of edgeById.values()) {
    if (edge.source === data.id && edge.sourceProperty !== undefined)
      connectedPorts.add(`source:${edge.sourceProperty}`);
    if (edge.target === data.id && edge.targetProperty !== undefined)
      connectedPorts.add(`target:${edge.targetProperty}`);
  }
  return (
    <Box>
      {Object.entries(data.description || {}).map(([key, value], index) => {
        const resourcePort =
          resourcePorts &&
          Object.keys(resourcePorts).find(
            (port) => port.slice(port.indexOf(":") + 1) === key,
          );
        const declaration = inspecting && form?.type.ports?.[key];
        const portId =
          resourcePort ?? (declaration ? `${declaration.kind}:${key}` : key);
        const inspectionPort = inspectionPorts.find(
          (port) => port.id === portId,
        );
        const role = resourcePort ? "source" : inspectionPort?.role;
        const labelOnly =
          value === "" &&
          (role
            ? connectedPorts.has(`${role}:${portId}`)
            : connectedPorts.has(`source:${portId}`) ||
              connectedPorts.has(`target:${portId}`));
        const label = extraPorts.some((port) => port.id === key)
          ? key.replace(/^(template|input|output|config|error):/, "")
          : key;
        const typeColor = contentObjTheme(colors.wordBeforeDot)[typeof value];
        const keyColor = contentObjTheme(colors.wordBeforeDot)["property"];

        return (
          <Box
            key={key}
            data-flow-property={
              resourcePort && (direction === "TB" || direction === "BT")
                ? undefined
                : portId
            }
            data-flow-port-role={role}
            data-flow-inspection-row={inspecting ? "" : undefined}
          >
            <Flex flexWrap="nowrap" overflow="hidden">
              <Flex
                justifyContent="start"
                align="center"
                background={colors.highlightColor}
                width={labelOnly ? "100%" : `${uniformKeyWidth}px`}
                minWidth={`${uniformKeyWidth}px`}
                borderRightColor={colors.hexborderColor}
                borderRightWidth={labelOnly ? 0 : 1}
              >
                <Text
                  py={5}
                  px={10}
                  w="100%"
                  whiteSpace="nowrap"
                  fontWeight="bold"
                  fontSize="4xl"
                  color={
                    data?.viewProps?.textColor ||
                    (colors.isTransparent ? colors.hextextColor : keyColor)
                  }
                >
                  {label}
                </Text>
              </Flex>
              {!labelOnly && (
                <Flex
                  flex={1}
                  justifyContent="start"
                  overflow="hidden"
                  p={4}
                  background={colors.hexbgColor}
                  w={OBJECT_VALUE_WIDTH}
                  maxH={200}
                >
                  <Text
                    overflow="hidden"
                    py={3}
                    px={4}
                    whiteSpace="normal"
                    textOverflow="ellipsis"
                    fontSize="4xl"
                    color={
                      data?.viewProps?.textColor ||
                      (colors.isTransparent ? colors.hextextColor : typeColor)
                    }
                    fontWeight={400}
                  >
                    {truncateText(value)}
                  </Text>
                </Flex>
              )}
            </Flex>
            {index !== Object.entries(data.description || {}).length - 1 && (
              <Box
                borderTopWidth={1}
                my={0}
                borderColor={colors.hexborderColor}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
