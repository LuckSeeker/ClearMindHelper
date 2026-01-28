// Example Playwright E2E test
import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("should display welcome message", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1").first()).toContainText("Witaj w ClearMindHelper!");
  });
});
