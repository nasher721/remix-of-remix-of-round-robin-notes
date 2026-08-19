import type { PaperSize, PrintSettings } from "./types";

export type { PaperSize };

export const PAPER_SIZE_MM: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

export const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  a4: "A4",
  letter: "Letter",
};

export const DEFAULT_PAPER_SIZE: PaperSize = "a4";

export const MARGIN_MM_BY_SETTING = {
  narrow: 10,
  normal: 15,
  wide: 20,
} as const;

type PageSettingSource = Pick<PrintSettings, "printOrientation" | "margins" | "paperSize">;

export const getPageMetrics = (settings: PageSettingSource) => {
  const paperSize = settings.paperSize && PAPER_SIZE_MM[settings.paperSize]
    ? settings.paperSize
    : DEFAULT_PAPER_SIZE;
  const base = PAPER_SIZE_MM[paperSize];
  const oriented =
    settings.printOrientation === "landscape"
      ? { width: base.height, height: base.width }
      : base;
  const margin = MARGIN_MM_BY_SETTING[settings.margins] ?? MARGIN_MM_BY_SETTING.normal;

  return {
    paperSize,
    widthMm: oriented.width,
    heightMm: oriented.height,
    marginMm: margin,
  };
};

/** CSS body for the `@page` rule shared by browser print (`window.print()`) */
export const getPageCss = (settings: PageSettingSource): string => {
  const { paperSize, marginMm } = getPageMetrics(settings);
  const orientation =
    settings.printOrientation === "landscape" ? "landscape" : "portrait";
  return `size: ${paperSize} ${orientation}; margin: ${marginMm}mm;`;
};
