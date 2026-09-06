import { getNode, type SqueedJson } from "../../src/core/squeedEdits";
import {
  materializeStepConfigs,
  type ConfigCatalogState,
} from "../workflow-form/catalog";
import {
  configureResources,
  type ResourceMapping,
} from "../workflow-state/resourceMapping";
import sharedState from "./shared-state.json";
import sharedBindings from "./shared-bindings.json";
import sharedView from "./shared-view.json";
import propertyState from "./property-state.json";
import propertyBindings from "./property-bindings.json";
import propertyView from "./property-view.json";
import mapping from "./mapping.json";
import { schema } from "./schema";

export {
  sharedState,
  sharedBindings,
  sharedView,
  propertyState,
  propertyBindings,
  propertyView,
  schema,
};

export function projectSharedExample(
  state: ConfigCatalogState,
  view: SqueedJson = sharedView,
) {
  const resolved = materializeStepConfigs(state);
  return {
    ...view,
    resolved: {
      ...getNode(view, "root.resolved"),
      $content: `\`\`\`json\n${JSON.stringify(resolved, null, 2)}\n\`\`\``,
    },
  };
}

export function createPropertyExample() {
  return configureResources(
    {
      state: propertyState,
      view: propertyView,
      schema,
      bindings: propertyBindings,
    },
    mapping as ResourceMapping,
  );
}
