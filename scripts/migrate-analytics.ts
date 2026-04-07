/**
 * Creates analytics table and indexes in Turso/libSQL.
 * Usage:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate-analytics.ts
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  throw new Error("TURSO_DATABASE_URL is required.");
}

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

await db.execute(`
  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    event TEXT NOT NULL CHECK (event IN ('game_start', 'game_end', 'turn', 'encounter', 'rumor', 'relic', 'death', 'win')),
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

await db.execute("CREATE INDEX IF NOT EXISTS analytics_session_id_idx ON analytics (session_id)");
await db.execute("CREATE INDEX IF NOT EXISTS analytics_event_idx ON analytics (event)");

console.log("Analytics migration complete.");
