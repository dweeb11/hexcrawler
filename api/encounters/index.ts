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
    CREATE TABLE IF NOT EXISTS encounters (
      id TEXT PRIMARY KEY, text TEXT NOT NULL, required_tags TEXT NOT NULL,
      biomes TEXT, choices TEXT NOT NULL,
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

function rowToEncounter(row: Row) {
  return {
    id: String(row.id),
    text: String(row.text),
    requiredTags: JSON.parse(String(row.required_tags)),
    biomes: row.biomes ? JSON.parse(String(row.biomes)) : undefined,
    choices: JSON.parse(String(row.choices)),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const db = getDb();
  await ensureTable(db);

  if (req.method === "GET") {
    const result = await db.execute("SELECT * FROM encounters ORDER BY id");
    res.status(200).json(result.rows.map(rowToEncounter));
    return;
  }

  if (req.method === "POST") {
    if (!requireAuth(req, res)) return;
    const { id, text, requiredTags, biomes, choices } = req.body ?? {};
    if (!id || !text || !Array.isArray(requiredTags) || !Array.isArray(choices)) {
      res.status(400).json({ error: "Missing required fields: id, text, requiredTags, choices" });
      return;
    }
    await db.execute({
      sql: `INSERT INTO encounters (id, text, required_tags, biomes, choices) VALUES (?, ?, ?, ?, ?)`,
      args: [id, text, JSON.stringify(requiredTags), biomes ? JSON.stringify(biomes) : null, JSON.stringify(choices)],
    });
    res.status(201).json({ id });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
