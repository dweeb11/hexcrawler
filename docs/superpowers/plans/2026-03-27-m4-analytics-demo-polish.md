# M4: Analytics + Demo Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship-ready for friends and family. Lightweight analytics to learn from playtests. Difficulty tuning based on internal testing.

**Architecture:** Analytics adds a new Turso table, a serverless endpoint, and client-side event submission. The admin panel gets a stats view. Polish tasks are iterative — tune constants, fix edge cases, and do a final content pass.

**Tech Stack:** TypeScript, Turso, Vercel serverless, Vitest

**Design Spec:** `docs/superpowers/specs/2026-03-27-friends-family-demo-design.md` — Milestone 4 section

**Prerequisite:** M3 must be complete (win conditions, game feel, sound).

---

### Task 1: Analytics Turso Table

**Files:**
- Modify: `api/encounters/[id].ts` (reuse `ensureTable` pattern)
- Create: `api/analytics/index.ts`

- [ ] **Step 1: Write the analytics endpoint test**

```typescript
// tests/api/analytics.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("@libsql/client/web", () => ({
  createClient: () => ({ execute }),
}));

vi.stubEnv("TURSO_DATABASE_URL", "libsql://test.turso.io");

function createResponse() {
  return {
    statusCode: 200,
    jsonBody: undefined as unknown,
    ended: false,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.jsonBody = body; return this; },
    end() { this.ended = true; return this; },
  };
}

describe("POST /api/analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    execute.mockReset();
    execute.mockResolvedValueOnce({ rows: [] }); // ensureTable
  });

  it("accepts a valid game_end event", async () => {
    const handler = (await import("../../api/analytics/index")).default;
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    const res = createResponse();
    await handler(
      {
        method: "POST",
        body: {
          sessionId: "abc-123",
          event: "game_end",
          data: {
            outcome: "win_pillars",
            turnCount: 42,
            hexesExplored: 28,
          },
        },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(execute).toHaveBeenCalledTimes(2); // ensureTable + insert
  });

  it("rejects events without sessionId", async () => {
    const handler = (await import("../../api/analytics/index")).default;

    const res = createResponse();
    await handler(
      {
        method: "POST",
        body: { event: "game_end", data: {} },
      } as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
  });

  it("rejects non-POST methods", async () => {
    const handler = (await import("../../api/analytics/index")).default;

    const res = createResponse();
    await handler({ method: "GET" } as never, res as never);

    expect(res.statusCode).toBe(405);
  });

  it("silently handles database errors without exposing details", async () => {
    const handler = (await import("../../api/analytics/index")).default;
    execute.mockRejectedValueOnce(new Error("DB connection failed"));

    const res = createResponse();
    await handler(
      {
        method: "POST",
        body: {
          sessionId: "abc-123",
          event: "game_end",
          data: { outcome: "loss_health" },
        },
      } as never,
      res as never,
    );

    // Should still return 200 — analytics never block the client
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/analytics.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the analytics endpoint**

```typescript
// api/analytics/index.ts
import { createClient, type Client, type InStatement } from "@libsql/client/web";
import type { VercelRequest, VercelResponse } from "@vercel/node";

let client: Client | null = null;

function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not configured.");
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  return client;
}

async function ensureTable(db: Client): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      event TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  ` as InStatement);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { sessionId, event, data } = req.body ?? {};
  if (!sessionId || !event) {
    res.status(400).json({ error: "Missing sessionId or event" });
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
    // Analytics should never block the client — swallow errors silently
  }

  res.status(200).json({ ok: true });
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/api/analytics.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add api/analytics/index.ts tests/api/analytics.test.ts
git commit -m "feat: add analytics serverless endpoint with Turso storage"
```

---

### Task 2: Client-Side Analytics Submission

**Files:**
- Create: `src/api/analytics.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create the analytics client**

```typescript
// src/api/analytics.ts

let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

export function trackEvent(
  event: string,
  data: Record<string, unknown> = {}
): void {
  const payload = {
    sessionId: getSessionId(),
    event,
    data,
  };

  // Fire-and-forget — never await, never block gameplay
  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently ignore analytics failures
  });
}
```

- [ ] **Step 2: Integrate tracking calls into main.ts**

```typescript
import { trackEvent } from "./api/analytics";

// On game start:
trackEvent("game_start");

// On game end (win or loss):
trackEvent("game_end", {
  outcome: mode.outcome,  // "win_pillars" | "win_gear" | "loss_health" | "loss_hope" | "loss_searing"
  turnCount: state.turn,
  hexesExplored: state.stats.hexesExplored,
});

// On rumor discovered:
trackEvent("rumor_discovered", { rumorId, turn: state.turn });

// On rumor completed:
trackEvent("rumor_completed", { rumorId, turn: state.turn });

// On relic acquired:
trackEvent("relic_acquired", {
  relicId: relic.id,
  source: "rumor" | "encounter",
});
```

- [ ] **Step 3: Manually verify**

Run: `npm run dev` (with Vercel dev or local API)
Play through a game. Check the Turso database or API logs for analytics events.

- [ ] **Step 4: Commit**

```bash
git add src/api/analytics.ts src/main.ts
git commit -m "feat: add client-side analytics with fire-and-forget event tracking"
```

---

### Task 3: Admin Stats View

**Files:**
- Modify: `src/ui/admin.ts`
- Modify: `admin.html`

- [ ] **Step 1: Add a stats section to the admin panel**

Add a "Stats" tab/section to the admin UI that fetches analytics data and displays:

```typescript
async function loadStats(apiKey: string): Promise<void> {
  const res = await fetch("/api/analytics/stats", {
    headers: { "X-API-Key": apiKey },
  });
  if (!res.ok) return;
  const stats = await res.json();
  renderStats(stats);
}
```

- [ ] **Step 2: Create the stats API endpoint**

```typescript
// api/analytics/stats.ts
import { createClient, type Client, type InStatement } from "@libsql/client/web";
import type { VercelRequest, VercelResponse } from "@vercel/node";
// Import requireAuth from encounters API
import { requireAuth } from "../encounters/[id]";

// ... getDb, ensureTable ...

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!requireAuth(req, res)) return;

  const db = getDb();
  await ensureTable(db);

  const totalGames = await db.execute(
    "SELECT COUNT(DISTINCT session_id) as count FROM analytics WHERE event = 'game_end'"
  );

  const outcomes = await db.execute(
    "SELECT json_extract(data, '$.outcome') as outcome, COUNT(*) as count FROM analytics WHERE event = 'game_end' GROUP BY outcome"
  );

  const avgTurns = await db.execute(
    "SELECT AVG(CAST(json_extract(data, '$.turnCount') AS REAL)) as avg FROM analytics WHERE event = 'game_end'"
  );

  const rumorStats = await db.execute(
    "SELECT json_extract(data, '$.rumorId') as rumorId, COUNT(*) as count FROM analytics WHERE event = 'rumor_completed' GROUP BY rumorId ORDER BY count DESC"
  );

  res.status(200).json({
    totalGames: totalGames.rows[0]?.count ?? 0,
    outcomes: outcomes.rows.map((r) => ({ outcome: r.outcome, count: r.count })),
    avgTurnCount: avgTurns.rows[0]?.avg ?? 0,
    rumorCompletions: rumorStats.rows.map((r) => ({ rumorId: r.rumorId, count: r.count })),
  });
}
```

- [ ] **Step 3: Render stats in the admin panel**

Use DOM methods (no innerHTML) to create a simple table view:

```typescript
function renderStats(stats: StatsResponse): void {
  const container = document.getElementById("stats-container")!;
  container.textContent = "";

  const heading = document.createElement("h2");
  heading.textContent = "Playtest Analytics";
  container.appendChild(heading);

  const totalP = document.createElement("p");
  totalP.textContent = `Total games: ${stats.totalGames}`;
  container.appendChild(totalP);

  const avgP = document.createElement("p");
  avgP.textContent = `Avg turns per game: ${Math.round(stats.avgTurnCount)}`;
  container.appendChild(avgP);

  // Win/loss table
  const table = document.createElement("table");
  const headerRow = document.createElement("tr");
  for (const h of ["Outcome", "Count"]) {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  }
  table.appendChild(headerRow);

  for (const row of stats.outcomes) {
    const tr = document.createElement("tr");
    const tdOutcome = document.createElement("td");
    tdOutcome.textContent = String(row.outcome);
    tr.appendChild(tdOutcome);
    const tdCount = document.createElement("td");
    tdCount.textContent = String(row.count);
    tr.appendChild(tdCount);
    table.appendChild(tr);
  }
  container.appendChild(table);
}
```

- [ ] **Step 4: Manually verify**

Open `/admin.html`, enter API key, view stats section. Verify data appears after some test games.

- [ ] **Step 5: Commit**

```bash
git add api/analytics/stats.ts src/ui/admin.ts admin.html
git commit -m "feat: add admin stats view for playtest analytics"
```

---

### Task 4: Difficulty Tuning Constants

**Files:**
- Modify: `src/engine/state.ts`
- Modify: `src/engine/win.ts`

This task is iterative and based on playtesting. The implementation is just adjusting exported constants.

- [ ] **Step 1: Create a tuning constants reference**

Document all tunable constants in one place for easy adjustment:

| Constant | File | Current | Notes |
|---|---|---|---|
| `STARTING_SUPPLY` | `state.ts` | 6 | Starting supply |
| `MAX_SUPPLY` | `state.ts` | 10 | Max supply |
| `STARTING_HOPE` | `state.ts` | 5 | Starting hope |
| `MAX_HOPE` | `state.ts` | 5 | Max hope |
| `STARTING_HEALTH` | `state.ts` | 3 | Starting health |
| `MAX_HEALTH` | `state.ts` | 5 | Max health |
| `SEARING_ADVANCE_RATE` | `state.ts` | 4 | Turns between searing advances |
| `HOPE_DECAY_INTERVAL` | `state.ts` | 6 | Turns between passive hope decay |
| `PILLARS_DISTANCE_THRESHOLD` | `win.ts` | 20 | Distance to reach Pillars |
| `GEAR_RELIC_THRESHOLD` | `win.ts` | 5 | Relics needed for Gear win |
| `RUMOR_TAG_WEIGHT_BONUS` | `rumors.ts` | 0.25 | Weight bonus per hint tag |
| `RUMOR_BIOME_WEIGHT_BONUS` | `rumors.ts` | 0.20 | Weight bonus per hint biome |
| Night incident chance | `incidents.ts` | 40% | Chance of incident during camp |

- [ ] **Step 2: Playtest and adjust**

Play 5-10 games with different strategies (rush vs explore). Adjust constants based on:
- Are games too short/long? (Target: 20-40 turns)
- Is the Searing too aggressive/passive?
- Is Hope too scarce/abundant?
- Can players reasonably reach either win condition?
- Are relics too rare/common?

- [ ] **Step 3: Update constants and commit**

```bash
git add src/engine/state.ts src/engine/win.ts src/engine/rumors.ts
git commit -m "tune: adjust difficulty constants based on playtesting"
```

---

### Task 5: Edge Case Fixes

**Files:** Various — depends on issues found during playtesting.

- [ ] **Step 1: Playtest specifically for edge cases**

Test these scenarios:
- Start a game, immediately try to rest/forage (turn 0 behavior)
- Get supply to 0, forage repeatedly (zero-supply loop)
- Get Hope to 1, check fog of war is correct (only 3 neighbors)
- Let the Searing consume the player's hex (immediate death)
- Discover same rumor twice (should not duplicate)
- Complete a rumor, check relic added correctly
- Win via Pillars, then verify save is cleared
- Win via Gear, then verify save is cleared
- Load a corrupted save (should start new game)
- Resize the browser window during play

- [ ] **Step 2: Fix any issues found**

Document each fix with a test if the issue is in engine logic.

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: address edge cases found during M4 playtesting"
```

---

### Task 6: Final Content Pass

**Files:**
- Modify: `src/engine/data/seed-encounters.json`
- Modify: `src/engine/data/rumors.ts`

- [ ] **Step 1: Review all encounter text for quality**

Read through every encounter. Check for:
- Consistent tone (atmospheric, restrained, fits the terminal aesthetic)
- No duplicate text or too-similar encounters
- Resource outcomes are balanced (not all encounters give the same thing)
- Shadow text variants feel appropriately unsettling without being silly

- [ ] **Step 2: Fill content gaps**

Check if any biome/tag combinations have too few encounters. Add encounters where pools are thin.

- [ ] **Step 3: Review rumor chain narratives**

Read each rumor chain start to finish. The story should:
- Make sense as a sequence
- Have hints that feel natural, not mechanical
- Build toward a satisfying conclusion

- [ ] **Step 4: Commit content improvements**

```bash
git add src/engine/data/
git commit -m "content: final pass on encounter and rumor text quality"
```

---

### Task 7: Mobile/Responsive Considerations

**Files:**
- Modify: `index.html`
- Modify: `src/ui/input.ts`
- Modify: `src/renderer/views/map.ts`

- [ ] **Step 1: Add touch input for hex selection**

In `src/ui/input.ts`, add touch event handling that maps tap coordinates to hex clicks:

```typescript
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  // Use the same pixelToHex → clickedNeighborToAction logic as click
});
```

- [ ] **Step 2: Add responsive layout CSS**

```css
@media (max-width: 768px) {
  #app {
    flex-direction: column;
  }
  #log-panel, #journal-panel {
    width: 100%;
    height: 200px;
    border-left: none;
    border-top: 1px solid #333;
  }
}
```

- [ ] **Step 3: Manually test on mobile viewport**

Use browser dev tools to simulate mobile. Verify touch input, layout, and readability.

- [ ] **Step 4: Commit**

```bash
git add index.html src/ui/input.ts
git commit -m "feat: add touch input and responsive layout for mobile"
```

---

### Task 8: Final Integration and Demo Readiness

**Files:** None new — verification only.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Production build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Final playtest checklist — the full demo experience**

- [ ] Game loads, shows continue/new game prompt if save exists
- [ ] New player sees tutorial hints, understands controls
- [ ] Key legend is visible and helpful
- [ ] Resource bars are readable and color-coded
- [ ] Every hex has an encounter — no empty hexes
- [ ] Encounters vary in rarity and quality
- [ ] Rumor discovery works naturally through encounters
- [ ] Journal shows active rumor hints and collected relics
- [ ] Weighted generation nudges toward rumor objectives
- [ ] Rumor chains complete with relic rewards
- [ ] Pillars of Frost win works (frost messages, win screen)
- [ ] Restart the Gear win works (relic threshold, ritual choice)
- [ ] Win/loss screens show stats and narrative
- [ ] Low-Hope visual effects work
- [ ] Searing visual drama works
- [ ] Sounds play at appropriate moments
- [ ] Shadow encounter text at low Hope
- [ ] Save/load preserves all state correctly
- [ ] Analytics events are recorded
- [ ] Admin stats view shows playtest data
- [ ] Mobile touch input works
- [ ] No console errors during a full playthrough

- [ ] **Step 5: Deploy to Vercel**

```bash
npx vercel --prod
```

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A
git commit -m "chore: M4 final polish and demo readiness"
```
