import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("@libsql/client/web", () => ({
  createClient: () => ({ execute }),
}));

vi.stubEnv("TURSO_DATABASE_URL", "libsql://test.turso.io");
vi.stubEnv("ADMIN_API_KEY", "test-key");

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

describe("GET /api/analytics/stats", () => {
  beforeEach(() => {
    vi.resetModules();
    execute.mockReset();
    execute
      .mockResolvedValueOnce({ rows: [] }) // ensureTable
      .mockResolvedValueOnce({ rows: [] }) // analytics_session_id_idx
      .mockResolvedValueOnce({ rows: [] }); // analytics_event_idx
  });

  it("returns aggregated analytics for authorized requests", async () => {
    const handler = (await import("../../api/analytics/stats")).default;
    execute
      .mockResolvedValueOnce({ rows: [{ count: 8 }] })
      .mockResolvedValueOnce({
        rows: [
          { outcome: "won", count: 5 },
          { outcome: "lost", count: 3 },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ avg: 27.25 }] })
      .mockResolvedValueOnce({
        rows: [
          { rumorId: "old-watchtower", count: 6 },
          { rumorId: "buried-gears", count: 2 },
        ],
      });

    const res = createResponse();
    await handler(
      {
        method: "GET",
        headers: { "x-api-key": "test-key" },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({
      totalGames: 8,
      outcomes: [
        { outcome: "won", count: 5 },
        { outcome: "lost", count: 3 },
      ],
      avgTurnCount: 27.25,
      rumorCompletions: [
        { rumorId: "old-watchtower", count: 6 },
        { rumorId: "buried-gears", count: 2 },
      ],
    });
    expect(execute).toHaveBeenCalledTimes(7);
  });

  it("requires admin auth", async () => {
    const handler = (await import("../../api/analytics/stats")).default;

    const res = createResponse();
    await handler(
      {
        method: "GET",
        headers: {},
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(401);
    expect(res.jsonBody).toEqual({ error: "Unauthorized" });
  });

  it("rejects non-GET methods", async () => {
    const handler = (await import("../../api/analytics/stats")).default;

    const res = createResponse();
    await handler(
      {
        method: "POST",
        headers: { "x-api-key": "test-key" },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(405);
    expect(res.jsonBody).toEqual({ error: "Method not allowed" });
  });
});
