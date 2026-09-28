import { analyzeNameShape } from "../../lib/quality";

export function shapeMetrics(name: string) {
  const shape = analyzeNameShape(name);
  const flow = Math.max(0, Math.min(100, Math.round(
    50 +
    shape.phoneticScore * 2.4 +
    (shape.transitionDensity >= 0.34 && shape.transitionDensity <= 0.84 ? 16 : 0) -
    shape.clusterPenalty * 2 -
    shape.vowelFlowPenalty * 2
  )));

  const pronounceability = Math.max(0, Math.min(100, Math.round(
    52 +
    flow * 0.35 +
    (shape.syllables >= 2 && shape.syllables <= 3 ? 15 : shape.syllables === 1 ? 7 : -10) +
    (shape.maxConsonantRun <= 2 ? 10 : -16)
  )));

  const pattern = Math.max(0, Math.min(100, Math.round(
    45 +
    shape.patternScore * 2.4 +
    (shape.maxConsonantRun <= 2 ? 12 : -12)
  )));

  return {
    flow,
    pronounceability,
    pattern,
    vowelRatio: shape.vowelRatio,
    syllables: shape.syllables
  };
}
