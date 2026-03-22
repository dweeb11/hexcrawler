import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

// Mock @libsql/client/web — the endpoint files import createClient from here
vi.mock("@libsql/client/web", () => ({
  createClient: () => ({ execute }),
}));

// Mock ADMIN_API_KEY for auth tests
vi.stubEnv("ADMIN_API_KEY", "test-key");
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

describe("encounter API routes", () => {
  beforeEach(() => {
    vi.resetModules();
    execute.mockReset();
    // ensureTable call
    execute.mockResolvedValueOnce({ rows: [] });
  });

  it("lists encounters from GET /api/encounters", async () => {
    const handler = (await import("../../api/encounters/index")).default;
    execute.mockResolvedValueOnce({
      rows: [
        {
          id: "forest-stream",
          text: "A clear stream",
          required_tags: '["water"]',
          biomes: '["forest"]',
          choices: '[{"label":"Drink","outcome":{"hope":2}}]',
        },
      ],
    });

    const res = createResponse();
    await handler({ method: "GET" } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual([
      {
        id: "forest-stream",
        text: "A clear stream",
        requiredTags: ["water"],
        biomes: ["forest"],
        choices: [{ label: "Drink", outcome: { hope: 2 } }],
      },
    ]);
  });

  it("creates encounters through POST /api/encounters", async () => {
    const handler = (await import("../../api/encounters/index")).default;
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    const res = createResponse();
    await handler(
      {
        method: "POST",
        headers: { "x-api-key": "test-key" },
        body: {
          id: "new-encounter",
          text: "Test",
          requiredTags: [],
          choices: [{ label: "OK", outcome: {} }],
        },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(201);
    expect(res.jsonBody).toEqual({ id: "new-encounter" });
  });

  it("returns single encounters from GET /api/encounters/[id]", async () => {
    const handler = (await import("../../api/encounters/[id]")).default;
    execute.mockResolvedValueOnce({
      rows: [
        {
          id: "forest-stream",
          text: "A clear stream",
          required_tags: '["water"]',
          biomes: null,
          choices: '[{"label":"Drink","outcome":{"hope":2}}]',
        },
      ],
    });

    const res = createResponse();
    await handler({ method: "GET", query: { id: "forest-stream" } } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toMatchObject({ id: "forest-stream" });
  });

  it("updates encounters through PUT /api/encounters/[id]", async () => {
    const handler = (await import("../../api/encounters/[id]")).default;
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    const res = createResponse();
    await handler(
      {
        method: "PUT",
        headers: { "x-api-key": "test-key" },
        query: { id: "forest-stream" },
        body: {
          text: "Updated stream",
          requiredTags: ["water"],
          choices: [{ label: "Drink", outcome: { hope: 1 } }],
        },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ id: "forest-stream" });
  });

  it("rejects PUT with missing required fields", async () => {
    const handler = (await import("../../api/encounters/[id]")).default;

    const res = createResponse();
    await handler(
      {
        method: "PUT",
        headers: { "x-api-key": "test-key" },
        query: { id: "forest-stream" },
        body: { text: "No tags or choices" },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: expect.stringContaining("Missing required fields") });
  });

  it("deletes encounters through DELETE /api/encounters/[id]", async () => {
    const handler = (await import("../../api/encounters/[id]")).default;
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    const res = createResponse();
    await handler(
      {
        method: "DELETE",
        headers: { "x-api-key": "test-key" },
        query: { id: "forest-stream" },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
  });

  it("seeds bundled encounters through POST /api/seed", async () => {
    const handler = (await import("../../api/seed")).default;
    execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    const res = createResponse();
    await handler(
      {
        method: "POST",
        headers: { "x-api-key": "test-key" },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toMatchObject({ total: 18 });
  });
});
