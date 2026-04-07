import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("@libsql/client/web", () => ({
  createClient: () => ({ execute }),
}));

vi.stubEnv("TURSO_DATABASE_URL", "libsql://test.turso.io");

function createResponse() {
  return {
    statusCode: 200,
    jsonBody: undefined as unknown,
    ended: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.jsonBody = body;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

describe("POST /api/analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    execute.mockReset();
    execute
      .mockResolvedValueOnce({ rows: [] }) // ensureTable
      .mockResolvedValueOnce({ rows: [] }) // analytics_session_id_idx
      .mockResolvedValueOnce({ rows: [] }); // analytics_event_idx
  });

  it("accepts a valid game_end event", async () => {
    const handler = (await import("../../api/analytics/index")).default;
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    const res = createResponse();
    await handler(
      {
        method: "POST",
        body: {
          sessionId: "abc-123",
          event: "game_end",
          data: {
            outcome: "win_pillars",
            turnCount: 42,
            hexesExplored: 28,
          },
        },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("rejects events without sessionId", async () => {
    const handler = (await import("../../api/analytics/index")).default;

    const res = createResponse();
    await handler(
      {
        method: "POST",
        body: { event: "game_end", data: {} },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: "Missing sessionId" });
  });

  it("rejects invalid event names", async () => {
    const handler = (await import("../../api/analytics/index")).default;

    const res = createResponse();
    await handler(
      {
        method: "POST",
        body: { sessionId: "abc-123", event: "unknown", data: {} },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: "Invalid event" });
  });

  it("rejects non-POST methods", async () => {
    const handler = (await import("../../api/analytics/index")).default;

    const res = createResponse();
    await handler({ method: "GET" } as never, res as never);

    expect(res.statusCode).toBe(405);
  });

  it("silently handles database errors without exposing details", async () => {
    const handler = (await import("../../api/analytics/index")).default;
    execute.mockRejectedValueOnce(new Error("DB connection failed"));

    const res = createResponse();
    await handler(
      {
        method: "POST",
        body: {
          sessionId: "abc-123",
          event: "game_end",
          data: { outcome: "loss_health" },
        },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true });
  });
});
