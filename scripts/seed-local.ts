/**
 * Seeds the local SQLite database with encounter data from seed-encounters.json.
 * Used by worktree-setup.sh when no Turso credentials are available.
 */
import { createClient } from "@libsql/client";
import seedEncounters from "../src/engine/data/seed-encounters.json";

const db = createClient({ url: "file:local.db" });

await db.execute(`
  CREATE TABLE IF NOT EXISTS encounters (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    required_tags TEXT NOT NULL,
    biomes TEXT,
    choices TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const existing = await db.execute("SELECT COUNT(*) as count FROM encounters");
const existingCount = Number(existing.rows[0].count);

let inserted = 0;
for (const encounter of seedEncounters) {
  const result = await db.execute({
    sql: `INSERT OR IGNORE INTO encounters (id, text, required_tags, biomes, choices) VALUES (?, ?, ?, ?, ?)`,
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

const total = existingCount + inserted;
if (inserted === 0 && existingCount >= seedEncounters.length) {
  console.log(`local.db already has all ${existingCount} encounters — nothing to seed.`);
} else {
  console.log(`Seeded ${inserted} new encounters into local.db (${total} total).`);
}
