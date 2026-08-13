import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ServiceWorkerUpdatePrompt } from "@/components/ServiceWorkerUpdatePrompt";
import {
  clearServiceWorkerUpdateReady,
  markServiceWorkerUpdateReady,
} from "@/lib/serviceWorkerUpdate";

afterEach(() => {
  cleanup();
  clearServiceWorkerUpdateReady();
});

describe("ServiceWorkerUpdatePrompt", () => {
  it("surfaces a ready production update and lets the user refresh deliberately", () => {
    let reloads = 0;
    render(<ServiceWorkerUpdatePrompt onReload={() => { reloads += 1; }} />);

    assert.equal(screen.queryByRole("status"), null);
    act(() => markServiceWorkerUpdateReady());

    assert.ok(screen.getByRole("status"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));
    assert.equal(reloads, 1);
    assert.equal(screen.queryByRole("status"), null);
  });

  it("allows a clinician to defer the refresh without reloading mid-edit", () => {
    let reloads = 0;
    markServiceWorkerUpdateReady();
    render(<ServiceWorkerUpdatePrompt onReload={() => { reloads += 1; }} />);

    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    assert.equal(reloads, 0);
    assert.equal(screen.queryByRole("status"), null);
  });
});
