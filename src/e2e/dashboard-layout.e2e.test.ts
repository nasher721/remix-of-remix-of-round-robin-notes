/**
 * Dashboard Layout E2E Tests
 * 
 * Tests for dashboard panel collapse, focus mode, and systems layout behaviors.
 * Run with: npm run test:e2e
 */

import { test, expect, type Page } from "@playwright/test";

const DASHBOARD_URL = "/dashboard";

test.describe("Dashboard Panel Collapse", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
  });

  test("collapse left panel increases center workspace", async ({ page }) => {
    // Get initial center content width
    const initialWidth = await page.locator(".flex-1").first().evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width;
    });

    // Click collapse button (assuming it's in header)
    const collapseButton = page.locator('button[aria-label*="panel"], button:has(svg)').first();
    await collapseButton.click();

    // Verify center content expanded
    const expandedWidth = await page.locator(".flex-1").first().evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width;
    });

    expect(expandedWidth).toBeGreaterThan(initialWidth);
  });

  test("panel state persists after reload", async ({ page }) => {
    // Collapse panels
    const collapseButton = page.locator('button[aria-label*="panel"]').first();
    await collapseButton.click();

    // Verify collapsed state is visible
    await expect(page.locator('[data-panel-collapsed="true"]')).toBeVisible();

    // Reload page
    await page.reload();

    // Verify state persisted
    await expect(page.locator('[data-panel-collapsed="true"]')).toBeVisible();
  });
});

test.describe("Focus Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
  });

  test("clicking editor enters focus mode", async ({ page }) => {
    // Click on clinical summary editor
    const editor = page.locator('[data-editor-type="clinical-summary"]').first();
    await editor.click();

    // Verify focus mode is active
    await expect(page.locator('[data-focus-mode="true"]')).toBeVisible();
  });

  test("Escape key exits focus mode", async ({ page }) => {
    // Enter focus mode
    const editor = page.locator('[data-editor-type="clinical-summary"]').first();
    await editor.click();
    await expect(page.locator('[data-focus-mode="true"]')).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Verify focus mode exited
    await expect(page.locator('[data-focus-mode="true"]')).not.toBeVisible();
  });
});

test.describe("Systems Layout Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
  });

  test("switch to combine_all mode", async ({ page }) => {
    // Find and click mode selector
    const modeSelector = page.locator('[data-systems-mode-selector]');
    await modeSelector.click();

    // Select combine_all
    await page.locator('button:has-text("Combine All")').click();

    // Verify combined view is rendered
    await expect(page.locator('[data-systems-combined="true"]')).toBeVisible();
  });

  test("custom combine selection", async ({ page }) => {
    // Find and click mode selector
    const modeSelector = page.locator('[data-systems-mode-selector]');
    await modeSelector.click();

    // Select custom combine
    await page.locator('button:has-text("Custom Combine")').click();

    // Select specific systems
    await page.locator('input[type="checkbox"]:has-text("Cardiovascular")').check();
    await page.locator('input[type="checkbox"]:has-text("Neurological")').check();

    // Verify custom view
    await expect(page.locator('[data-systems-custom="true"]')).toBeVisible();
  });

  test("split mode restores individual cards", async ({ page }) => {
    // First combine all
    const modeSelector = page.locator('[data-systems-mode-selector]');
    await modeSelector.click();
    await page.locator('button:has-text("Combine All")').click();

    // Then switch back to split
    await modeSelector.click();
    await page.locator('button:has-text("Split")').click();

    // Verify individual cards are visible
    await expect(page.locator('[data-systems-card]').count()).toBeGreaterThan(1);
  });
});

test.describe("Accessibility", () => {
  test("keyboard navigation to collapse button", async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });

    // Tab to find collapse button
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Button should be focusable
    const collapseButton = page.locator('button[aria-label*="panel"]').first();
    await expect(collapseButton).toBeFocused();

    // Should be able to activate with Enter
    await collapseButton.press("Enter");
    
    // Verify action worked (panel state changed)
    await expect(collapseButton).toHaveAttribute("aria-expanded", "true");
  });
});