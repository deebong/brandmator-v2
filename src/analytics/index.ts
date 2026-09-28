import type { AnalyticsEvent, AnalyticsEventName, AnalyticsSink } from "./types";

let sink: AnalyticsSink = () => {};
const sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);

export function configureAnalytics(nextSink: AnalyticsSink) {
  sink = nextSink;
}

export function track(name: AnalyticsEventName, payload: AnalyticsEvent["payload"] = {}) {
  sink({
    name,
    timestamp: new Date().toISOString(),
    sessionId,
    payload
  });
}

export type { AnalyticsEvent, AnalyticsEventName, AnalyticsSink } from "./types";
