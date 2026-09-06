import { createConfiguredDiagram } from "../declarative/adapter";
import { DIAGRAM_SOURCE, DIAGRAM_BINDINGS, DIAGRAM_DESIGN } from "./configured";

export const createCastSessionExample = () => createConfiguredDiagram(DIAGRAM_SOURCE, DIAGRAM_BINDINGS, DIAGRAM_DESIGN);
export const CAST_SESSION_EXAMPLE = createCastSessionExample();
