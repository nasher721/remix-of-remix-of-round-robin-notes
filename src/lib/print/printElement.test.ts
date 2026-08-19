import assert from "node:assert/strict";
import test from "node:test";

import { printElement } from "./printElement";

test("printElement clones only the prepared report into a temporary print root", async () => {
  const source = document.createElement("div");
  source.dataset.printDocument = "";
  source.textContent = "Prepared patient report";
  document.body.appendChild(source);

  let printedRoot: Element | null = null;
  const originalPrint = window.print;
  window.print = () => {
    printedRoot = document.querySelector("[data-browser-print-root]");
    window.dispatchEvent(new Event("afterprint"));
  };

  try {
    await printElement(source);
    assert.ok(printedRoot);
    assert.match((printedRoot as Element).textContent ?? "", /Prepared patient report/);
    assert.equal(document.documentElement.classList.contains("print-export-active"), false);
    assert.equal(document.querySelector("[data-browser-print-root]"), null);
  } finally {
    window.print = originalPrint;
    source.remove();
  }
});

test("printElement rejects a missing report instead of printing unrelated page chrome", async () => {
  await assert.rejects(() => printElement(null), /report is not ready/i);
});

test("printElement scopes the @page rule to the print run and restores it after", async () => {
  const source = document.createElement("div");
  source.textContent = "Styled report";
  document.body.appendChild(source);

  const originalPrint = window.print;
  window.print = () => {
    window.dispatchEvent(new Event("afterprint"));
  };

  try {
    await printElement(source, { pageStyle: "size: letter landscape; margin: 10mm;" });
    const pageRule = Array.from(document.head.querySelectorAll("style"))
      .find((el) => el.textContent?.includes("@page"));
    assert.equal(pageRule, undefined);
  } finally {
    window.print = originalPrint;
    source.remove();
  }
});

test("printElement saves and restores document.title around the print dialog", async () => {
  const source = document.createElement("div");
  source.textContent = "Titled report";
  document.body.appendChild(source);
  const originalTitle = document.title;

  const originalPrint = window.print;
  window.print = () => {
    window.dispatchEvent(new Event("afterprint"));
  };

  try {
    document.title = "Original Title";
    await printElement(source, { title: "Patient Rounding Report" });
    assert.equal(document.title, "Original Title");
  } finally {
    document.title = originalTitle;
    window.print = originalPrint;
    source.remove();
  }
});

test("printElement waits for the report's images to finish loading before printing", async () => {
  const source = document.createElement("div");
  const image = document.createElement("img");
  // Absent a fetched src, jsdom marks images complete=true; use a URL so the
  // clone must actually wait until we dispatch the load event below.
  image.setAttribute("src", "https://example.com/patient-image.png");
  source.appendChild(image);
  document.body.appendChild(source);

  let printed = false;
  const originalPrint = window.print;
  window.print = () => {
    printed = true;
    window.dispatchEvent(new Event("afterprint"));
  };

  try {
    const promise = printElement(source);
    // Not printed yet — the cloned <img> is still loading.
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(printed, false);
    const clonedImage = document.querySelector<HTMLImageElement>(
      "[data-browser-print-root] img",
    );
    clonedImage?.dispatchEvent(new Event("load"));
    await promise;
    assert.equal(printed, true);
  } finally {
    window.print = originalPrint;
    source.remove();
  }
});
