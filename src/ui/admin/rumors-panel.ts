import { ALL_RELICS } from "../../engine/data/relics";
import type { Encounter } from "../../engine/state";
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
  validateContentCrossReferences,
  validateRumorPayload,
  type AdminRumor,
  type AdminRumorStep,
} from "./validation";

export interface RumorsPanelContext {
  encounters: Encounter[];
  rumors: AdminRumor[];
  onReload: () => Promise<void>;
}

function emptyStep(index: number): AdminRumorStep {
  return {
    stepIndex: index,
    stepTitle: "",
    encounterId: "",
    journalHint: "",
    hintTags: [],
  };
}

function normalizeSteps(steps: AdminRumorStep[]): AdminRumorStep[] {
  return steps.map((step, index) => ({ ...step, stepIndex: index }));
}

export function renderRumorsPanel(mount: HTMLElement, context: RumorsPanelContext): void {
  const { encounters, rumors, onReload } = context;
  let selected: AdminRumor | null = rumors[0] ?? null;

  const layout = create("div", { className: "editor-layout" });
  const listCard = create("div", { className: "card" });
  const editorCard = create("div", { className: "card" });
  const previewCard = create("div", { className: "card preview-panel" });
  layout.append(listCard, editorCard, previewCard);
  mount.replaceChildren(layout);

  const list = create("ul");
  const newButton = create("button", { text: "+ New rumor chain", className: "secondary" });
  const exportButton = create("button", { text: "Export rumors", className: "secondary" });
  const importButton = create("button", { text: "Import seed rumors", className: "secondary" });
  const listActions = create("div", { className: "row" });
  listActions.append(newButton, exportButton, importButton);
  listCard.append(create("h2", { text: "Rumor chains" }), listActions, list);

  const form = create("form");
  const title = create("h2", { text: "Rumor editor" });
  const idInput = create("input") as HTMLInputElement;
  const rumorTitleInput = create("input") as HTMLInputElement;
  const premiseInput = create("textarea") as HTMLTextAreaElement;
  const hopeBonusInput = create("input") as HTMLInputElement;
  hopeBonusInput.type = "number";
  const rewardSelect = create("select") as HTMLSelectElement;
  const emptyRelic = create("option") as HTMLOptionElement;
  emptyRelic.value = "";
  emptyRelic.textContent = "— no relic —";
  rewardSelect.append(emptyRelic);
  for (const relic of ALL_RELICS) {
    const option = create("option") as HTMLOptionElement;
    option.value = relic.id;
    option.textContent = `${relic.name} (${relic.id})`;
    rewardSelect.append(option);
  }

  const stepsMount = create("div", { className: "steps-mount" });
  const issueBox = create("div", { className: "issue-box" });
  const buttonRow = create("div", { className: "row" });
  const saveButton = create("button", { text: "Save rumor chain" }) as HTMLButtonElement;
  saveButton.type = "submit";
  const deleteButton = create("button", { text: "Delete", className: "secondary" }) as HTMLButtonElement;
  deleteButton.type = "button";
  buttonRow.append(saveButton, deleteButton);
  const status = create("pre", { className: "status-line" });

  editorCard.append(title, form);
  for (const [labelText, field] of [
    ["ID", idInput],
    ["Title", rumorTitleInput],
    ["Premise", premiseInput],
    ["Hope bonus", hopeBonusInput],
    ["Reward relic", rewardSelect],
  ] as const) {
    const label = create("label");
    label.append(create("span", { text: labelText }), field);
    form.append(label);
  }
  form.append(stepsMount, issueBox, buttonRow, status);

  previewCard.append(create("h2", { text: "Step preview" }));
  const previewBody = create("div", { className: "preview-body" });
  previewCard.append(previewBody);

  const encounterIds = encounters.map((encounter) => encounter.id);
  let stepRows: AdminRumorStep[] = selected?.steps ?? [emptyStep(0)];

  const readFormPayload = (): AdminRumor => ({
    id: idInput.value.trim(),
    title: rumorTitleInput.value.trim(),
    premise: premiseInput.value.trim(),
    hopeBonus: parseOptionalNumber(hopeBonusInput.value) ?? 0,
    rewardId: rewardSelect.value.trim() || null,
    steps: normalizeSteps(stepRows),
  });

  const renderStepPreview = (step: AdminRumorStep | undefined) => {
    previewBody.replaceChildren();
    if (!step) {
      previewBody.append(create("p", { text: "Select a step to preview its encounter." }));
      return;
    }

    previewBody.append(create("h3", { text: step.stepTitle || `Step ${step.stepIndex + 1}` }));
    previewBody.append(create("p", { text: `Encounter: ${step.encounterId || "—"}` }));
    previewBody.append(create("p", { text: `Journal hint: ${step.journalHint || "—"}` }));

    const encounter = encounters.find((entry) => entry.id === step.encounterId);
    if (encounter) {
      previewBody.append(create("hr"));
      previewBody.append(create("p", { text: encounter.text }));
    } else if (step.encounterId) {
      previewBody.append(create("p", { text: "Linked encounter not found.", className: "warn-text" }));
    }
  };

  const renderSteps = (focusIndex = 0) => {
    stepsMount.replaceChildren(create("h3", { text: "Steps" }));

    stepRows.forEach((step, index) => {
      const card = create("div", { className: "step-card" });
      const header = create("div", { className: "row" });
      header.append(create("strong", { text: `Step ${index + 1}` }));

      const removeButton = create("button", { text: "Remove", className: "secondary" }) as HTMLButtonElement;
      removeButton.type = "button";
      removeButton.hidden = stepRows.length <= 1;
      removeButton.addEventListener("click", () => {
        stepRows.splice(index, 1);
        renderSteps(Math.max(0, index - 1));
      });
      header.append(removeButton);
      card.append(header);

      const stepTitleInput = create("input") as HTMLInputElement;
      stepTitleInput.value = step.stepTitle;
      stepTitleInput.placeholder = "Step title for log lines";
      stepTitleInput.addEventListener("input", () => {
        stepRows[index] = { ...stepRows[index], stepTitle: stepTitleInput.value };
        renderStepPreview(stepRows[index]);
      });

      const encounterSelect = create("select") as HTMLSelectElement;
      const emptyEncounter = create("option") as HTMLOptionElement;
      emptyEncounter.value = "";
      emptyEncounter.textContent = "— select encounter —";
      encounterSelect.append(emptyEncounter);
      for (const encounterId of encounterIds) {
        const option = create("option") as HTMLOptionElement;
        option.value = encounterId;
        option.textContent = encounterId;
        encounterSelect.append(option);
      }
      encounterSelect.value = step.encounterId;
      encounterSelect.addEventListener("change", () => {
        stepRows[index] = { ...stepRows[index], encounterId: encounterSelect.value };
        renderStepPreview(stepRows[index]);
      });

      const journalHintInput = create("textarea") as HTMLTextAreaElement;
      journalHintInput.value = step.journalHint;
      journalHintInput.placeholder = "Player-facing travel direction";
      journalHintInput.addEventListener("input", () => {
        stepRows[index] = { ...stepRows[index], journalHint: journalHintInput.value };
      });

      const hintTagsInput = create("input") as HTMLInputElement;
      hintTagsInput.value = step.hintTags.join(", ");
      hintTagsInput.placeholder = "Engine-only tags";
      hintTagsInput.addEventListener("input", () => {
        stepRows[index] = {
          ...stepRows[index],
          hintTags: parseCsv(hintTagsInput.value) ?? [],
        };
      });

      const hintBiomesInput = create("input") as HTMLInputElement;
      hintBiomesInput.value = step.hintBiomes?.join(", ") ?? "";
      hintBiomesInput.placeholder = "Engine-only biomes";
      hintBiomesInput.addEventListener("input", () => {
        stepRows[index] = {
          ...stepRows[index],
          hintBiomes: parseBiomes(hintBiomesInput.value),
        };
      });

      const previewButton = create("button", { text: "Preview step", className: "secondary" }) as HTMLButtonElement;
      previewButton.type = "button";
      previewButton.addEventListener("click", () => renderStepPreview(stepRows[index]));

      for (const [labelText, field] of [
        ["Step title", stepTitleInput],
        ["Encounter", encounterSelect],
        ["Journal hint", journalHintInput],
        ["Hint tags", hintTagsInput],
        ["Hint biomes", hintBiomesInput],
      ] as const) {
        const label = create("label");
        label.append(create("span", { text: labelText }), field);
        card.append(label);
      }
      card.append(previewButton);
      stepsMount.append(card);
    });

    const addStepButton = create("button", { text: "+ Add step", className: "secondary" }) as HTMLButtonElement;
    addStepButton.type = "button";
    addStepButton.addEventListener("click", () => {
      stepRows.push(emptyStep(stepRows.length));
      renderSteps(stepRows.length - 1);
    });
    stepsMount.append(addStepButton);
    renderStepPreview(stepRows[focusIndex]);
  };

  const renderList = () => {
    list.replaceChildren();
    for (const rumor of rumors) {
      const item = create("li");
      const button = create("button", {
        text: `${rumor.id} — ${rumor.title}`,
        className: selected?.id === rumor.id ? "selected" : undefined,
      });
      button.type = "button";
      button.addEventListener("click", () => {
        selected = rumor;
        renderForm();
        renderList();
      });
      item.append(button);
      list.append(item);
    }
    if (rumors.length === 0) {
      list.append(create("li", { text: "No rumor chains yet." }));
    }
  };

  const renderForm = () => {
    idInput.value = selected?.id ?? "";
    idInput.disabled = Boolean(selected);
    rumorTitleInput.value = selected?.title ?? "";
    premiseInput.value = selected?.premise ?? "";
    hopeBonusInput.value = selected ? String(selected.hopeBonus) : "0";
    rewardSelect.value = selected?.rewardId ?? "";
    stepRows = selected?.steps.length ? selected.steps.map((step) => ({ ...step })) : [emptyStep(0)];
    deleteButton.hidden = !selected;
    title.textContent = selected ? `Edit ${selected.id}` : "New rumor chain";
    issueBox.replaceChildren();
    renderSteps();
  };

  newButton.addEventListener("click", () => {
    selected = null;
    renderForm();
    renderList();
  });

  exportButton.addEventListener("click", () => {
    downloadJson("rumors-export.json", rumors);
  });

  importButton.addEventListener("click", async () => {
    status.textContent = "Importing seed rumors…";
    await requestJson("/api/seed-rumors", { method: "POST" });
    await onReload();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = readFormPayload();
    const encounterIdSet = new Set(encounters.map((encounter) => encounter.id));
    const nextRumors = selected
      ? rumors.map((rumor) => (rumor.id === selected!.id ? payload : rumor))
      : [...rumors, payload];
    const issues = [
      ...validateRumorPayload(payload, encounterIdSet),
      ...validateContentCrossReferences(encounters, nextRumors).filter((issue) => issue.id === payload.id),
    ];

    renderIssueList(issueBox, issues);
    if (issues.length > 0) {
      status.textContent = "Fix validation errors before saving.";
      return;
    }

    try {
      const path = selected ? `/api/rumors/${selected.id}` : "/api/rumors";
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
      await requestJson(`/api/rumors/${selected.id}`, { method: "DELETE" });
      await onReload();
    } catch (error) {
      status.textContent = String(error);
    }
  });

  renderList();
  renderForm();
}
