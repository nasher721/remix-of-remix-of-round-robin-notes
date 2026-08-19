const PRINT_ACTIVE_CLASS = "print-export-active";
const FALLBACK_CLEANUP_MS = 5 * 60 * 1000;
const IMAGE_WAIT_TIMEOUT_MS = 10_000;

type PrintOutcome = "resolve" | "reject";

export interface PrintElementOptions {
  /** CSS body for a scoped `@page` rule (e.g. from `getPageCss`), applied only while printing. */
  pageStyle?: string;
  /** Temporary `document.title` during print — browser PDFs default to this filename. */
  title?: string;
  /** Wait for the report's images to load before opening the print dialog. Default: true. */
  waitForImages?: boolean;
}

/**
 * `cloneNode(true)` copies the DOM but canvases always come out blank,
 * silently dropping charts from printed output. Redraw each canvas into its clone.
 */
const cloneNodeWithCanvases = (source: HTMLElement): HTMLElement => {
  const clone = source.cloneNode(true) as HTMLElement;
  const sourceCanvases = source.querySelectorAll("canvas");
  const cloneCanvases = clone.querySelectorAll("canvas");
  sourceCanvases.forEach((sourceCanvas, index) => {
    const target = cloneCanvases[index];
    try {
      const ctx = target?.getContext("2d");
      ctx?.drawImage(sourceCanvas, 0, 0);
    } catch {
      // Tainted or zero-size canvases are left blank rather than failing the print.
    }
  });
  return clone;
};

/** Resolve once every image in the report has finished (or errored), with a safety timeout. */
const waitForImages = (root: HTMLElement | null, timeoutMs = IMAGE_WAIT_TIMEOUT_MS) => {
  const images = root ? Array.from(root.querySelectorAll("img")) : [];
  if (images.length === 0) return Promise.resolve();
  const pending = images.map(
    (img) =>
      new Promise<void>((resolve) => {
        if (img.complete) {
          resolve();
          return;
        }
        img.addEventListener("load", () => resolve());
        img.addEventListener("error", () => resolve());
      }),
  );
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs));
  return Promise.race([Promise.all(pending).then(() => undefined), timeout]);
};

/**
 * Print a disposable clone of the prepared report — never the surrounding app UI.
 *
 * Resolves when the print dialog finishes (`afterprint`) or after a long fallback
 * timeout, so embedded browsers that omit `afterprint` still clean up. Callers can
 * await completion to show feedback and re-enable the button.
 */
export function printElement(
  source: HTMLElement | null,
  options: PrintElementOptions = {},
): Promise<void> {
  if (!source) {
    return Promise.reject(new Error("The print report is not ready yet."));
  }

  const { pageStyle, title, waitForImages: shouldWaitForImages = true } = options;

  document.querySelectorAll("[data-browser-print-root]").forEach((root) => root.remove());

  const printRoot = document.createElement("div");
  printRoot.dataset.browserPrintRoot = "";
  printRoot.appendChild(cloneNodeWithCanvases(source));

  let pageStyleEl: HTMLStyleElement | null = null;
  if (pageStyle) {
    pageStyleEl = document.createElement("style");
    pageStyleEl.textContent = `@page { ${pageStyle} }`;
  }

  const previousTitle = title ? document.title : null;

  return new Promise<void>((resolve, reject) => {
    let cleanupTimer: number | undefined;
    let settled = false;

    const cleanup = (outcome: PrintOutcome, error?: unknown) => {
      if (settled) return;
      settled = true;
      if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
      window.removeEventListener("afterprint", onAfterPrint);
      document.documentElement.classList.remove(PRINT_ACTIVE_CLASS);
      printRoot.remove();
      pageStyleEl?.remove();
      if (previousTitle !== null) document.title = previousTitle;
      if (outcome === "reject") reject(error);
      else resolve();
    };

    const onAfterPrint = () => cleanup("resolve");

    // Mount the clone first so image-loading can be observed, then print.
    document.body.appendChild(printRoot);
    if (pageStyleEl) document.head.appendChild(pageStyleEl);
    document.documentElement.classList.add(PRINT_ACTIVE_CLASS);
    if (title) document.title = title;

    const startPrint = () => {
      window.addEventListener("afterprint", onAfterPrint, { once: true });
      try {
        window.print();
        // Some embedded browsers omit `afterprint`; keep the invisible clone from
        // accumulating indefinitely without racing an asynchronous print dialog.
        if (!settled) cleanupTimer = window.setTimeout(() => cleanup("resolve"), FALLBACK_CLEANUP_MS);
      } catch (error) {
        cleanup("reject", error);
      }
    };

    if (shouldWaitForImages) {
      void waitForImages(printRoot).then(startPrint);
    } else {
      startPrint();
    }
  });
}
