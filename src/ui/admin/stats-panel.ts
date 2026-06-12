import { create, requestJson } from "./helpers";

interface AnalyticsStats {
  totalGames: number;
  outcomes: Array<{ outcome: string; count: number }>;
  avgTurnCount: number;
  rumorCompletions: Array<{ rumorId: string; count: number }>;
}

async function loadStats(): Promise<AnalyticsStats> {
  return (await requestJson("/api/analytics/stats")) as AnalyticsStats;
}

export async function renderStats(container: HTMLElement): Promise<void> {
  container.replaceChildren(create("p", { text: "Loading stats…" }));
  try {
    const stats = await loadStats();
    const totalOutcomeEvents = stats.outcomes.reduce((sum, row) => sum + row.count, 0);
    const winCount = stats.outcomes
      .filter((row) => row.outcome.toLowerCase().includes("won") || row.outcome.toLowerCase().includes("win"))
      .reduce((sum, row) => sum + row.count, 0);
    const lossCount = Math.max(0, totalOutcomeEvents - winCount);
    const rows: [string, string][] = [
      ["Games played", String(stats.totalGames)],
      ["Wins / Losses", `${winCount} / ${lossCount}`],
      ["Avg turns per game", stats.avgTurnCount > 0 ? stats.avgTurnCount.toFixed(1) : "0"],
      ["Rumor discoveries", String(stats.rumorCompletions.reduce((sum, row) => sum + row.count, 0))],
    ];

    const table = document.createElement("table");
    table.className = "stats-table";
    for (const [label, value] of rows) {
      const tr = document.createElement("tr");
      const th = document.createElement("td");
      th.textContent = label;
      th.className = "stats-label";
      const td = document.createElement("td");
      td.textContent = value;
      td.className = "stats-value";
      tr.append(th, td);
      table.append(tr);
    }

    const outcomesSection = create("div");
    outcomesSection.append(create("h3", { text: "Game outcomes" }));
    if (stats.outcomes.length === 0) {
      outcomesSection.append(create("p", { text: "No data yet" }));
    } else {
      const outcomesTable = document.createElement("table");
      outcomesTable.className = "stats-table";
      for (const row of stats.outcomes) {
        const tr = document.createElement("tr");
        const th = document.createElement("td");
        th.textContent = row.outcome;
        const td = document.createElement("td");
        td.textContent = String(row.count);
        td.className = "stats-value";
        tr.append(th, td);
        outcomesTable.append(tr);
      }
      outcomesSection.append(outcomesTable);
    }

    const rumorSection = create("div");
    rumorSection.append(create("h3", { text: "Top rumor discoveries" }));
    if (stats.rumorCompletions.length === 0) {
      rumorSection.append(create("p", { text: "No data yet" }));
    } else {
      const rumorList = create("ul");
      for (const row of stats.rumorCompletions) {
        const item = create("li");
        item.textContent = `${row.rumorId}: ${row.count}`;
        rumorList.append(item);
      }
      rumorSection.append(rumorList);
    }

    const refreshButton = create("button", { text: "Refresh", className: "secondary" });
    refreshButton.addEventListener("click", () => renderStats(container));

    container.replaceChildren(table, outcomesSection, rumorSection, refreshButton);
  } catch (error) {
    container.replaceChildren(create("pre", { text: String(error) }));
  }
}
