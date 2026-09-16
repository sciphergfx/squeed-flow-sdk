import { Box, HStack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { PiPaperPlaneRight, PiStop } from "react-icons/pi";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import {
  ToolbarIconButton,
  ToolbarSelect,
  ToolbarTooltip,
} from "../components/toolbarControls";
import { getInteractionSurface } from "../theme/interactionShadow";
import { useCustomColors } from "../theme/useCustomColors";
import type { FlowDiagramNode } from "../types";
import { ObjectNodeView } from "./ObjectNodeView";
import { getColorVars } from "./objectViewTheme";

export function PromptNodeView(props: FlowDiagramNode) {
  const { callbacks, config, readOnly, themeColor, colorMode } =
    useFlowDiagramContext();
  const { canvas, background, border, colorText } = useCustomColors();
  const colors = getColorVars(props.data, themeColor, colorMode);
  const controller = useRef<AbortController>();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [temperature, setTemperature] = useState(1);
  const [draft, setDraft] = useState<string>();
  const content =
    typeof props.data.config?.content === "string"
      ? props.data.config.content
      : "";
  const promptText = draft ?? content;
  const canSend =
    !readOnly &&
    config.editable !== false &&
    !running &&
    !!callbacks.onPromptSubmit &&
    !!promptText.trim();
  const sendBackground = canSend ? canvas : background;
  useEffect(() => setDraft(undefined), [content]);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async (prompt = promptText) => {
    if (
      controller.current ||
      readOnly ||
      config.editable === false ||
      !prompt.trim() ||
      !callbacks.onPromptSubmit
    )
      return;
    const request = new AbortController();
    controller.current = request;
    setRunning(true);
    setError("");
    try {
      await callbacks.onPromptSubmit(
        { nodeId: props.data.id, prompt, temperature },
        request.signal,
      );
    } catch (cause) {
      if (!request.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Prompt execution failed.",
        );
    } finally {
      if (controller.current === request) {
        controller.current = undefined;
        setRunning(false);
      }
    }
  };
  return (
    <ObjectNodeView
      {...props}
      contentProps={{
        px: 8,
        py: 6,
        minH: "200px",
        flexShrink: 0,
        overscrollBehavior: "contain",
      }}
      contentPlainText
      contentPlaceholder="How can I assist you?"
      onContentDraftChange={setDraft}
      onContentSubmit={
        !running && callbacks.onPromptSubmit
          ? (draft: string) => void run(draft)
          : undefined
      }
      data={{
        ...props.data,
        viewProps: { ...props.data.viewProps, containerType: "inline-size" },
        config: {
          ...props.data.config,
          content,
          contentFormat: "markdown",
          icon: props.data.config?.icon ?? "PiBrain",
        },
      }}
      footer={
        <Box
          data-prompt-controls=""
          background={colors.highlightColor}
          flexShrink={0}
          width="100%"
          pl={8}
          pr={4}
          pt={1}
          pb={4}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          css={{
            "@container (max-width: 300px)": { paddingLeft: "16px" },
            '& [role="combobox"] > svg': { width: "32px", height: "32px" },
            '& [role="option"]': { fontSize: "28px" },
            '& [role="option"] svg': { width: "32px", height: "32px" },
          }}
        >
          {error && (
            <Text role="alert" fontSize="sm" color="red.500">
              {error}
            </Text>
          )}
          <HStack justifyContent="space-between" alignItems="center" gap={3}>
            <HStack
              minW={0}
              gap={2}
              flexWrap="wrap"
              color={colors.hextextColor}
            >
              <Text fontSize="32px" lineHeight="1.15" fontWeight="bold">
                Thinking effort
              </Text>
              <ToolbarSelect
                aria-label="Thinking effort"
                value={String(temperature)}
                disabled={
                  readOnly ||
                  config.editable === false ||
                  running ||
                  !callbacks.onPromptSubmit
                }
                style={{
                  width: "176px",
                  height: "60px",
                  flexShrink: 0,
                  fontSize: "32px",
                  color: colors.hextextColor,
                }}
                onValueChange={(value) => setTemperature(Number(value))}
              >
                <option value="0">Low</option>
                <option value="1">Mid</option>
                <option value="2">Max</option>
              </ToolbarSelect>
            </HStack>
            <ToolbarTooltip
              label={
                running
                  ? "Cancel prompt"
                  : callbacks.onPromptSubmit
                    ? "Run prompt"
                    : "Prompt execution is not connected"
              }
            >
              <ToolbarIconButton
                aria-label={running ? "Cancel prompt" : "Run prompt"}
                aria-busy={running}
                variant="ghost"
                rounded="50%"
                width="80px"
                minWidth="80px"
                height="80px"
                flexShrink={0}
                mr="2px"
                bg={sendBackground}
                color={colorText}
                _hover={{ bg: sendBackground, color: colorText }}
                _active={{ bg: sendBackground }}
                css={{
                  ...getInteractionSurface(
                    `var(--chakra-colors-${sendBackground.replace(".", "-")})`,
                    `var(--chakra-colors-${border.replace(".", "-")})`,
                  ),
                  "& > svg": { width: "40px", height: "40px" },
                }}
                icon={
                  running ? (
                    <PiStop size={40} />
                  ) : (
                    <PiPaperPlaneRight size={40} />
                  )
                }
                disabled={
                  readOnly ||
                  config.editable === false ||
                  (!running && !canSend)
                }
                rememberAction={false}
                onClick={() =>
                  running ? controller.current?.abort() : void run()
                }
              />
            </ToolbarTooltip>
          </HStack>
        </Box>
      }
    />
  );
}
