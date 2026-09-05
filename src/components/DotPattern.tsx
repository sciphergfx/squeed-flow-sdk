import { Box } from "@chakra-ui/react";
import { useFlowDiagramContext } from "./FlowDiagramContext";

const DotPatternBackground = ({
  children,
  pattern = "dot",
  backgroundColor,
}: {
  children: React.ReactNode;
  pattern?: string;
  backgroundColor?: string;
}) => {
  const { colorMode } = useFlowDiagramContext();
  const isDark = colorMode === "dark";
  const bgColor = isDark
    ? "--chakra-colors-gray-700"
    : "--chakra-colors-gray-500";
  const bgAltColor = isDark
    ? "--chakra-colors-gray-700"
    : "--chakra-colors-gray-800";

  if (pattern === "none") {
    return (
      <Box
        data-flow-background="none"
        width="100%"
        height="100%"
        padding={0}
        bg={backgroundColor}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box
      data-flow-background={pattern}
      position="relative"
      width="100%"
      height="100%"
      padding={0}
      bg={backgroundColor}
    >
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        width="100%"
        height="100%"
        zIndex={0}
        pointerEvents="none"
        style={{
          backgroundImage:
            pattern === "dot"
              ? `radial-gradient(var(${bgColor}) 8%, transparent 8%)`
              : pattern === "steel"
                ? `repeating-linear-gradient(45deg, var(${bgAltColor}) 0, var(${bgAltColor}) 1px, transparent 1px, transparent 20px)`
                : `linear-gradient(var(${bgAltColor}) 1px, transparent 1px), linear-gradient(90deg, var(${bgAltColor}) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
          opacity: 0.3,
        }}
      />
      <Box
        position="relative"
        width="100%"
        height="100%"
        zIndex={1}
        padding={0}
      >
        {children}
      </Box>
    </Box>
  );
};

export default DotPatternBackground;
