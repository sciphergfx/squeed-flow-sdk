import "cytoscape";

declare module "cytoscape" {
  interface Core {
    domNode(options: { dom_container: Element }): void;
  }

  interface CytoscapeStatic {
    prototype: { hasInitialised?: boolean };
  }
}

declare module "cytoscape-dom-node" {
  const CyDomNode: any;
  export default CyDomNode;
}

declare module "cytoscape-dagre" {
  const dagre: any;
  export default dagre;
}

declare module "cytoscape-edgehandles" {
  const edgehandles: any;
  export default edgehandles;
}
