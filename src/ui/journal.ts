// src/ui/journal.ts
import type { GameState, Relic, Rumor, ActiveRumor, CompletedRumor } from "../engine/state";

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
  // Active rumors
  for (const active of state.rumors.active) {
    const rumor = state.rumors.available.find((r) => r.id === active.rumorId);
    if (!rumor) continue;

    const div = document.createElement("div");
    div.className = "journal-entry journal-active";

    const title = document.createElement("h3");
    title.textContent = `${rumor.title} (${active.currentStep + 1}/${rumor.steps.length})`;
    div.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "journal-hint";
    const step = rumor.steps[active.currentStep];
    hint.textContent = step ? step.hint : "Follow the trail...";
    div.appendChild(hint);

    el.appendChild(div);
  }

  // Completed rumors
  for (const completed of state.rumors.completed) {
    const rumor = state.rumors.available.find((r) => r.id === completed.rumorId);
    if (!rumor) continue;

    const div = document.createElement("div");
    div.className = "journal-entry journal-completed";

    const title = document.createElement("h3");
    title.textContent = `✓ ${rumor.title}`;
    div.appendChild(title);

    if (rumor.reward) {
      const reward = document.createElement("p");
      reward.className = "journal-reward";
      reward.textContent = `Reward: ${rumor.reward.name}`;
      div.appendChild(reward);
    }

    el.appendChild(div);
  }

  if (state.rumors.active.length === 0 && state.rumors.completed.length === 0) {
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
