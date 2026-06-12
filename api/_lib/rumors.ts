import { createClient, type Client, type Row, type InStatement } from "@libsql/client/web";

let client: Client | null = null;

export function getDb(): Client {
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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS rumors (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      premise TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL,
      reward_id TEXT,
      hope_bonus INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  ` as InStatement);
}

export function rowToRumor(row: Row) {
  return {
    id: String(row.id),
    title: String(row.title),
    premise: String(row.premise ?? ""),
    steps: JSON.parse(String(row.steps)),
    rewardId: row.reward_id ? String(row.reward_id) : null,
    hopeBonus: Number(row.hope_bonus ?? 0),
  };
}

export interface ApiRumorStep {
  stepIndex: number;
  stepTitle?: string;
  encounterId: string;
  journalHint?: string;
  hintTags: string[];
  hintBiomes?: string[];
}
