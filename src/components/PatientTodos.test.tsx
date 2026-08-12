import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PatientTodos } from "./PatientTodos";
import { defaultMedications, defaultSystems, type Patient } from "@/types/patient";

const patient: Patient = {
  id: "patient-1",
  patientNumber: 1,
  name: "Test Patient",
  mrn: "TEST-1",
  bed: "T-1",
  clinicalSummary: "",
  intervalEvents: "",
  imaging: "",
  labs: "",
  systems: defaultSystems,
  medications: defaultMedications,
  fieldTimestamps: {},
  collapsed: false,
  createdAt: "2026-08-12T00:00:00.000Z",
  lastModified: "2026-08-12T00:00:00.000Z",
};

const defaultProps = {
  todos: [],
  section: null,
  patient,
  generating: false,
  onToggleTodo: async () => undefined,
  onDeleteTodo: async () => undefined,
  onGenerateTodos: async () => undefined,
  alwaysVisible: true,
  showAiGenerate: false,
};

afterEach(cleanup);

describe("PatientTodos entry", { concurrency: false }, () => {
  test("trims keyboard submissions and clears the field", async () => {
    const submitted: string[] = [];
    render(
      <PatientTodos
        {...defaultProps}
        onAddTodo={async (content) => {
          submitted.push(content);
          return undefined;
        }}
      />,
    );

    const input = screen.getByRole("textbox", { name: "New todo" });
    fireEvent.change(input, { target: { value: "  Verify potassium  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      assert.deepEqual(submitted, ["Verify potassium"]);
      assert.equal((input as HTMLInputElement).value, "");
    });
  });

  test("blocks and announces todo drafts over the maximum length", () => {
    render(<PatientTodos {...defaultProps} onAddTodo={async () => undefined} />);

    const input = screen.getByRole("textbox", { name: "New todo" });
    fireEvent.change(input, { target: { value: "x".repeat(241) } });

    assert.equal(input.getAttribute("aria-invalid"), "true");
    assert.equal(screen.getByRole("button", { name: "Add todo" }).hasAttribute("disabled"), true);
    assert.ok(screen.getByRole("alert").textContent?.includes("240 characters or fewer"));
  });
});
