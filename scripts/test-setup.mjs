/**
 * Test setup for hook tests: provides a minimal DOM via jsdom so React and
 * @testing-library/react can run. Load with: node --import ./scripts/test-setup.mjs ...
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"root\"></div></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
