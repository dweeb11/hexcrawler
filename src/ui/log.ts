import type { LogEntry } from "../engine/state";

export function updateLog(panel: HTMLElement, entries: LogEntry[]): void {
  for (let index = panel.children.length; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) {
      continue;
    }

    const row = document.createElement("div");
    row.className = `log-entry log-${entry.type ?? "narrative"}`;

    const turn = document.createElement("span");
    turn.className = "log-turn";
    turn.textContent = `[${entry.turn}] `;
    row.appendChild(turn);

    const text = document.createElement("span");
    text.textContent = entry.text;
    row.appendChild(text);
    panel.appendChild(row);
  }

  panel.scrollTop = panel.scrollHeight;
}

export function clearLog(panel: HTMLElement): void {
  panel.replaceChildren();
}

export function applyHopeStyling(panel: HTMLElement, hope: number): void {
  if (hope <= 1) {
    panel.dataset.hopeLevel = "critical";
  } else if (hope <= 2) {
    panel.dataset.hopeLevel = "low";
  } else {
    delete panel.dataset.hopeLevel;
  }
}
