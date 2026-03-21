import type { VercelRequest, VercelResponse } from "@vercel/node";

import seedEncounters from "../src/engine/data/seed-encounters.json";
import { requireAuth } from "./lib/auth";
import { ensureTable, getDb } from "./lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!requireAuth(req, res)) {
    return;
  }

  const db = getDb();
  await ensureTable(db);

  let inserted = 0;
  for (const encounter of seedEncounters) {
    const result = await db.execute({
      sql: `
        INSERT OR IGNORE INTO encounters (id, text, required_tags, biomes, choices)
        VALUES (?, ?, ?, ?, ?)
      `,
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
}
