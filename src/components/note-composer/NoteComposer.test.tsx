import React from "react";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NoteComposer } from "./NoteComposer";
import { ComposerSession } from "@/lib/note-composer/session";
import {
  defaultMedications,
  defaultSystems,
  type Patient,
} from "@/types/patient";
const patient: Patient = {
  id: "p1",
  name: "Synthetic One",
  mrn: "",
  bed: "TEST 1",
  patientNumber: 1,
  clinicalSummary: "Original",
  intervalEvents: "",
  labs: "",
  imaging: "",
  systems: { ...defaultSystems },
  medications: { ...defaultMedications },
  fieldTimestamps: {},
  revision: 2,
  createdAt: "",
  lastModified: "",
  collapsed: false,
};
globalThis.MutationObserver = window.MutationObserver;
globalThis.NodeFilter = window.NodeFilter;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;
afterEach(cleanup);
const make = () =>
  new ComposerSession("u1", patient, {
    generate: async () => {
      throw new Error("offline");
    },
    apply: async () => ({ revision: 3 }),
  });
test("patient identity, temporary-source notice and manual editing remain available without AI", () => {
  render(
    <NoteComposer
      session={make()}
      generationEnabled={false}
      onClose={() => {}}
    />,
  );
  assert.ok(screen.getByText(/Synthetic One/));
  assert.ok(screen.getByText(/reload or crash/i));
  fireEvent.change(screen.getByRole("textbox", { name: "Clinical summary" }), {
    target: { value: "My assessment" },
  });
  assert.ok(
    (screen.getByRole("textbox", {
      name: "Clinical summary",
    }) as HTMLTextAreaElement).value.includes("My assessment"),
  );
  assert.equal(
    (screen.getByRole("button", {
      name: "Generate draft",
    }) as HTMLButtonElement).disabled,
    true,
  );
});
test("copy uses exact reviewed text and leaves the unsaved status visible", async () => {
  let copied = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        copied = text;
      },
    },
  });
  const s = make();
  render(
    <NoteComposer session={s} generationEnabled={false} onClose={() => {}} />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Clinical summary" }), {
    target: { value: "First line\nSecond line" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Copy reviewed note" }));
  await waitFor(() => assert.equal(copied, "First line\nSecond line"));
  assert.equal(s.state.saveStatus, "unsaved");
});
test("closing unsaved work offers apply or explicit discard", () => {
  let closed = false;
  const s = make();
  render(
    <NoteComposer
      session={s}
      generationEnabled={false}
      onClose={() => {
        closed = true;
      }}
    />,
  );
  fireEvent.change(
    screen.getByRole("textbox", { name: "Today's assessment and plan" }),
    { target: { value: "Today" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Close composer" }));
  assert.equal(closed, false);
  assert.ok(screen.getByRole("button", { name: "Discard temporary work" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Discard temporary work" }),
  );
  assert.equal(closed, true);
});
test("source intake shows quarantine until clinician confirms patient-specific selection", () => {
  const s = make();
  render(
    <NoteComposer session={s} generationEnabled={false} onClose={() => {}} />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Paste source text" }), {
    target: { value: "Synthetic source" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add pasted source" }));
  assert.ok(screen.getByText(/Needs patient selection/));
});
test("repeated close requests reopen the unsaved-work review", () => {
  const s = make();
  s.setAttending("Temporary");
  const view = render(
    <NoteComposer
      session={s}
      generationEnabled={false}
      onClose={() => {}}
      closeRequest={1}
    />,
  );
  assert.ok(screen.getByRole("button", { name: "Discard temporary work" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue reviewing" }));
  view.rerender(
    <NoteComposer
      session={s}
      generationEnabled={false}
      onClose={() => {}}
      closeRequest={2}
    />,
  );
  assert.ok(screen.getByRole("button", { name: "Discard temporary work" }));
});
