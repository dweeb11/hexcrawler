import type { Row } from "@libsql/client/web";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureTable } from "./index";
import { getDb, requireAuth } from "../encounters/index";

interface StatsResponse {
  totalGames: number;
  outcomes: Array<{ outcome: string; count: number }>;
  avgTurnCount: number;
  rumorCompletions: Array<{ rumorId: string; count: number }>;
}

function numberFromRowValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!requireAuth(req, res)) {
    return;
  }

  try {
    const db = getDb();
    await ensureTable(db);

    const [totalGamesResult, outcomesResult, avgTurnsResult, rumorsResult] = await Promise.all([
      db.execute(
        "SELECT COUNT(DISTINCT session_id) AS count FROM analytics WHERE event = 'game_end'",
      ),
      db.execute(
        "SELECT json_extract(data, '$.outcome') AS outcome, COUNT(*) AS count FROM analytics WHERE event = 'game_end' GROUP BY outcome ORDER BY count DESC",
      ),
      db.execute(
        "SELECT AVG(CAST(json_extract(data, '$.turnCount') AS REAL)) AS avg FROM analytics WHERE event = 'game_end'",
      ),
      db.execute(
        "SELECT json_extract(data, '$.rumorId') AS rumorId, COUNT(*) AS count FROM analytics WHERE event = 'rumor' GROUP BY rumorId ORDER BY count DESC",
      ),
    ]);

    const response: StatsResponse = {
      totalGames: numberFromRowValue(totalGamesResult.rows[0]?.count),
      outcomes: outcomesResult.rows.map((row: Row) => ({
        outcome: row.outcome == null ? "unknown" : String(row.outcome),
        count: numberFromRowValue(row.count),
      })),
      avgTurnCount: numberFromRowValue(avgTurnsResult.rows[0]?.avg),
      rumorCompletions: rumorsResult.rows.map((row: Row) => ({
        rumorId: row.rumorId == null ? "unknown" : String(row.rumorId),
        count: numberFromRowValue(row.count),
      })),
    };

    res.status(200).json(response);
  } catch {
    res.status(500).json({ error: "Failed to fetch analytics stats" });
  }
}
