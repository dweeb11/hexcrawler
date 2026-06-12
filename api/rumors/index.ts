import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, ensureTable, requireAuth, rowToRumor } from "../_lib/rumors";

export { getDb, setDbClientForTesting } from "../_lib/rumors";

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
