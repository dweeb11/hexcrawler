import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAnalyticsClient } from "../../src/api/analytics";

describe("analytics client", () => {
  const fetchMock = vi.fn();
  const sendBeaconMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    sendBeaconMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses sendBeacon when available", () => {
    sendBeaconMock.mockReturnValue(true);
    Object.defineProperty(globalThis, "navigator", {
      value: { sendBeacon: sendBeaconMock },
      configurable: true,
      writable: true,
    });

    const analytics = createAnalyticsClient("session-1");
    analytics.track("game_start", { seed: 123 });

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to fetch when sendBeacon fails", () => {
    sendBeaconMock.mockReturnValue(false);
    fetchMock.mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, "navigator", {
      value: { sendBeacon: sendBeaconMock },
      configurable: true,
      writable: true,
    });

    const analytics = createAnalyticsClient("session-2");
    analytics.track("turn", { turnCount: 3 });

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );
  });

  it("never throws if fetch rejects", () => {
    fetchMock.mockRejectedValue(new Error("network"));
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });

    const analytics = createAnalyticsClient("session-3");
    expect(() => analytics.track("encounter", { encounterId: "e1" })).not.toThrow();
  });
});
