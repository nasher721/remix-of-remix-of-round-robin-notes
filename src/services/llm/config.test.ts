import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { STORAGE_KEYS } from "@/constants/config";
import {
  buildConfigFromEnv,
  clearRuntimeCredentials,
  setRuntimeCredentials,
} from "./config";

afterEach(() => {
  clearRuntimeCredentials();
  localStorage.clear();
});

test("provider credentials are used from memory and cleared without persistence", () => {
  localStorage.setItem(
    STORAGE_KEYS.AI_CREDENTIALS,
    JSON.stringify({ openai: "stale-persisted-secret" }),
  );

  assert.equal(buildConfigFromEnv().providers.openai, undefined);

  setRuntimeCredentials({ openai: "runtime-only-secret" });
  assert.equal(buildConfigFromEnv().providers.openai?.apiKey, "runtime-only-secret");
  assert.equal(
    localStorage.getItem(STORAGE_KEYS.AI_CREDENTIALS),
    JSON.stringify({ openai: "stale-persisted-secret" }),
  );

  clearRuntimeCredentials();
  assert.equal(buildConfigFromEnv().providers.openai, undefined);
});
