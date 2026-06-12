import { timingSafeEqual } from "node:crypto";
import { createClient, type Client, type Row, type InStatement } from "@libsql/client/web";
import type { VercelRequest, VercelResponse } from "@vercel/node";

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

export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  const expectedKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers["x-api-key"];
  const apiKey = Array.isArray(providedKey) ? providedKey[0] : providedKey;
  if (!expectedKey) {
    res.status(500).json({ error: "Server misconfigured: ADMIN_API_KEY is missing." });
    return false;
  }
  if (!apiKey) { res.status(401).json({ error: "Unauthorized" }); return false; }
  const provided = Buffer.from(apiKey);
  const expected = Buffer.from(expectedKey);
  const size = Math.max(provided.length, expected.length);
  const a = Buffer.alloc(size);
  const b = Buffer.alloc(size);
  provided.copy(a);
  expected.copy(b);
  // Always call timingSafeEqual before checking length — this ensures the
  // comparison takes the same time regardless of key length, preventing
  // a timing oracle that would reveal whether the submitted key length matches.
  const valuesMatch = timingSafeEqual(a, b);
  const lengthMatch = provided.length === expected.length;
  if (!valuesMatch || !lengthMatch) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
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
