import { resetFullSuiteFixture } from "./fixture-state";

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_DECISION_SCRIBE === "1") return;
  await resetFullSuiteFixture("teardown");
}
