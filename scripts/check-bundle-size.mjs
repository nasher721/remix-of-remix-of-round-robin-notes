import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const distDir = new URL("../dist/", import.meta.url);
const html = readFileSync(new URL("index.html", distDir), "utf8");
const entryMatch = html.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/);

if (!entryMatch) {
  throw new Error("Bundle budget check could not find the production entry script");
}

const assetsDir = join(distDir.pathname, "assets");
const assetFiles = readdirSync(assetsDir);

const budgets = [
  // Entry limit lowered from 2,300,000 after the 2026-08 split pass removed
  // the IBCC chapter-content data module and phrase-manager subgraph from the
  // eager graph. Residual target (see docs/release sign-off packet): reach
  // >=15% headroom under the enforced limit by lazy-splitting the analytics
  // and print subgraphs post-release.
  { label: "application entry", file: entryMatch[1], maxBytes: 2_200_000 },
];

const chunkBudgets = [
  // Heavy interaction-gated vendors; keep them lazy and bounded.
  { label: "export vendor", pattern: /^vendor-export-.*\.js$/, maxBytes: 2_000_000 },
  { label: "charts vendor", pattern: /^vendor-charts-.*\.js$/, maxBytes: 450_000 },
  // AI assistant surfaces must stay route/interaction-lazy and small.
  { label: "AI chatbot chunk", pattern: /^UnifiedAIChatbot-.*\.js$/, maxBytes: 60_000 },
  { label: "AI streaming chunk", pattern: /^useStreamingAI-.*\.js$/, maxBytes: 20_000 },
  // Print/export modal subgraph (excluding the shared export vendor chunk).
  { label: "print export modal chunk", pattern: /^PrintExportModal-.*\.js$/, maxBytes: 400_000 },
];

for (const chunk of chunkBudgets) {
  const file = assetFiles.find((name) => chunk.pattern.test(name));
  if (file) {
    budgets.push({ label: chunk.label, file, maxBytes: chunk.maxBytes });
  }
}

for (const budget of budgets) {
  const bytes = statSync(join(assetsDir, budget.file)).size;
  if (bytes > budget.maxBytes) {
    throw new Error(
      `${budget.label} ${basename(budget.file)} is ${bytes.toLocaleString()} bytes; budget is ${budget.maxBytes.toLocaleString()} bytes`,
    );
  }
  console.log(`[bundle-budget] ${budget.label}: ${bytes.toLocaleString()} / ${budget.maxBytes.toLocaleString()} bytes`);
}
