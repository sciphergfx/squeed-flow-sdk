import { startCase } from "lodash";
import { useContext } from "react";
import { conditionMatches } from "../core/forms";
import { getNode } from "../core/squeedEdits";
import { getChakraColorHex } from "../theme/colorUtils";
import { useCustomColors } from "../theme/useCustomColors";
import { resolveStateForm } from "../utils/formState";
import { FormDocumentContext } from "./NodeForm";

export function NodeConfigSummary({ nodeAddress }: { nodeAddress: string }) {
  const { data, schema, bindings } = useContext(FormDocumentContext);
  const { colorText, background } = useCustomColors();
  const form = bindings && resolveStateForm(bindings, nodeAddress, schema);
  if (!data || !form) return null;
  const state = getNode(data, form.address);
  if (!state || typeof state !== "object") return null;
  return (
    <div
      data-flow-config-summary=""
      style={{
        width: "100%",
        minWidth: 0,
        color: getChakraColorHex(colorText),
        background: getChakraColorHex(background),
        fontSize: 24,
        lineHeight: 1.4,
        textTransform: "none",
      }}
    >
      {Object.keys(form.type.properties).map((key) => {
        const field = form.fields[key] ?? {};
        if (!conditionMatches(field.$visibleWhen, data)) return null;
        const value = state[key];
        const text =
          value === undefined || value === null
            ? ""
            : typeof value === "object"
              ? JSON.stringify(value)
              : String(value);
        return (
          <div
            key={key}
            data-flow-property={key}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 12,
              padding: "10px 16px",
              borderTop:
                "1px solid color-mix(in srgb, currentColor 12%, transparent)",
            }}
          >
            <span style={{ overflowWrap: "anywhere" }}>
              {startCase(field.$label ?? key)}
            </span>
            <span
              title={text}
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
