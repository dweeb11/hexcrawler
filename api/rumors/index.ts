import { timingSafeEqual } from "node:crypto";
import { createClient, type Client, type Row, type InStatement } from "@libsql/client/web";
import type { VercelRequest, VercelResponse } from "@vercel/node";

let client: Client | null = null;

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not configured.");
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

export function setDbClientForTesting(nextClient: Client | null): void {
  client = nextClient;
}

export async function ensureTable(db: Pick<Client, "execute">): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS rumors (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      premise TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL,
      reward_id TEXT,
      hope_bonus INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  ` as InStatement);
}

function normalizeBuffers(a: string, b: string): [Buffer, Buffer, boolean] {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length === right.length) return [left, right, true];
  const size = Math.max(left.length, right.length);
  const paddedLeft = Buffer.alloc(size); left.copy(paddedLeft);
  const paddedRight = Buffer.alloc(size); right.copy(paddedRight);
  return [paddedLeft, paddedRight, false];
}

export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  const expectedKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers["x-api-key"];
  const apiKey = Array.isArray(providedKey) ? providedKey[0] : providedKey;
  if (!expectedKey) {
    res.status(500).json({ error: "Server misconfigured: ADMIN_API_KEY is missing." });
    return false;
  }
  if (!apiKey) { res.status(401).json({ error: "Unauthorized" }); return false; }
  const [left, right, sameLength] = normalizeBuffers(apiKey, expectedKey);
  if (!sameLength || !timingSafeEqual(left, right)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function rowToRumor(row: Row) {
  return {
    id: String(row.id),
    title: String(row.title),
    premise: String(row.premise ?? ""),
    steps: JSON.parse(String(row.steps)),
    rewardId: row.reward_id ? String(row.reward_id) : null,
    hopeBonus: Number(row.hope_bonus ?? 0),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const db = getDb();
  await ensureTable(db);

  if (req.method === "GET") {
    const result = await db.execute("SELECT * FROM rumors ORDER BY id");
    res.status(200).json(result.rows.map(rowToRumor));
    return;
  }

  if (req.method === "POST") {
    if (!requireAuth(req, res)) return;
    const { id, title, premise, steps, rewardId, hopeBonus } = req.body ?? {};
    if (!id || !title || !Array.isArray(steps)) {
      res.status(400).json({ error: "Missing required fields: id, title, steps" });
      return;
    }
    await db.execute({
      sql: `INSERT INTO rumors (id, title, premise, steps, reward_id, hope_bonus) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        title,
        premise ?? "",
        JSON.stringify(steps),
        rewardId ?? null,
        hopeBonus ?? 0,
      ],
    });
    res.status(201).json({ id });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
