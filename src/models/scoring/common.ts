import { shapeMetrics } from "./shape";

export function scoringText(name: string) {
  const shape = shapeMetrics(name);
  return shape;
}
