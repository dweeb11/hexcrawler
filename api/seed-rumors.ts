import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, ensureTable, type ApiRumorStep } from "./_lib/rumors.js";
import { requireAuth } from "./_lib/auth.js";
import rumorsSeed from "../src/engine/data/rumors-seed.json";

interface SeedRumor {
  id: string;
  title: string;
  premise: string;
  steps: ApiRumorStep[];
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
    const seedRumors = rumorsSeed as SeedRumor[];
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
