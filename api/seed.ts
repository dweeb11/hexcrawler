import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type Client, type InStatement } from "@libsql/client/web";
import type { VercelRequest, VercelResponse } from "@vercel/node";

let client: Client | null = null;

function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not configured.");
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

async function ensureTable(db: Client): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS encounters (
      id TEXT PRIMARY KEY, text TEXT NOT NULL, required_tags TEXT NOT NULL,
      biomes TEXT, choices TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  ` as InStatement);
}

function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  const expectedKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers["x-api-key"];
  const apiKey = Array.isArray(providedKey) ? providedKey[0] : providedKey;
  if (!expectedKey) {
    res.status(500).json({ error: "Server misconfigured: ADMIN_API_KEY is missing." });
    return false;
  }
  if (!apiKey) { res.status(401).json({ error: "Unauthorized" }); return false; }
  const left = Buffer.from(apiKey);
  const right = Buffer.from(expectedKey);
  const size = Math.max(left.length, right.length);
  const a = Buffer.alloc(size); left.copy(a);
  const b = Buffer.alloc(size); right.copy(b);
  if (left.length !== right.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

interface SeedEncounter {
  id: string;
  text: string;
  requiredTags: string[];
  biomes?: string[];
  choices: { label: string; outcome: Record<string, unknown> }[];
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!requireAuth(req, res)) return;

  try {
    const seedPath = join(process.cwd(), "src", "engine", "data", "seed-encounters.json");
    const seedEncounters: SeedEncounter[] = JSON.parse(readFileSync(seedPath, "utf-8"));

    const db = getDb();
    await ensureTable(db);

    let inserted = 0;
    for (const encounter of seedEncounters) {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO encounters (id, text, required_tags, biomes, choices) VALUES (?, ?, ?, ?, ?)`,
        args: [
          encounter.id,
          encounter.text,
          JSON.stringify(encounter.requiredTags),
          encounter.biomes ? JSON.stringify(encounter.biomes) : null,
          JSON.stringify(encounter.choices),
        ],
      });
      inserted += Number(result.rowsAffected ?? 0);
    }

    res.status(200).json({ inserted, total: seedEncounters.length });
  } catch (err) {
    console.error("seed error:", err);
    res.status(500).json({ error: String(err) });
  }
}
