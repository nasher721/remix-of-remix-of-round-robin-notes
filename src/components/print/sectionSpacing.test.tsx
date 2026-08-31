import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { PrintSettings } from "./PrintSettings";
import {
  defaultColumns,
  defaultColumnWidths,
  defaultCombinedColumnWidths,
} from "./constants";
import type { PrintSettings as PrintSettingsType } from "@/lib/print/types";
import { normalizePrintSectionSpacing } from "@/lib/print/layout";

afterEach(cleanup);

const settings: PrintSettingsType = {
  columns: defaultColumns,
  combinedColumns: [],
  printOrientation: "portrait",
  paperSize: "letter",
  printFontSize: 9,
  printFontFamily: "system",
  onePatientPerPage: false,
  autoFitFontSize: false,
  columnWidths: defaultColumnWidths,
  combinedColumnWidths: defaultCombinedColumnWidths,
  margins: "normal",
  headerStyle: "standard",
  borderStyle: "light",
  showPageNumbers: true,
  showTimestamp: true,
  alternateRowColors: true,
  compactMode: false,
  sectionSpacing: 24,
  activeTab: "cards",
  showNotesColumn: false,
  showTodosColumn: true,
};

test("standard print settings exposes an adjustable section-spacing control", () => {
  const updates: Array<Partial<PrintSettingsType>> = [];
  const { getByRole } = render(
    <PrintSettings
      settings={settings}
      onUpdateSettings={(update) => updates.push(update)}
      onUpdateColumns={() => undefined}
      onResetColumns={() => undefined}
    />,
  );

  const slider = getByRole("slider", { name: "Section spacing" });
  assert.equal(slider.getAttribute("aria-valuenow"), "24");

  fireEvent.keyDown(slider, { key: "ArrowRight" });
  assert.deepEqual(updates.at(-1), { sectionSpacing: 25 });
});

test("saved section spacing is clamped to the supported range", () => {
  assert.equal(normalizePrintSectionSpacing("not-a-number"), 16);
  assert.equal(normalizePrintSectionSpacing(-4), 0);
  assert.equal(normalizePrintSectionSpacing(99), 40);
});
