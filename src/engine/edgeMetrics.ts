export const EDGE_WIDTH = 6;
const ARROW_SCALE = 3;
export const ARROW_SIZE =
  Math.max(Math.pow(EDGE_WIDTH * 13.37, 0.9), 29) * ARROW_SCALE;
export const ARROW_GAP = EDGE_WIDTH * ARROW_SCALE * 2;
export const STANDOFF = 80;
export const NODE_CONNECTOR_CLEARANCE = 2 * STANDOFF + ARROW_SIZE * 0.3 + 100;
export const PROPERTY_CONNECTOR_CLEARANCE =
  2 * 18 + 2 * Math.max(80, ARROW_GAP + ARROW_SIZE * 0.3);