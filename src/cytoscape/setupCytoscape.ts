import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import edgehandles from "cytoscape-edgehandles";
import CyDomNode from "cytoscape-dom-node";

if (!cytoscape.prototype.hasInitialised) {
  cytoscape.use(dagre);
  cytoscape.use(edgehandles);
  cytoscape.use(CyDomNode);
  cytoscape.prototype.hasInitialised = true;
}

export { cytoscape };
