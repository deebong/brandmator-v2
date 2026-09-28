// Backward-compatible facade. New naming models live in /src/models.
export {
  NAMING_MODELS,
  MODEL_METADATA,
  MODEL_REGISTRY,
  getModel
} from "../models/registry";
export type {
  ModelId,
  ModelFamily,
  NamingModel,
  ModelMeta,
  ModelContext,
  ModelCandidate,
  ModelScore,
  GeneratedEvidence
} from "../models/contract";
