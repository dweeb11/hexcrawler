import { renderAdmin } from "./admin/main";
import { getStoredApiKey, setStoredApiKey, STORAGE_KEY } from "./admin/helpers";

export { STORAGE_KEY, getStoredApiKey, setStoredApiKey };

const root = document.getElementById("admin-root");
if (!root) {
  throw new Error("Missing #admin-root");
}

renderAdmin(root).catch(() => {
  root.replaceChildren(document.createTextNode("Failed to load admin panel."));
});
