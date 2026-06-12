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

interface SeedRumor {
  id: string;
  title: string;
  premise: string;
  steps: unknown[];
  rewardId: string | null;
  hopeBonus: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!requireAuth(req, res)) return;

  try {
    const seedPath = join(process.cwd(), "src", "engine", "data", "rumors-seed.json");
    const seedRumors: SeedRumor[] = JSON.parse(readFileSync(seedPath, "utf-8"));

    const db = getDb();
    await ensureTable(db);

    let inserted = 0;
    for (const rumor of seedRumors) {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO rumors (id, title, premise, steps, reward_id, hope_bonus) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          rumor.id,
          rumor.title,
          rumor.premise ?? "",
          JSON.stringify(rumor.steps),
          rumor.rewardId ?? null,
          rumor.hopeBonus ?? 0,
        ],
      });
      inserted += Number(result.rowsAffected ?? 0);
    }

    res.status(200).json({ inserted, total: seedRumors.length });
  } catch (err) {
    console.error("seed-rumors error:", err);
    res.status(500).json({ error: String(err) });
  }
}
