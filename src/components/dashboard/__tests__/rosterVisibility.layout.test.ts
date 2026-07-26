import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const fromRoot = (...segments: string[]) => path.join(process.cwd(), ...segments);

const readSource = (file: string) => readFileSync(fromRoot(file), "utf8");

test("desktop sidebar roster fills workspace height without a 42vh clamp", () => {
  const source = readSource("src/components/dashboard/VirtualizedPatientList.tsx");

  assert.match(source, /aria-label="Patient list"/);
  assert.match(source, /lg:h-full/);
  assert.match(source, /lg:min-h-0/);
  assert.match(source, /<ScrollArea className="flex-1 min-h-0"/);
  assert.doesNotMatch(source, /max-h-\[42vh\]/);
});
