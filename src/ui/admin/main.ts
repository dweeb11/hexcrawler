import type { Encounter } from "../../engine/state";
import { renderEncountersPanel } from "./encounters-panel";
import {
  checkAdminSession,
  create,
  loginWithPassphrase,
  logoutAdminSession,
  requestJson,
} from "./helpers";
import { renderRumorsPanel } from "./rumors-panel";
import { renderStats } from "./stats-panel";
import { validateContentCrossReferences, type AdminRumor } from "./validation";

type AdminTab = "encounters" | "rumors" | "stats";

async function loadEncounters(): Promise<Encounter[]> {
  return (await requestJson("/api/encounters")) as Encounter[];
}

async function loadRumors(): Promise<AdminRumor[]> {
  return (await requestJson("/api/rumors")) as AdminRumor[];
}

function renderAuthGate(root: HTMLElement): void {
  const shell = create("div", { className: "shell" });
  const card = create("section", { className: "card" });
  const title = create("h1", { text: "◆ Content Admin" });
  const blurb = create("p", {
    text: "Sign in with your admin passphrase to edit encounters and rumor chains.",
  });
  const form = create("form", { className: "row" });
  const input = create("input") as HTMLInputElement;
  input.type = "password";
  input.placeholder = "Passphrase";
  input.autocomplete = "current-password";
  input.style.flex = "1";
  const button = create("button", { text: "Sign in" }) as HTMLButtonElement;
  button.type = "submit";
  const status = create("pre", { className: "status-line" });
  form.append(input, button);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    try {
      await loginWithPassphrase(input.value);
      await renderAdmin(root);
    } catch (error) {
      status.textContent = String(error);
    }
  });
  card.append(title, blurb, form, status);
  shell.append(card);
  root.replaceChildren(shell);
}

export async function renderAdmin(root: HTMLElement): Promise<void> {
  const authenticated = await checkAdminSession();
  if (!authenticated) {
    renderAuthGate(root);
    return;
  }

  let activeTab: AdminTab = "encounters";
  let encounters: Encounter[] = [];
  let rumors: AdminRumor[] = [];

  const shell = create("div", { className: "shell" });
  const header = create("section", { className: "card" });
  const headerRow = create("div", { className: "row header-row" });
  const titleBlock = create("div");
  titleBlock.append(
    create("h1", { text: "◆ Content Admin" }),
    create("p", { text: "Encounters and rumor chains — live CRUD against Turso." }),
  );

  const actions = create("div", { className: "row" });
  const validateButton = create("button", { text: "Validate all", className: "secondary" });
  const logoutButton = create("button", { text: "Sign out", className: "secondary" });
  actions.append(validateButton, logoutButton);
  headerRow.append(titleBlock, actions);
  header.append(headerRow);

  const tabRow = create("div", { className: "tab-row" });
  const encountersTab = create("button", { text: "Encounters", className: "tab active" }) as HTMLButtonElement;
  const rumorsTab = create("button", { text: "Rumors", className: "tab" }) as HTMLButtonElement;
  const statsTab = create("button", { text: "Analytics", className: "tab" }) as HTMLButtonElement;
  tabRow.append(encountersTab, rumorsTab, statsTab);
  header.append(tabRow);

  const validationBanner = create("pre", { className: "validation-banner" });
  header.append(validationBanner);

  const panelMount = create("div", { className: "panel-mount" });
  shell.append(header, panelMount);
  root.replaceChildren(shell);

  const setActiveTab = (tab: AdminTab) => {
    activeTab = tab;
    for (const [button, name] of [
      [encountersTab, "encounters"],
      [rumorsTab, "rumors"],
      [statsTab, "stats"],
    ] as const) {
      button.classList.toggle("active", name === tab);
    }
    renderActivePanel();
  };

  const renderValidationBanner = () => {
    const issues = validateContentCrossReferences(encounters, rumors);
    if (issues.length === 0) {
      validationBanner.textContent = "Cross-references OK.";
      validationBanner.className = "validation-banner ok";
      return;
    }
    validationBanner.className = "validation-banner warn";
    validationBanner.textContent = issues
      .slice(0, 8)
      .map((issue) => `${issue.id || "global"} · ${issue.field}: ${issue.message}`)
      .join("\n");
    if (issues.length > 8) {
      validationBanner.textContent += `\n… and ${issues.length - 8} more`;
    }
  };

  const reloadData = async () => {
    [encounters, rumors] = await Promise.all([loadEncounters(), loadRumors()]);
    renderValidationBanner();
    renderActivePanel();
  };

  const renderActivePanel = () => {
    panelMount.replaceChildren();
    if (activeTab === "encounters") {
      renderEncountersPanel(panelMount, { encounters, rumors, onReload: reloadData });
      return;
    }
    if (activeTab === "rumors") {
      renderRumorsPanel(panelMount, { encounters, rumors, onReload: reloadData });
      return;
    }

    const statsCard = create("section", { className: "card" });
    statsCard.append(create("h2", { text: "Analytics stats" }));
    const statsBody = create("div");
    statsCard.append(statsBody);
    panelMount.append(statsCard);
    renderStats(statsBody);
  };

  encountersTab.addEventListener("click", () => setActiveTab("encounters"));
  rumorsTab.addEventListener("click", () => setActiveTab("rumors"));
  statsTab.addEventListener("click", () => setActiveTab("stats"));

  validateButton.addEventListener("click", () => renderValidationBanner());

  logoutButton.addEventListener("click", async () => {
    await logoutAdminSession().catch(() => null);
    renderAuthGate(root);
  });

  try {
    await reloadData();
  } catch (error) {
    panelMount.replaceChildren(create("pre", { text: String(error) }));
  }
}
