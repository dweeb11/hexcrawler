import type { Choice, ResourceDelta } from "../../engine/state";
import { create, parseOptionalNumber } from "./helpers";

export interface ChoiceEditorHandle {
  setChoices: (choices: Choice[]) => void;
  readChoices: () => Choice[];
  updateRumorIds: (nextRumorIds: string[]) => void;
}

function resourceField(label: string, value: number | undefined): HTMLLabelElement {
  const fieldId = `choice-${label}-${Math.random().toString(36).slice(2, 8)}`;
  const input = create("input") as HTMLInputElement;
  input.type = "number";
  input.step = "1";
  input.id = fieldId;
  input.value = value === undefined ? "" : String(value);
  input.className = "compact-input";
  const labelEl = create("label", { text: label, htmlFor: fieldId });
  labelEl.append(input);
  return labelEl;
}

function readResourceField(input: HTMLInputElement): number | undefined {
  return parseOptionalNumber(input.value);
}

function buildResourceDelta(container: HTMLElement): {
  supply?: HTMLInputElement;
  hope?: HTMLInputElement;
  health?: HTMLInputElement;
} {
  const row = create("div", { className: "choice-row" });
  const supply = resourceField("Supply", undefined);
  const hope = resourceField("Hope", undefined);
  const health = resourceField("Health", undefined);
  row.append(supply, hope, health);
  container.append(row);
  return {
    supply: supply.querySelector("input") as HTMLInputElement,
    hope: hope.querySelector("input") as HTMLInputElement,
    health: hope.querySelector("input") as HTMLInputElement,
  };
}

interface ChoiceEditorRow {
  root: HTMLElement;
  labelInput: HTMLInputElement;
  chanceInput: HTMLInputElement;
  supplyInput: HTMLInputElement;
  hopeInput: HTMLInputElement;
  healthInput: HTMLInputElement;
  failureSupplyInput: HTMLInputElement;
  failureHopeInput: HTMLInputElement;
  failureHealthInput: HTMLInputElement;
  rumorSelect: HTMLSelectElement;
  removeButton: HTMLButtonElement;
}

function readDelta(
  supply: HTMLInputElement,
  hope: HTMLInputElement,
  health: HTMLInputElement,
): ResourceDelta {
  const supplyValue = readResourceField(supply);
  const hopeValue = readResourceField(hope);
  const healthValue = readResourceField(health);

  let result: ResourceDelta = {};
  if (supplyValue !== undefined) result = { ...result, supply: supplyValue };
  if (hopeValue !== undefined) result = { ...result, hope: hopeValue };
  if (healthValue !== undefined) result = { ...result, health: healthValue };
  return result;
}

function setDelta(
  supply: HTMLInputElement,
  hope: HTMLInputElement,
  health: HTMLInputElement,
  delta: Choice["outcome"] | undefined,
): void {
  supply.value = delta?.supply === undefined ? "" : String(delta.supply);
  hope.value = delta?.hope === undefined ? "" : String(delta.hope);
  health.value = delta?.health === undefined ? "" : String(delta.health);
}

export function createChoiceEditor(
  container: HTMLElement,
  rumorIds: string[],
  onChange: () => void,
): ChoiceEditorHandle {
  const rows: ChoiceEditorRow[] = [];

  const renderRows = () => {
    container.replaceChildren();
    container.append(create("h3", { text: "Choices" }));

    rows.forEach((row, index) => {
      row.root.replaceChildren();
      const header = create("div", { className: "row" });
      header.append(create("strong", { text: `Choice ${index + 1}` }), row.removeButton);
      row.root.append(header);

      const labelField = create("label");
      labelField.append(create("span", { text: "Label" }), row.labelInput);
      row.root.append(labelField);

      const outcomeRow = create("div", { className: "choice-grid" });
      outcomeRow.append(
        row.supplyInput.parentElement as HTMLElement,
        row.hopeInput.parentElement as HTMLElement,
        row.healthInput.parentElement as HTMLElement,
      );
      row.root.append(outcomeRow);

      const chanceField = create("label");
      const chanceLabel = create("span", { text: "Chance (0–1, optional)" });
      chanceField.append(chanceLabel, row.chanceInput);
      row.root.append(chanceField);

      const failureBlock = create("div", { className: "failure-block" });
      failureBlock.append(create("span", { text: "Failure outcome" }));
      const failureGrid = create("div", { className: "choice-grid" });
      failureGrid.append(
        row.failureSupplyInput.parentElement as HTMLElement,
        row.failureHopeInput.parentElement as HTMLElement,
        row.failureHealthInput.parentElement as HTMLElement,
      );
      failureBlock.append(failureGrid);
      row.root.append(failureBlock);

      const rumorField = create("label");
      rumorField.append(create("span", { text: "Discovers rumor" }), row.rumorSelect);
      row.root.append(rumorField);

      container.append(row.root);
    });

    const addButton = create("button", { text: "+ Add choice", className: "secondary" });
    addButton.type = "button";
    addButton.addEventListener("click", () => {
      addRow({ label: "New choice", outcome: {} });
      onChange();
    });
    container.append(addButton);
  };

  const addRow = (choice: Choice, rerender = true) => {
    const root = create("div", { className: "choice-card" });
    const labelInput = create("input") as HTMLInputElement;
    labelInput.value = choice.label;
    labelInput.addEventListener("input", onChange);

    const chanceInput = create("input") as HTMLInputElement;
    chanceInput.type = "number";
    chanceInput.min = "0";
    chanceInput.max = "1";
    chanceInput.step = "0.05";
    chanceInput.className = "compact-input";
    chanceInput.value = choice.chance === undefined ? "" : String(choice.chance);
    chanceInput.addEventListener("input", onChange);

    const outcomeFields = buildResourceDelta(document.createElement("div"));
    setDelta(outcomeFields.supply!, outcomeFields.hope!, outcomeFields.health!, choice.outcome);
    outcomeFields.supply!.addEventListener("input", onChange);
    outcomeFields.hope!.addEventListener("input", onChange);
    outcomeFields.health!.addEventListener("input", onChange);

    const failureFields = buildResourceDelta(document.createElement("div"));
    setDelta(
      failureFields.supply!,
      failureFields.hope!,
      failureFields.health!,
      choice.failureOutcome,
    );
    failureFields.supply!.addEventListener("input", onChange);
    failureFields.hope!.addEventListener("input", onChange);
    failureFields.health!.addEventListener("input", onChange);

    const rumorSelect = create("select") as HTMLSelectElement;
    rumorSelect.className = "compact-input";
    const emptyOption = create("option") as HTMLOptionElement;
    emptyOption.value = "";
    emptyOption.textContent = "— none —";
    rumorSelect.append(emptyOption);
    for (const rumorId of rumorIds) {
      const option = create("option") as HTMLOptionElement;
      option.value = rumorId;
      option.textContent = rumorId;
      rumorSelect.append(option);
    }
    rumorSelect.value = choice.discoversRumor ?? "";
    rumorSelect.addEventListener("change", onChange);

    const removeButton = create("button", { text: "Remove", className: "secondary" }) as HTMLButtonElement;
    removeButton.type = "button";

    const row: ChoiceEditorRow = {
      root,
      labelInput,
      chanceInput,
      supplyInput: outcomeFields.supply!,
      hopeInput: outcomeFields.hope!,
      healthInput: outcomeFields.health!,
      failureSupplyInput: failureFields.supply!,
      failureHopeInput: failureFields.hope!,
      failureHealthInput: failureFields.health!,
      rumorSelect,
      removeButton,
    };

    removeButton.addEventListener("click", () => {
      const index = rows.indexOf(row);
      if (index >= 0) {
        rows.splice(index, 1);
        renderRows();
        onChange();
      }
    });

    rows.push(row);
    if (rerender) {
      renderRows();
    }
  };

  const updateRumorIds = (nextRumorIds: string[]) => {
    for (const row of rows) {
      const current = row.rumorSelect.value;
      row.rumorSelect.replaceChildren();
      const emptyOption = create("option") as HTMLOptionElement;
      emptyOption.value = "";
      emptyOption.textContent = "— none —";
      row.rumorSelect.append(emptyOption);
      for (const rumorId of nextRumorIds) {
        const option = create("option") as HTMLOptionElement;
        option.value = rumorId;
        option.textContent = rumorId;
        row.rumorSelect.append(option);
      }
      row.rumorSelect.value = nextRumorIds.includes(current) ? current : "";
    }
  };

  return {
    setChoices(choices: Choice[]) {
      rows.length = 0;
      for (const choice of choices) {
        addRow(choice, false);
      }
      renderRows();
    },
    readChoices(): Choice[] {
      return rows.map((row) => {
        const chance = parseOptionalNumber(row.chanceInput.value);
        const failureOutcome = readDelta(
          row.failureSupplyInput,
          row.failureHopeInput,
          row.failureHealthInput,
        );
        const rumorId = row.rumorSelect.value.trim();

        return {
          label: row.labelInput.value.trim(),
          outcome: readDelta(row.supplyInput, row.hopeInput, row.healthInput),
          ...(chance !== undefined ? { chance } : {}),
          ...(chance !== undefined && Object.keys(failureOutcome).length > 0
            ? { failureOutcome }
            : {}),
          ...(rumorId ? { discoversRumor: rumorId } : {}),
        };
      });
    },
    updateRumorIds,
  };
}
