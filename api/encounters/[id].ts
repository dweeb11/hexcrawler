import type { Row } from "@libsql/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import { requireAuth } from "../lib/auth";
import { ensureTable, getDb } from "../lib/db";

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
    const result = await db.execute({
      sql: "SELECT * FROM encounters WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.status(200).json(rowToEncounter(result.rows[0] as Row));
    return;
  }

  if (req.method === "PUT") {
    if (!requireAuth(req, res)) {
      return;
    }

    const { text, requiredTags, biomes, choices } = req.body ?? {};
    if (!text || !Array.isArray(requiredTags) || !Array.isArray(choices)) {
      res.status(400).json({
        error: "Missing required fields: text, requiredTags, choices",
      });
      return;
    }

    await db.execute({
      sql: `
        UPDATE encounters
        SET text = ?, required_tags = ?, biomes = ?, choices = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [
        text,
        JSON.stringify(requiredTags ?? []),
        biomes ? JSON.stringify(biomes) : null,
        JSON.stringify(choices ?? []),
        id,
      ],
    });

    res.status(200).json({ id });
    return;
  }

  if (req.method === "DELETE") {
    if (!requireAuth(req, res)) {
      return;
    }

    await db.execute({
      sql: "DELETE FROM encounters WHERE id = ?",
      args: [id],
    });
    res.status(204).end();
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
