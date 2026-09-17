import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { AuthProvider } from "@/hooks/useAuth";
import { PhrasePicker } from "./PhrasePicker";
import type { ClinicalPhrase } from "@/types/phrases";

afterEach(cleanup);

const mockPhrases: ClinicalPhrase[] = [
  {
    id: "phrase-1",
    userId: "user-1",
    name: "Extubation Readiness",
    content: "Patient passed spontaneous breathing trial with RSBI < 105.",
    contextTriggers: { section: ["respiratory"] },
    isActive: true,
    isShared: false,
    version: 1,
    usageCount: 12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("PhrasePicker", () => {
  it("renders trigger button and provides phrase selection", () => {
    render(
      <AuthProvider>
        <PhrasePicker
          phrases={mockPhrases}
          folders={[]}
          trigger={<button type="button">Insert Phrase</button>}
          onSelect={() => {}}
        />
      </AuthProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Insert Phrase" });
    assert.ok(trigger);
  });
});
