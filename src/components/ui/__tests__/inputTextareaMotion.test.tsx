import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function readSource(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function assertStaticAccessibleFocus(source: string, label: string) {
  const forbiddenMotionTokens = [
    "transition-all",
    "animate-shake",
    "animate-scale-in",
    "shadow-[",
    "duration-200",
    "duration-300",
    "scale-",
  ];

  for (const token of forbiddenMotionTokens) {
    assert.equal(source.includes(token), false, `${label} should not include nonessential motion token ${token}`);
  }

  assert.match(source, /focus-visible:(ring|outline|border)/, `${label} should preserve a visible focus treatment`);
}

describe("shared text control focus motion", () => {
  it("keeps Input focus static while preserving a visible focus indicator", () => {
    assertStaticAccessibleFocus(readSource("src/components/ui/input.tsx"), "Input");
  });

  it("keeps Textarea focus static while preserving a visible focus indicator", () => {
    assertStaticAccessibleFocus(readSource("src/components/ui/textarea.tsx"), "Textarea");
  });
});
