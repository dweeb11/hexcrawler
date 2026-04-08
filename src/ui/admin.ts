import seedEncounters from "../engine/data/seed-encounters.json";
import type { Biome, Encounter } from "../engine/state";

const STORAGE_KEY = "waning-light-admin-key";

function parseCsv(value: string): string[] | undefined {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

function parseBiomes(value: string): Biome[] | undefined {
  const values = parseCsv(value);
  if (!values) {
    return undefined;
  }

  const allowed = new Set<Biome>(["forest", "mountain", "ruins", "settlement", "wastes"]);
  const biomes = values.filter((entry): entry is Biome => allowed.has(entry as Biome));
  return biomes.length > 0 ? biomes : undefined;
}

function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { text?: string; className?: string } = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.text) {
    element.textContent = options.text;
  }
  if (options.className) {
    element.className = options.className;
  }
  return element;
}

function getStoredApiKey(): string {
  return sessionStorage.getItem(STORAGE_KEY) ?? "";
}

function setStoredApiKey(value: string): void {
  sessionStorage.setItem(STORAGE_KEY, value);
}

async function requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  const apiKey = getStoredApiKey();
  if (apiKey) {
    headers.set("X-API-Key", apiKey);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function encounterToFormValue(encounter: Encounter | null): {
  id: string;
  text: string;
  requiredTags: string;
  biomes: string;
  choices: string;
} {
  return encounter
    ? {
        id: encounter.id,
        text: encounter.text,
        requiredTags: encounter.requiredTags.join(", "),
        biomes: encounter.biomes?.join(", ") ?? "",
        choices: JSON.stringify(encounter.choices, null, 2),
      }
    : {
        id: "",
        text: "",
        requiredTags: "",
        biomes: "",
        choices: JSON.stringify([{ label: "OK", outcome: {} }], null, 2),
      };
}

async function loadEncounters(): Promise<Encounter[]> {
  return (await requestJson("/api/encounters")) as Encounter[];
}

interface AnalyticsStats {
  totalGames: number;
  outcomes: Array<{
    outcome: string;
    count: number;
  }>;
  avgTurnCount: number;
  rumorCompletions: Array<{
    rumorId: string;
    count: number;
  }>;
}

async function loadStats(): Promise<AnalyticsStats> {
  return (await requestJson("/api/analytics/stats")) as AnalyticsStats;
}

async function renderStats(container: HTMLElement): Promise<void> {
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
    table.style.cssText = "width:100%;border-collapse:collapse;font-size:14px";
    for (const [label, value] of rows) {
      const tr = document.createElement("tr");
      const th = document.createElement("td");
      th.textContent = label;
      th.style.cssText = "padding:6px 8px;color:#6b5040;font-weight:600";
      const td = document.createElement("td");
      td.textContent = value;
      td.style.cssText = "padding:6px 8px;text-align:right";
      tr.append(th, td);
      table.append(tr);
    }

    const outcomesSection = create("div");
    outcomesSection.append(create("h3", { text: "Game outcomes" }));
    if (stats.outcomes.length === 0) {
      outcomesSection.append(create("p", { text: "No data yet" }));
    } else {
      const outcomesTable = document.createElement("table");
      outcomesTable.style.cssText = "width:100%;border-collapse:collapse;font-size:13px";
      for (const row of stats.outcomes) {
        const tr = document.createElement("tr");
        const th = document.createElement("td");
        th.textContent = row.outcome;
        th.style.padding = "4px 8px";
        const td = document.createElement("td");
        td.textContent = String(row.count);
        td.style.cssText = "padding:4px 8px;text-align:right";
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
        item.style.padding = "2px 0";
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

function renderAuthGate(root: HTMLElement): void {
  const shell = create("div", { className: "shell" });
  const card = create("section", { className: "card" });
  const title = create("h1", { text: "Encounter Admin" });
  const blurb = create("p", {
    text: "Enter the admin API key to create and edit live encounter content.",
  });
  const form = create("form", { className: "row" });
  const input = create("input") as HTMLInputElement;
  input.type = "password";
  input.placeholder = "API key";
  input.value = getStoredApiKey();
  input.style.flex = "1";
  const button = create("button", { text: "Unlock" }) as HTMLButtonElement;
  button.type = "submit";
  form.append(input, button);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setStoredApiKey(input.value);
    renderAdmin(root);
  });
  card.append(title, blurb, form);
  shell.append(card);
  root.replaceChildren(shell);
}

async function renderAdmin(root: HTMLElement): Promise<void> {
  if (!getStoredApiKey()) {
    renderAuthGate(root);
    return;
  }

  const shell = create("div", { className: "shell" });
  const header = create("section", { className: "card" });
  const headerRow = create("div", { className: "row" });
  headerRow.style.justifyContent = "space-between";
  headerRow.style.alignItems = "center";
  const titleBlock = create("div");
  titleBlock.append(
    create("h1", { text: "Encounter Admin" }),
    create("p", { text: "Live CRUD against `/api/encounters`, with import/export helpers." }),
  );
  const actions = create("div", { className: "row" });
  const exportButton = create("button", { text: "Export JSON", className: "secondary" });
  const importButton = create("button", { text: "Import Seeds", className: "secondary" });
  const resetButton = create("button", { text: "Clear Key", className: "secondary" });
  actions.append(exportButton, importButton, resetButton);
  headerRow.append(titleBlock, actions);
  header.append(headerRow);
  shell.append(header);

  const statsCard = create("section", { className: "card" });
  statsCard.append(create("h2", { text: "Analytics Stats" }));
  const statsBody = create("div");
  statsCard.append(statsBody);
  shell.append(statsCard);
  renderStats(statsBody);

  const body = create("section", { className: "two-column" });
  const listCard = create("div", { className: "card" });
  const formCard = create("div", { className: "card" });
  body.append(listCard, formCard);
  shell.append(body);
  root.replaceChildren(shell);

  const encounters = await loadEncounters().catch((error) => {
    formCard.replaceChildren(create("pre", { text: String(error) }));
    return [] as Encounter[];
  });
  let selected: Encounter | null = encounters[0] ?? null;

  exportButton.addEventListener("click", () => {
    const pre = create("pre", { text: JSON.stringify(encounters, null, 2) });
    formCard.replaceChildren(pre);
  });

  importButton.addEventListener("click", async () => {
    for (const encounter of seedEncounters) {
      await requestJson("/api/encounters", {
        method: "POST",
        body: JSON.stringify(encounter),
      }).catch(() => null);
    }
    await renderAdmin(root);
  });

  resetButton.addEventListener("click", () => {
    sessionStorage.removeItem(STORAGE_KEY);
    renderAuthGate(root);
  });

  const renderList = () => {
    listCard.replaceChildren();
    listCard.append(create("h2", { text: "Encounters" }));
    const list = create("ul");
    const newButton = create("button", { text: "New Encounter", className: "secondary" });
    newButton.addEventListener("click", () => {
      selected = null;
      renderForm();
    });
    listCard.append(newButton, list);

    encounters.forEach((encounter) => {
      const item = create("li");
      const button = create("button", {
        text: `${encounter.id} - ${encounter.requiredTags.join(", ") || "no tags"}`,
      });
      button.addEventListener("click", () => {
        selected = encounter;
        renderForm();
      });
      item.append(button);
      list.append(item);
    });
  };

  const renderForm = () => {
    formCard.replaceChildren();
    formCard.append(create("h2", { text: selected ? `Edit ${selected.id}` : "New Encounter" }));
    const values = encounterToFormValue(selected);
    const form = create("form");
    form.className = "shell";

    const idInput = create("input") as HTMLInputElement;
    idInput.value = values.id;
    const textInput = create("textarea") as HTMLTextAreaElement;
    textInput.value = values.text;
    const tagInput = create("input") as HTMLInputElement;
    tagInput.value = values.requiredTags;
    const biomeInput = create("input") as HTMLInputElement;
    biomeInput.value = values.biomes;
    const choicesInput = create("textarea") as HTMLTextAreaElement;
    choicesInput.value = values.choices;

    const fields: Array<[string, HTMLInputElement | HTMLTextAreaElement]> = [
      ["ID", idInput],
      ["Text", textInput],
      ["Required Tags", tagInput],
      ["Biomes", biomeInput],
      ["Choices JSON", choicesInput],
    ];

    fields.forEach(([labelText, field]) => {
      const label = create("label");
      label.append(create("span", { text: labelText }), field);
      form.append(label);
    });

    const buttonRow = create("div", { className: "row" });
    const saveButton = create("button", { text: "Save" }) as HTMLButtonElement;
    saveButton.type = "submit";
    const deleteButton = create("button", { text: "Delete", className: "secondary" }) as HTMLButtonElement;
    deleteButton.type = "button";
    buttonRow.append(saveButton);
    if (selected) {
      buttonRow.append(deleteButton);
    }
    form.append(buttonRow);

    const status = create("pre");
    form.append(status);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const payload: Encounter = {
          id: idInput.value.trim(),
          text: textInput.value.trim(),
          requiredTags: parseCsv(tagInput.value) ?? [],
          biomes: parseBiomes(biomeInput.value),
          choices: JSON.parse(choicesInput.value),
        };

        const path = selected ? `/api/encounters/${selected.id}` : "/api/encounters";
        const method = selected ? "PUT" : "POST";
        await requestJson(path, { method, body: JSON.stringify(payload) });
        status.textContent = "Saved.";
        await renderAdmin(root);
      } catch (error) {
        status.textContent = String(error);
      }
    });

    deleteButton.addEventListener("click", async () => {
      if (!selected) {
        return;
      }
      try {
        await requestJson(`/api/encounters/${selected.id}`, { method: "DELETE" });
        await renderAdmin(root);
      } catch (error) {
        status.textContent = String(error);
      }
    });

    formCard.append(form);
  };

  renderList();
  renderForm();
}

const root = document.getElementById("admin-root");
if (!root) {
  throw new Error("Missing #admin-root");
}

renderAdmin(root).catch(() => renderAuthGate(root));
