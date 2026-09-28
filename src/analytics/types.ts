export type AnalyticsEventName =
  | "generate"
  | "model_change"
  | "candidate_mode_change"
  | "recipe_change"
  | "style_change"
  | "sort_change"
  | "brief_submit"
  | "result_save"
  | "tld_change";

export type AnalyticsEvent = {
  name: AnalyticsEventName;
  timestamp: string;
  sessionId: string;
  payload: Record<string, string | number | boolean | string[]>;
};

export type AnalyticsSink = (event: AnalyticsEvent) => void;
