export const calculateEdgeControlPoints = (cytoInstance, source, target, edgeId) => {
  if (!cytoInstance) {
    return { controlPointDistances: [0], controlPointWeights: [0.5] };
  }

  const parallelEdges = cytoInstance.edges().filter((edge) => {
    const data = edge.data();
    return (
      (data.source === source && data.target === target) ||
      (data.source === target && data.target === source)
    );
  });

  if (parallelEdges.length <= 1) {
    return { controlPointDistances: [0], controlPointWeights: [0.5] };
  }

  let edgeIndex = 0;
  parallelEdges.forEach((edge, index) => {
    if (edge.data().id === edgeId) {
      edgeIndex = index;
    }
  });

  const totalEdges = parallelEdges.length;
  const spacing = 60;
  const offset = (edgeIndex - (totalEdges - 1) / 2) * spacing;

  return {
    controlPointDistances: [offset],
    controlPointWeights: [0.5],
  };
};

export const calculateOptimalSpacing = (nodeCount) => {
  const baseEdgeSpacing = 650;
  const baseRankSpacing = 350;

  const scaleFactor = 1 / (Math.cbrt(nodeCount) * 0.8);

  let edgeSep = Math.round(baseEdgeSpacing * scaleFactor);
  let rankSep = Math.round(baseRankSpacing * scaleFactor);

  edgeSep = Math.max(40, Math.min(450, edgeSep));
  rankSep = Math.max(30, Math.min(300, rankSep));

  return { edgeSep, rankSep };
};
