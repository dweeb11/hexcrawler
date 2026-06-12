import { ALL_RELICS } from "../../engine/data/relics";
import type { Encounter } from "../../engine/state";
import { createChoiceEditor } from "./choice-editor";
import {
  create,
  downloadJson,
  parseBiomes,
  parseCsv,
  parseOptionalNumber,
  renderIssueList,
  requestJson,
} from "./helpers";
import {
  filterEncounters,
  validateContentCrossReferences,
  validateEncounterPayload,
  type AdminRumor,
  type AdminRumorStep,
} from "./validation";

export interface EncountersPanelContext {
  encounters: Encounter[];
  rumors: AdminRumor[];
  onReload: () => Promise<void>;
}

function encounterUsage(encounterId: string, rumors: AdminRumor[]): string[] {
  return rumors
    .filter((rumor) => rumor.steps.some((step) => step.encounterId === encounterId))
    .map((rumor) => rumor.title || rumor.id);
}

export function renderEncountersPanel(mount: HTMLElement, context: EncountersPanelContext): void {
  const { encounters, rumors, onReload } = context;
  let selected: Encounter | null = encounters[0] ?? null;
  let filterQuery = "";

  const layout = create("div", { className: "editor-layout" });
  const listCard = create("div", { className: "card" });
  const editorCard = create("div", { className: "card" });
  const previewCard = create("div", { className: "card preview-panel" });
  layout.append(listCard, editorCard, previewCard);
  mount.replaceChildren(layout);

  const searchInput = create("input") as HTMLInputElement;
  searchInput.placeholder = "Filter by id, tags, or text…";
  searchInput.className = "search-input";

  const list = create("ul");
  const newButton = create("button", { text: "+ New encounter", className: "secondary" });
  const exportButton = create("button", { text: "Export encounters", className: "secondary" });
  const importButton = create("button", { text: "Import seed encounters", className: "secondary" });

  const listActions = create("div", { className: "row" });
  listActions.append(newButton, exportButton, importButton);
  listCard.append(create("h2", { text: "Encounters" }), searchInput, listActions, list);

  const form = create("form");
  const title = create("h2", { text: "Encounter editor" });
  const idInput = create("input") as HTMLInputElement;
  const textInput = create("textarea") as HTMLTextAreaElement;
  const tagInput = create("input") as HTMLInputElement;
  const biomeInput = create("input") as HTMLInputElement;
  const choiceMount = create("div");
  const issueBox = create("div", { className: "issue-box" });
  const buttonRow = create("div", { className: "row" });
  const saveButton = create("button", { text: "Save encounter" }) as HTMLButtonElement;
  saveButton.type = "submit";
  const deleteButton = create("button", { text: "Delete", className: "secondary" }) as HTMLButtonElement;
  deleteButton.type = "button";
  buttonRow.append(saveButton, deleteButton);
  const status = create("pre", { className: "status-line" });

  editorCard.append(title, form);
  for (const [labelText, field] of [
    ["ID", idInput],
    ["Text", textInput],
    ["Required tags (comma-separated)", tagInput],
    ["Biomes (comma-separated)", biomeInput],
  ] as const) {
    const label = create("label");
    label.append(create("span", { text: labelText }), field);
    form.append(label);
  }
  form.append(choiceMount, issueBox, buttonRow, status);

  previewCard.append(create("h2", { text: "Preview" }));
  const previewBody = create("div", { className: "preview-body" });
  previewCard.append(previewBody);

  const choiceEditor = createChoiceEditor(
    choiceMount,
    rumors.map((rumor) => rumor.id),
    () => renderPreview(),
  );

  const readFormPayload = (): Encounter => ({
    id: idInput.value.trim(),
    text: textInput.value.trim(),
    requiredTags: parseCsv(tagInput.value) ?? [],
    biomes: parseBiomes(biomeInput.value),
    choices: choiceEditor.readChoices(),
  });

  const renderPreview = () => {
    previewBody.replaceChildren();
    const payload = readFormPayload();
    previewBody.append(create("h3", { text: payload.id || "Untitled encounter" }));
    previewBody.append(create("p", { text: payload.text || "No text yet." }));
    previewBody.append(create("p", { text: `Tags: ${payload.requiredTags.join(", ") || "none"}` }));
    if (payload.biomes?.length) {
      previewBody.append(create("p", { text: `Biomes: ${payload.biomes.join(", ")}` }));
    }

    const usage = payload.id ? encounterUsage(payload.id, rumors) : [];
    if (usage.length > 0) {
      previewBody.append(create("p", { text: `Used in rumors: ${usage.join(", ")}` }));
    }

    const choiceList = create("ol");
    for (const choice of payload.choices) {
      const item = create("li");
      const parts = [choice.label];
      const deltas = [
        choice.outcome.supply !== undefined ? `${choice.outcome.supply >= 0 ? "+" : ""}${choice.outcome.supply} supply` : "",
        choice.outcome.hope !== undefined ? `${choice.outcome.hope >= 0 ? "+" : ""}${choice.outcome.hope} hope` : "",
        choice.outcome.health !== undefined ? `${choice.outcome.health >= 0 ? "+" : ""}${choice.outcome.health} health` : "",
      ].filter(Boolean);
      if (deltas.length > 0) parts.push(`→ ${deltas.join(", ")}`);
      if (choice.discoversRumor) parts.push(`[reveals ${choice.discoversRumor}]`);
      item.textContent = parts.join(" ");
      choiceList.append(item);
    }
    previewBody.append(choiceList);
  };

  const renderList = () => {
    list.replaceChildren();
    const filtered = filterEncounters(encounters, filterQuery);
    for (const encounter of filtered) {
      const item = create("li");
      const button = create("button", {
        text: `${encounter.id} — ${encounter.requiredTags.join(", ") || "no tags"}`,
        className: selected?.id === encounter.id ? "selected" : undefined,
      });
      button.type = "button";
      button.addEventListener("click", () => {
        selected = encounter;
        renderForm();
        renderList();
      });
      item.append(button);
      list.append(item);
    }
    if (filtered.length === 0) {
      list.append(create("li", { text: "No matches." }));
    }
  };

  const renderForm = () => {
    idInput.value = selected?.id ?? "";
    idInput.disabled = Boolean(selected);
    textInput.value = selected?.text ?? "";
    tagInput.value = selected?.requiredTags.join(", ") ?? "";
    biomeInput.value = selected?.biomes?.join(", ") ?? "";
    choiceEditor.setChoices(selected?.choices ?? [{ label: "OK", outcome: {} }]);
    deleteButton.hidden = !selected;
    title.textContent = selected ? `Edit ${selected.id}` : "New encounter";
    renderPreview();
    issueBox.replaceChildren();
  };

  searchInput.addEventListener("input", () => {
    filterQuery = searchInput.value;
    renderList();
  });

  newButton.addEventListener("click", () => {
    selected = null;
    renderForm();
    renderList();
  });

  exportButton.addEventListener("click", () => {
    downloadJson("encounters-export.json", encounters);
  });

  importButton.addEventListener("click", async () => {
    status.textContent = "Importing seed encounters…";
    const seed = (await import("../../engine/data/seed-encounters.json")).default as Encounter[];
    for (const encounter of seed) {
      await requestJson("/api/encounters", {
        method: "POST",
        body: JSON.stringify(encounter),
      }).catch(() => null);
    }
    await onReload();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = readFormPayload();
    const rumorIdSet = new Set(rumors.map((rumor) => rumor.id));
    const nextEncounters = selected
      ? encounters.map((encounter) => (encounter.id === selected!.id ? payload : encounter))
      : [...encounters, payload];
    const issues = [
      ...validateEncounterPayload(payload, rumorIdSet),
      ...validateContentCrossReferences(nextEncounters, rumors).filter(
        (issue) => issue.id === payload.id,
      ),
    ];

    renderIssueList(issueBox, issues);
    if (issues.length > 0) {
      status.textContent = "Fix validation errors before saving.";
      return;
    }

    try {
      const path = selected ? `/api/encounters/${selected.id}` : "/api/encounters";
      const method = selected ? "PUT" : "POST";
      await requestJson(path, { method, body: JSON.stringify(payload) });
      status.textContent = "Saved.";
      await onReload();
    } catch (error) {
      status.textContent = String(error);
    }
  });

  deleteButton.addEventListener("click", async () => {
    if (!selected) return;
    try {
      await requestJson(`/api/encounters/${selected.id}`, { method: "DELETE" });
      await onReload();
    } catch (error) {
      status.textContent = String(error);
    }
  });

  renderList();
  renderForm();
}
