import type { LogEntry } from "../engine/state";

export function updateLog(panel: HTMLElement, entries: LogEntry[]): void {
  for (let index = panel.children.length; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) {
      continue;
    }

    const row = document.createElement("div");
    row.style.marginBottom = "6px";
    row.style.paddingBottom = "6px";
    row.style.borderBottom = "1px solid #1f1f1f";

    const turn = document.createElement("span");
    turn.style.color = "#666";
    turn.textContent = `[${entry.turn}] `;
    row.appendChild(turn);
    row.appendChild(document.createTextNode(entry.text));
    panel.appendChild(row);
  }

  panel.scrollTop = panel.scrollHeight;
}

export function clearLog(panel: HTMLElement): void {
  panel.replaceChildren();
}
