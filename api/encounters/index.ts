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

function listRows(result: { rows: Row[] }) {
  return result.rows.map(rowToEncounter);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const db = getDb();
  await ensureTable(db);

  if (req.method === "GET") {
    const result = await db.execute("SELECT * FROM encounters ORDER BY id");
    res.status(200).json(listRows(result));
    return;
  }

  if (req.method === "POST") {
    if (!requireAuth(req, res)) {
      return;
    }

    const { id, text, requiredTags, biomes, choices } = req.body ?? {};
    if (!id || !text || !Array.isArray(requiredTags) || !Array.isArray(choices)) {
      res.status(400).json({
        error: "Missing required fields: id, text, requiredTags, choices",
      });
      return;
    }

    await db.execute({
      sql: `
        INSERT INTO encounters (id, text, required_tags, biomes, choices)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        id,
        text,
        JSON.stringify(requiredTags),
        biomes ? JSON.stringify(biomes) : null,
        JSON.stringify(choices),
      ],
    });

    res.status(201).json({ id });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
