import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const distDir = new URL("../dist/", import.meta.url);
const html = readFileSync(new URL("index.html", distDir), "utf8");
const entryMatch = html.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/);

if (!entryMatch) {
  throw new Error("Bundle budget check could not find the production entry script");
}

const budgets = [
  { label: "application entry", file: entryMatch[1], maxBytes: 2_300_000 },
];

const exportFile = readdirSync(new URL("assets/", distDir))
  .find((file) => /^vendor-export-.*\.js$/.test(file));

if (exportFile) {
  budgets.push({ label: "export vendor", file: exportFile, maxBytes: 2_000_000 });
}

for (const budget of budgets) {
  const bytes = statSync(join(distDir.pathname, "assets", budget.file)).size;
  if (bytes > budget.maxBytes) {
    throw new Error(
      `${budget.label} ${basename(budget.file)} is ${bytes.toLocaleString()} bytes; budget is ${budget.maxBytes.toLocaleString()} bytes`,
    );
  }
  console.log(`[bundle-budget] ${budget.label}: ${bytes.toLocaleString()} / ${budget.maxBytes.toLocaleString()} bytes`);
}
