import type { PaperSize, PrintSettings } from "./types";
import { DEFAULT_CONFIG } from "@/constants/config";

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

export const MIN_PRINT_SECTION_SPACING = 0;
export const MAX_PRINT_SECTION_SPACING = 40;

export const normalizePrintSectionSpacing = (value: unknown): number => {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_CONFIG.PRINT_SECTION_SPACING;
  }
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return DEFAULT_CONFIG.PRINT_SECTION_SPACING;
  return Math.min(MAX_PRINT_SECTION_SPACING, Math.max(MIN_PRINT_SECTION_SPACING, numericValue));
};

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
