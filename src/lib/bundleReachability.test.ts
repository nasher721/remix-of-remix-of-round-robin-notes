import { test } from "node:test";
import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
test("bundle reachability guard handles native paths with spaces and still rejects forbidden imports", () => {
  const dir = mkdtempSync(join(tmpdir(), "composer bundle check "));
  try {
    mkdirSync(join(dir, "scripts"));
    mkdirSync(join(dir, "dist", "assets"), { recursive: true });
    const script = join(dir, "scripts", "check.mjs");
    copyFileSync(
      new URL(
        "../../scripts/assert-no-optional-native-in-bundle.mjs",
        import.meta.url,
      ),
      script,
    );
    const asset = join(dir, "dist", "assets", "app.js");
    writeFileSync(asset, "const safe = true;");
    assert.equal(
      spawnSync(process.execPath, [script], { encoding: "utf8" }).status,
      0,
    );
    writeFileSync(asset, 'import "expo-modules-core";');
    assert.equal(
      spawnSync(process.execPath, [script], { encoding: "utf8" }).status,
      1,
    );
  } finally {
    assert.ok(
      isAbsolute(dir) && dirname(resolve(dir)) === resolve(tmpdir()) &&
        basename(dir).startsWith("composer bundle check "),
    );
    rmSync(dir, { recursive: true, force: true });
  }
});
