import { renderAdmin } from "./admin/main";

const root = document.getElementById("admin-root");
if (!root) {
  throw new Error("Missing #admin-root");
}

renderAdmin(root).catch(() => {
  root.replaceChildren(document.createTextNode("Failed to load admin panel."));
});
