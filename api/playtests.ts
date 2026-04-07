import type { InStatement } from "@libsql/client/web";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "./encounters/index";

async function ensurePlaytestsTable(): Promise<void> {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS playtests (
      id TEXT PRIMARY KEY,
      outcome TEXT NOT NULL,
      turns_survived INTEGER NOT NULL,
      death_cause TEXT,
      biomes_visited TEXT NOT NULL DEFAULT '[]',
      rumors_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  ` as InStatement);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body as {
    outcome?: string;
    turnsSurvived?: number;
    deathCause?: string;
    biomesVisited?: string[];
    rumorsCompleted?: number;
  };

  if (!body.outcome || !["won", "lost"].includes(body.outcome)) {
    res.status(400).json({ error: "outcome must be 'won' or 'lost'" });
    return;
  }
  if (typeof body.turnsSurvived !== "number" || body.turnsSurvived < 0) {
    res.status(400).json({ error: "turnsSurvived must be a non-negative number" });
    return;
  }

  try {
    await ensurePlaytestsTable();
    const db = getDb();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await db.execute({
      sql: `INSERT INTO playtests (id, outcome, turns_survived, death_cause, biomes_visited, rumors_completed)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        body.outcome,
        body.turnsSurvived,
        body.deathCause ?? null,
        JSON.stringify(body.biomesVisited ?? []),
        body.rumorsCompleted ?? 0,
      ],
    });
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: "Failed to record playtest" });
  }
}
