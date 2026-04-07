import type { InStatement } from "@libsql/client/web";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, requireAuth } from "./encounters/index";

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
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!requireAuth(req, res)) return;

  try {
    await ensurePlaytestsTable();
    const db = getDb();

    const [totalsResult, deathsResult, biomesResult, rumorsResult] = await Promise.all([
      db.execute(`
        SELECT
          COUNT(*) AS total_games,
          SUM(CASE WHEN outcome = 'won' THEN 1 ELSE 0 END) AS wins,
          SUM(CASE WHEN outcome = 'lost' THEN 1 ELSE 0 END) AS losses,
          ROUND(AVG(turns_survived), 1) AS avg_turns
        FROM playtests
      `),
      db.execute(`
        SELECT death_cause, COUNT(*) AS count
        FROM playtests
        WHERE outcome = 'lost' AND death_cause IS NOT NULL
        GROUP BY death_cause
        ORDER BY count DESC
      `),
      db.execute(`
        SELECT biomes_visited FROM playtests WHERE biomes_visited != '[]'
      `),
      db.execute(`
        SELECT
          SUM(rumors_completed) AS total_rumors_completed,
          COUNT(*) AS total_games
        FROM playtests
      `),
    ]);

    const totals = totalsResult.rows[0];

    const deathCauses: Record<string, number> = {};
    for (const row of deathsResult.rows) {
      const cause = row.death_cause as string;
      deathCauses[cause] = (row.count as number);
    }

    const biomeCounts: Record<string, number> = {};
    for (const row of biomesResult.rows) {
      try {
        const biomes = JSON.parse(row.biomes_visited as string) as string[];
        for (const biome of biomes) {
          biomeCounts[biome] = (biomeCounts[biome] ?? 0) + 1;
        }
      } catch {
        // skip malformed rows
      }
    }

    const sortedBiomes = Object.entries(biomeCounts).sort((a, b) => b[1] - a[1]);
    const rumorRow = rumorsResult.rows[0];
    const totalGames = (rumorRow?.total_games as number) ?? 0;
    const avgRumors = totalGames > 0
      ? Math.round(((rumorRow?.total_rumors_completed as number) ?? 0) / totalGames * 10) / 10
      : 0;

    res.status(200).json({
      totalGames: totals?.total_games ?? 0,
      wins: totals?.wins ?? 0,
      losses: totals?.losses ?? 0,
      avgTurnsSurvived: totals?.avg_turns ?? 0,
      deathCauses,
      biomesByFrequency: sortedBiomes,
      avgRumorsCompleted: avgRumors,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
}
