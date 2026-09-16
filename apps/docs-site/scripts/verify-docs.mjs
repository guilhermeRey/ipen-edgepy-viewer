import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requiredDocs = [
  "docs/index.md",
  "docs/downloads.md",
  "docs/how-to/integrar-django.md",
  "docs/how-to/usar-pyscript.md",
];

for (const docPath of requiredDocs) {
  await assertExists(docPath);
}

const sidebar = JSON.parse(await readFile(resolve(docsRoot, "sidebars.json"), "utf8"));
for (const docPath of sidebarPaths(sidebar.docs)) {
  await assertExists(docPath);
}

console.log(`Verified ${requiredDocs.length} required documentation pages.`);

async function assertExists(relativePath) {
  await access(resolve(docsRoot, relativePath));
}

function sidebarPaths(items) {
  return items.flatMap((item) => item.path ? [item.path] : sidebarPaths(item.items ?? []));
}
