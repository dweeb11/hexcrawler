const ANALYTICS_ENDPOINT = "/api/analytics";

export type AnalyticsEvent =
  | "game_start"
  | "game_end"
  | "turn"
  | "encounter"
  | "rumor"
  | "relic"
  | "death"
  | "win";

interface AnalyticsPayload {
  sessionId: string;
  event: AnalyticsEvent;
  data: Record<string, unknown>;
}

export interface AnalyticsClient {
  readonly sessionId: string;
  track(event: AnalyticsEvent, data?: Record<string, unknown>): void;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function sendWithBeacon(payload: string): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }

  try {
    const body = typeof Blob !== "undefined"
      ? new Blob([payload], { type: "application/json" })
      : payload;
    return navigator.sendBeacon(ANALYTICS_ENDPOINT, body);
  } catch {
    return false;
  }
}

function sendWithFetch(payload: string): void {
  if (typeof fetch !== "function") {
    return;
  }

  fetch(ANALYTICS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Analytics is strictly fire-and-forget.
  });
}

export function createAnalyticsClient(sessionId = createSessionId()): AnalyticsClient {
  return {
    sessionId,
    track(event, data = {}) {
      const payload: AnalyticsPayload = { sessionId, event, data };
      const body = JSON.stringify(payload);
      if (!sendWithBeacon(body)) {
        sendWithFetch(body);
      }
    },
  };
}
