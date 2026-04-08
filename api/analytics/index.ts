import { createClient, type Client, type InStatement } from "@libsql/client/web";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const ANALYTICS_EVENTS = [
  "game_start",
  "game_end",
  "turn",
  "encounter",
  "rumor",
  "relic",
  "death",
  "win",
] as const;

type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

let client: Client | null = null;

function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not configured.");
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

export function setDbClientForTesting(nextClient: Client | null): void {
  client = nextClient;
}

export async function ensureTable(db: Pick<Client, "execute">): Promise<void> {
  await db.execute(
    `
      CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        event TEXT NOT NULL CHECK (event IN ('game_start', 'game_end', 'turn', 'encounter', 'rumor', 'relic', 'death', 'win')),
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    ` as InStatement,
  );

  await db.execute(
    "CREATE INDEX IF NOT EXISTS analytics_session_id_idx ON analytics (session_id)" as InStatement,
  );
  await db.execute(
    "CREATE INDEX IF NOT EXISTS analytics_event_idx ON analytics (event)" as InStatement,
  );
}

function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  return typeof value === "string" && ANALYTICS_EVENTS.includes(value as AnalyticsEvent);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { sessionId, event, data } = req.body ?? {};
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    res.status(400).json({ error: "Missing sessionId" });
    return;
  }
  if (!isAnalyticsEvent(event)) {
    res.status(400).json({ error: "Invalid event" });
    return;
  }

  try {
    const db = getDb();
    await ensureTable(db);
    await db.execute({
      sql: "INSERT INTO analytics (session_id, event, data) VALUES (?, ?, ?)",
      args: [sessionId, event, JSON.stringify(data ?? {})],
    });
  } catch {
    // Analytics must remain non-blocking.
  }

  res.status(200).json({ ok: true });
}
