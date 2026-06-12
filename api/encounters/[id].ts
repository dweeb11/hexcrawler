import { createClient, type Client, type Row, type InStatement } from "@libsql/client/web";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../_lib/auth";

export { requireAuth } from "../_lib/auth";

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
  const id = String(req.query.id);

  if (req.method === "GET") {
    const result = await db.execute({ sql: "SELECT * FROM encounters WHERE id = ?", args: [id] });
    if (result.rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.status(200).json(rowToEncounter(result.rows[0] as Row));
    return;
  }

  if (req.method === "PUT") {
    if (!requireAuth(req, res)) return;
    const { text, requiredTags, biomes, choices } = req.body ?? {};
    if (!text || !Array.isArray(requiredTags) || !Array.isArray(choices)) {
      res.status(400).json({ error: "Missing required fields: text, requiredTags, choices" });
      return;
    }
    await db.execute({
      sql: `UPDATE encounters SET text = ?, required_tags = ?, biomes = ?, choices = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [text, JSON.stringify(requiredTags), biomes ? JSON.stringify(biomes) : null, JSON.stringify(choices), id],
    });
    res.status(200).json({ id });
    return;
  }

  if (req.method === "DELETE") {
    if (!requireAuth(req, res)) return;
    await db.execute({ sql: "DELETE FROM encounters WHERE id = ?", args: [id] });
    res.status(204).end();
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
