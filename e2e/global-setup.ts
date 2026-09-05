import { resetFullSuiteFixture } from "./fixture-state";

export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_DECISION_SCRIBE === "1") return;
  await resetFullSuiteFixture("setup");
}
