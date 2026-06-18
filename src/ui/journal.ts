// src/ui/journal.ts
import { getRumorJournalEntries } from "../engine/rumors";
import type { GameState } from "../engine/state";

let currentTab: "rumors" | "relics" = "rumors";

export function isJournalOpen(journalEl: HTMLElement): boolean {
  return !journalEl.classList.contains("hidden");
}

export function closeJournal(journalEl: HTMLElement, logEl: HTMLElement): void {
  if (isJournalOpen(journalEl)) {
    journalEl.classList.add("hidden");
    logEl.classList.remove("hidden");
  }
}

export function toggleJournal(journalEl: HTMLElement, logEl: HTMLElement): void {
  if (isJournalOpen(journalEl)) {
    closeJournal(journalEl, logEl);
  } else {
    journalEl.classList.remove("hidden");
    logEl.classList.add("hidden");
  }
}

export function updateJournal(contentEl: HTMLElement, state: GameState): void {
  contentEl.textContent = "";

  if (currentTab === "rumors") {
    renderRumors(contentEl, state);
  } else {
    renderRelics(contentEl, state);
  }
}

function renderRumors(el: HTMLElement, state: GameState): void {
  const entries = getRumorJournalEntries(state.rumors);

  for (const entry of entries) {
    const div = document.createElement("div");

    switch (entry.status) {
      case "active": {
        div.className = "journal-entry journal-active";

        const title = document.createElement("h3");
        title.textContent = `${entry.rumor.title} (${entry.stepIndex + 1}/${entry.stepCount})`;
        div.appendChild(title);

        const hint = document.createElement("p");
        hint.className = "journal-hint";
        hint.textContent = entry.journalHint;
        div.appendChild(hint);
        break;
      }
      case "completed": {
        div.className = "journal-entry journal-completed";

        const title = document.createElement("h3");
        title.textContent = `✓ ${entry.rumor.title}`;
        div.appendChild(title);

        if (entry.rumor.reward) {
          const reward = document.createElement("p");
          reward.className = "journal-reward";
          reward.textContent = `Reward: ${entry.rumor.reward.name}`;
          div.appendChild(reward);
        }
        break;
      }
      default: {
        const _exhaustive: never = entry;
        throw new Error(`Unknown journal entry status: ${String(_exhaustive)}`);
      }
    }

    el.appendChild(div);
  }

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "journal-empty";
    empty.textContent = "No rumors discovered yet.";
    el.appendChild(empty);
  }
}

function renderRelics(el: HTMLElement, state: GameState): void {
  for (const relic of state.relics) {
    const div = document.createElement("div");
    div.className = "journal-entry";

    const name = document.createElement("h3");
    name.textContent = relic.name;
    div.appendChild(name);

    const desc = document.createElement("p");
    desc.textContent = relic.description;
    div.appendChild(desc);

    const effect = document.createElement("p");
    effect.className = "journal-effect";
    effect.textContent = describeEffect(relic.effect);
    div.appendChild(effect);

    el.appendChild(div);
  }

  if (state.relics.length === 0) {
    const empty = document.createElement("p");
    empty.className = "journal-empty";
    empty.textContent = "No relics collected yet.";
    el.appendChild(empty);
  }
}

function describeEffect(effect: import("../engine/state").RelicEffect): string {
  switch (effect.type) {
    case "max_resource":
      return `+${effect.bonus} max ${effect.resource}`;
    case "forage_bonus":
      return `+${Math.round((effect.chance ?? 0) * 100)}% forage success`;
    case "hope_decay_slow":
      return `Hope decays ${effect.intervalBonus} turn(s) slower`;
    case "move_discount":
      return `${Math.round((effect.chance ?? 0) * 100)}% chance to move without spending supply`;
    default: {
      const _exhaustive: never = effect.type;
      throw new Error(`Unknown relic effect type: ${String(_exhaustive)}`);
    }
  }
}

export function setJournalTab(tab: "rumors" | "relics"): void {
  currentTab = tab;
}
