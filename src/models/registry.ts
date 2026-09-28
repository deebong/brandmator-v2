import type { ModelMeta, ModelId, NamingModel } from "./contract";
import { MODEL_1 } from "./model1-fusion";
import { MODEL_2 } from "./model2-spelling";
import { MODEL_3 } from "./model3-prefix";
import { MODEL_4 } from "./model4-semantic";
import { MODEL_5 } from "./model5-experimental";

export const MODEL_METADATA: ModelMeta[] = [
  {
    id: "m0",
    name: "Model 0 · Blend All",
    short: "Blend All",
    description: "Explores all available naming models and mixes their strongest candidates.",
    family: "blend"
  },
  MODEL_1,
  MODEL_2,
  MODEL_3,
  MODEL_4,
  MODEL_5
];

export const MODEL_REGISTRY: NamingModel[] = [MODEL_1, MODEL_2, MODEL_3, MODEL_4, MODEL_5];

export const NAMING_MODELS = MODEL_METADATA;
export const getModel = (id: Exclude<ModelId, "m0">) => MODEL_REGISTRY.find(model => model.id === id) || MODEL_1;
