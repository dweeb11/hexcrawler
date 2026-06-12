import { beforeEach, describe, expect, it, vi } from "vitest";
import rumorsSeed from "../../src/engine/data/rumors-seed.json";

const execute = vi.fn();

vi.mock("@libsql/client/web", () => ({
  createClient: () => ({ execute }),
}));

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

describe("rumor API routes", () => {
  beforeEach(() => {
    vi.resetModules();
    execute.mockReset();
    execute.mockResolvedValueOnce({ rows: [] });
  });

  it("lists rumors from GET /api/rumors", async () => {
    const handler = (await import("../../api/rumors/index")).default;
    execute.mockResolvedValueOnce({
      rows: [
        {
          id: "whispering-well",
          title: "The Whispering Well",
          premise: "A well whispers.",
          steps: JSON.stringify([
            {
              stepIndex: 0,
              stepTitle: "Forest Marker",
              encounterId: "ww-step-0",
              journalHint: "Seek water.",
              hintTags: ["water"],
            },
          ]),
          reward_id: "well-sigil",
          hope_bonus: 3,
        },
      ],
    });

    const res = createResponse();
    await handler({ method: "GET" } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual([
      {
        id: "whispering-well",
        title: "The Whispering Well",
        premise: "A well whispers.",
        steps: [
          {
            stepIndex: 0,
            stepTitle: "Forest Marker",
            encounterId: "ww-step-0",
            journalHint: "Seek water.",
            hintTags: ["water"],
          },
        ],
        rewardId: "well-sigil",
        hopeBonus: 3,
      },
    ]);
  });

  it("creates rumors through POST /api/rumors", async () => {
    const handler = (await import("../../api/rumors/index")).default;
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    const res = createResponse();
    await handler(
      {
        method: "POST",
        headers: { "x-api-key": "test-key" },
        body: {
          id: "new-rumor",
          title: "New Chain",
          premise: "A hook.",
          steps: [
            {
              stepIndex: 0,
              stepTitle: "Start",
              encounterId: "new-step-0",
              journalHint: "Go east.",
              hintTags: ["road"],
            },
          ],
          rewardId: "well-sigil",
          hopeBonus: 2,
        },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(201);
    expect(res.jsonBody).toEqual({ id: "new-rumor" });
  });

  it("returns single rumors from GET /api/rumors/[id]", async () => {
    const handler = (await import("../../api/rumors/[id]")).default;
    execute.mockResolvedValueOnce({
      rows: [
        {
          id: "whispering-well",
          title: "The Whispering Well",
          premise: "",
          steps: "[]",
          reward_id: null,
          hope_bonus: 0,
        },
      ],
    });

    const res = createResponse();
    await handler({ method: "GET", query: { id: "whispering-well" } } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toMatchObject({ id: "whispering-well" });
  });

  it("updates rumors through PUT /api/rumors/[id]", async () => {
    const handler = (await import("../../api/rumors/[id]")).default;
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    const res = createResponse();
    await handler(
      {
        method: "PUT",
        headers: { "x-api-key": "test-key" },
        query: { id: "whispering-well" },
        body: {
          title: "Updated Well",
          premise: "Updated premise.",
          steps: [],
          hopeBonus: 1,
        },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ id: "whispering-well" });
  });

  it("deletes rumors through DELETE /api/rumors/[id]", async () => {
    const handler = (await import("../../api/rumors/[id]")).default;
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    const res = createResponse();
    await handler(
      {
        method: "DELETE",
        headers: { "x-api-key": "test-key" },
        query: { id: "whispering-well" },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
  });

  it("seeds bundled rumors through POST /api/seed-rumors", async () => {
    const handler = (await import("../../api/seed-rumors")).default;
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
    expect(res.jsonBody).toMatchObject({ total: rumorsSeed.length });
  });
});
