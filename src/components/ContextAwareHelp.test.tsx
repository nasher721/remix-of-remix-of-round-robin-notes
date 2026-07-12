import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ContextAwareHelp } from "@/components/ContextAwareHelp";

globalThis.NodeFilter = window.NodeFilter;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement;

afterEach(() => {
  cleanup();
});

describe("ContextAwareHelp", () => {
  it("opens dashboard-specific help from the floating help button", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ContextAwareHelp />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Get Help" }));

    assert.ok(await screen.findByText("Dashboard Help"));
    assert.ok(screen.getByText(/Add Patient:/));
    assert.ok(screen.getByText(/Smart Import/));
  });

  it("closes help from the popover close button", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ContextAwareHelp />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "Get Help" });
    trigger.focus();
    fireEvent.click(trigger);
    assert.ok(await screen.findByText("Dashboard Help"));

    const closeButton = screen
      .getAllByRole("button")
      .find((button) => button !== trigger && button.closest('[data-radix-popper-content-wrapper]'));
    assert.ok(closeButton, "expected a close button inside help content");
    fireEvent.click(closeButton);

    assert.equal(screen.queryByText("Dashboard Help"), null);
  });
});
