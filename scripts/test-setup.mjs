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
globalThis.localStorage = dom.window.localStorage;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

// Anime.js target parsing uses global NodeList (jsdom only puts it on window).
globalThis.NodeList = dom.window.NodeList;
globalThis.HTMLCollection = dom.window.HTMLCollection;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.SVGElement = dom.window.SVGElement;

// Anime.js and other browser APIs read global requestAnimationFrame at module load.
if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(0), 0);
}
if (typeof globalThis.cancelAnimationFrame !== "function") {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
if (dom.window && typeof dom.window.requestAnimationFrame !== "function") {
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis);
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame.bind(globalThis);
}
