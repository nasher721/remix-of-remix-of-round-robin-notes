import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const fromRoot = (...segments: string[]) => path.join(process.cwd(), ...segments);

const countMatches = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].length;

const readSource = (relativePath: string) => readFileSync(fromRoot(relativePath), "utf8");

const titleSignalPattern = /<(DialogTitle|SheetTitle)(?:\s|>)/g;
const descriptionComponentPattern = /<(DialogDescription|SheetDescription)(?:\s|>)/g;
const ariaOverridePattern = /aria-describedby=\{undefined\}/g;

const dialogA11yTargets = [
  {
    file: "src/components/MultiPatientComparison.tsx",
    expectedTitles: 1,
    expectedDescriptions: 1,
  },
  {
    file: "src/components/VoiceCommandPanel.tsx",
    expectedTitles: 2,
    expectedDescriptions: 2,
  },
  {
    file: "src/components/UnifiedAIDropdown.tsx",
    expectedTitles: 3,
    expectedDescriptions: 3,
  },
  {
    file: "src/components/phrases/PhraseManager.tsx",
    expectedTitles: 4,
    expectedDescriptions: 4,
  },
] as const;

test("dialog surfaces provide title and description signals in targeted files", () => {
  for (const target of dialogA11yTargets) {
    const source = readSource(target.file);
    const titleCount = countMatches(source, titleSignalPattern);
    const descriptionCount =
      countMatches(source, descriptionComponentPattern) +
      countMatches(source, ariaOverridePattern);

    assert.ok(
      titleCount >= target.expectedTitles,
      `${target.file} should include at least ${target.expectedTitles} dialog title signal(s); found ${titleCount}.`,
    );
    assert.ok(
      descriptionCount >= target.expectedDescriptions,
      `${target.file} should include at least ${target.expectedDescriptions} dialog description signal(s); found ${descriptionCount}.`,
    );
  }
});
