// src/ui/journal.ts
import { getRumorJournalEntries } from "../engine/rumors";
import type { GameState } from "../engine/state";

let currentTab: "rumors" | "relics" = "rumors";

export function toggleJournal(journalEl: HTMLElement, logEl: HTMLElement): void {
  const isHidden = journalEl.classList.contains("hidden");
  if (isHidden) {
    journalEl.classList.remove("hidden");
    logEl.classList.add("hidden");
  } else {
    journalEl.classList.add("hidden");
    logEl.classList.remove("hidden");
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
    div.className =
      entry.status === "active" ? "journal-entry journal-active" : "journal-entry journal-completed";

    const title = document.createElement("h3");
    if (entry.status === "active") {
      title.textContent = `${entry.rumor.title} (${(entry.stepIndex ?? 0) + 1}/${entry.stepCount ?? entry.rumor.steps.length})`;
      div.appendChild(title);

      const hint = document.createElement("p");
      hint.className = "journal-hint";
      hint.textContent = entry.journalHint ?? "Follow the trail...";
      div.appendChild(hint);
    } else {
      title.textContent = `✓ ${entry.rumor.title}`;
      div.appendChild(title);

      if (entry.rumor.reward) {
        const reward = document.createElement("p");
        reward.className = "journal-reward";
        reward.textContent = `Reward: ${entry.rumor.reward.name}`;
        div.appendChild(reward);
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
    case "searing_resist":
      return `Survive ${effect.extraTurns} extra turn(s) on searing edge`;
    case "hope_decay_slow":
      return `Hope decays ${effect.intervalBonus} turn(s) slower`;
    case "move_discount":
      return `${Math.round((effect.chance ?? 0) * 100)}% chance to move without spending supply`;
    default:
      return "";
  }
}

export function setJournalTab(tab: "rumors" | "relics"): void {
  currentTab = tab;
}
