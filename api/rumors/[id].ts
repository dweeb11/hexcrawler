import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, ensureTable, rowToRumor } from "../_lib/rumors";
import { requireAuth } from "../_lib/auth";
import type { Row } from "@libsql/client/web";

export { getDb, setDbClientForTesting } from "../_lib/rumors";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const db = getDb();
  await ensureTable(db);
  const id = String(req.query.id);

  if (req.method === "GET") {
    const result = await db.execute({ sql: "SELECT * FROM rumors WHERE id = ?", args: [id] });
    if (result.rows.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.status(200).json(rowToRumor(result.rows[0] as Row));
    return;
  }

  if (req.method === "PUT") {
    if (!requireAuth(req, res)) return;
    const { title, premise, steps, rewardId, hopeBonus } = req.body ?? {};
    if (!title || !Array.isArray(steps)) {
      res.status(400).json({ error: "Missing required fields: title, steps" });
      return;
    }
    const result = await db.execute({
      sql: `UPDATE rumors SET title = ?, premise = ?, steps = ?, reward_id = ?, hope_bonus = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [
        title,
        premise ?? "",
        JSON.stringify(steps),
        rewardId ?? null,
        hopeBonus ?? 0,
        id,
      ],
    });
    if (!result.rowsAffected) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(200).json({ id });
    return;
  }

  if (req.method === "DELETE") {
    if (!requireAuth(req, res)) return;
    await db.execute({ sql: "DELETE FROM rumors WHERE id = ?", args: [id] });
    res.status(204).end();
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
