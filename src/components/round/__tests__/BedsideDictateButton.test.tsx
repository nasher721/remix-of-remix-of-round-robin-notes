import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BedsideDictateButton } from "../BedsideDictateButton";

afterEach(cleanup);

describe("BedsideDictateButton", () => {
  it("renders idle dictate button with accessible aria label", () => {
    render(
      <BedsideDictateButton
        systemLabel="Respiratory"
        onTranscript={() => {}}
      />,
    );

    const button = screen.getByRole("button", { name: "Dictate notes for Respiratory" });
    assert.ok(button);
    assert.equal(button.getAttribute("aria-pressed"), "false");
  });

  it("handles click and attempts to start session", () => {
    let transcriptReceived = "";
    render(
      <BedsideDictateButton
        systemLabel="Cardiovascular"
        onTranscript={(text) => {
          transcriptReceived = text;
        }}
      />,
    );

    const button = screen.getByRole("button", { name: "Dictate notes for Cardiovascular" });
    fireEvent.click(button);
    // In node environment without browser SpeechRecognition, it shows toast info without crashing
    assert.equal(transcriptReceived, "");
  });
});
