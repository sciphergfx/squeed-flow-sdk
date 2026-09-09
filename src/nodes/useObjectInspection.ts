import { useContext } from "react";
import { useFlowDiagramContext } from "../components/FlowDiagramContext";
import { useNodeViewActions } from "../hooks/useNodeViewActions";
import { FormDocumentContext } from "./NodeForm";
import { getNode } from "../core/squeedEdits";
import { conditionMatches, resolveFormNode } from "../core/forms";
import { resolveStateForm } from "../utils/formState";

export function useObjectInspection(props) {
  const { themeColor, colorMode, direction } = useFlowDiagramContext();
  const actions = useNodeViewActions();
  const objVisible = actions.getNodeViewMode(props.data.id) === "properties";
  const setObjVisible = (value: boolean) =>
    actions.setNodeViewMode(props.data.id, value ? "properties" : "default");
  const inspecting =
    !!props.onShowIcon ||
    objVisible ||
    (typeof props.data.config?.content !== "string" &&
      !(
        props.data.config?.contentFormat === "jsx" &&
        Array.isArray(props.data.config?.content)
      ));
  const { bindings, data: formState, schema } = useContext(FormDocumentContext);
  const resourcePorts = bindings?.[props.data.id]?.portResources;
  const form = bindings
    ? resolveStateForm(bindings, props.data.id, schema)
    : formState && schema
      ? resolveFormNode(formState, props.data.id, schema)
      : undefined;
  const config =
    form &&
    getNode(formState, "address" in form ? form.address : props.data.id);
  const configRows =
    config && typeof config === "object" && form
      ? Object.fromEntries(
          Object.keys(form.type.properties)
            .filter(
              (key) =>
                Object.prototype.hasOwnProperty.call(config, key) &&
                conditionMatches(form.fields[key]?.$visibleWhen, formState),
            )
            .map((key) => [
              key,
              config[key] !== null && typeof config[key] === "object"
                ? JSON.stringify(config[key], null, 2)
                : config[key] === null
                  ? "null"
                  : config[key],
            ]),
        )
      : {};
  const baseDescription = resourcePorts
    ? Object.fromEntries(
        Object.entries(resourcePorts).map(([port, address]) => [
          port.slice(port.indexOf(":") + 1),
          getNode(formState, address)?.name ?? address.split(".").at(-1),
        ]),
      )
    : Object.keys(props.data.description ?? {}).length
      ? props.data.description
      : configRows;
  const inspectionPorts =
    inspecting && !resourcePorts ? (props.data.config?.ports ?? []) : [];
  const extraPorts = inspectionPorts.filter(
    (port) =>
      !Object.prototype.hasOwnProperty.call(baseDescription, port.id) &&
      !Object.entries(form?.type.ports ?? {}).some(
        ([key, declaration]) =>
          `${declaration.kind}:${key}` === port.id &&
          Object.prototype.hasOwnProperty.call(baseDescription, key),
      ),
  );
  const description = {
    ...baseDescription,
    ...Object.fromEntries(extraPorts.map((port) => [port.id, ""])),
  };

  return {
    themeColor,
    colorMode,
    direction,
    objVisible,
    setObjVisible,
    inspecting,
    resourcePorts,
    form,
    description,
    inspectionPorts,
    extraPorts,
  };
}
