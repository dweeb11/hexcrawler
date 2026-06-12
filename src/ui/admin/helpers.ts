import type { Biome } from "../../engine/state";

export const STORAGE_KEY = "waning-light-admin-key";

export function parseCsv(value: string): string[] | undefined {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export function parseBiomes(value: string): Biome[] | undefined {
  const values = parseCsv(value);
  if (!values) {
    return undefined;
  }

  const allowed = new Set<Biome>(["forest", "mountain", "ruins", "settlement", "wastes"]);
  const biomes = values.filter((entry): entry is Biome => allowed.has(entry as Biome));
  return biomes.length > 0 ? biomes : undefined;
}

export function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function create<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { text?: string; className?: string; htmlFor?: string } = {},
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (options.text) {
    element.textContent = options.text;
  }
  if (options.className) {
    element.className = options.className;
  }
  if (options.htmlFor && tag === "label") {
    (element as HTMLLabelElement).htmlFor = options.htmlFor;
  }
  return element;
}

export function getStoredApiKey(): string {
  return sessionStorage.getItem(STORAGE_KEY) ?? "";
}

export function setStoredApiKey(value: string): void {
  sessionStorage.setItem(STORAGE_KEY, value);
}

export async function requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
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

export function renderIssueList(container: HTMLElement, issues: Array<{ field: string; message: string }>): void {
  container.replaceChildren();
  if (issues.length === 0) {
    return;
  }

  const list = create("ul", { className: "issue-list" });
  for (const issue of issues) {
    const item = create("li");
    item.textContent = `${issue.field}: ${issue.message}`;
    list.append(item);
  }
  container.append(list);
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
