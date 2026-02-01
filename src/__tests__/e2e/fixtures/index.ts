import { test as base } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ProfilePage } from "../pages/profile.po";
import { PartyPage } from "../pages/party.po";
import { login } from "../auth";
import { cleanupTestUserData } from "../test-helpers";

interface TestFixtures {
  profilePage: ProfilePage;
  partyPage: PartyPage;
  loggedInPage: Page;
}

/**
 * Extended test fixture z pre-configured Page Objects
 * Umożliwia reuse'u setup-u między testami
 */
export const test = base.extend<TestFixtures>({
  profilePage: async ({ page }, load) => {
    const profilePage = new ProfilePage(page);
    await load(profilePage);
  },
  partyPage: async ({ page }, load) => {
    const partyPage = new PartyPage(page);
    await load(partyPage);
  },
  loggedInPage: async ({ page }, load) => {
    await login(page);
    await load(page);
  },
});

export { expect } from "@playwright/test";

/**
 * Helper do setup-u profilu (wieloużywany w testach)
 * Zakłada, że użytkownik będzie zalogowany poprzez setupUserProfile
 */
export async function setupUserProfile(
  page: Page,
  profileData: {
    height: number;
    weight: number;
    gender: "M" | "F";
    threshold?: number;
  }
) {
  // Wyczyść dane użytkownika przed testem
  await cleanupTestUserData();

  // eslint-disable-next-line no-console
  console.log("🔐 Setting up user profile...");

  // Zaloguj się - idź do /login jeśli trzeba
  await page.goto("/login");
  await login(page);

  // Przejdź do profilu
  // eslint-disable-next-line no-console
  console.log("📍 Going to /profile...");
  await page.goto("/profile", { waitUntil: "networkidle" });

  // Czekaj aż strona się załaduje
  // eslint-disable-next-line no-console
  console.log("⏳ Waiting for profile page to load...");
  const currentUrl = page.url();
  // eslint-disable-next-line no-console
  console.log(`📍 Current URL: ${currentUrl}`);

  if (currentUrl.includes("/login")) {
    // eslint-disable-next-line no-console
    console.error("❌ Still on /login after goto - login might have failed");
    const content = await page.content();
    // eslint-disable-next-line no-console
    console.error("❌ Page content sample:", content.substring(0, 800));
    throw new Error("Failed to navigate to /profile - login did not work");
  }

  await page.waitForLoadState("networkidle");

  // Czekaj na form
  // eslint-disable-next-line no-console
  console.log("⏳ Waiting for height input...");
  const heightInput = page
    .locator('[data-testid="height-input"]')
    .or(page.locator('input[name="height"]'))
    .or(page.locator('input[placeholder*="height" i]'))
    .first();

  try {
    await heightInput.waitFor({ state: "visible", timeout: 10000 });
  } catch {
    // eslint-disable-next-line no-console
    console.error("❌ Height input not found. Page URL:", page.url());
    const content = await page.content();
    // eslint-disable-next-line no-console
    console.error("❌ Page content sample:", content.substring(0, 800));
    throw new Error("Height input element not found on profile page");
  }

  const profilePage = new ProfilePage(page);

  // Wypełnij formularz
  // eslint-disable-next-line no-console
  console.log(`📝 Filling height: ${profileData.height}`);
  await profilePage.fillHeight(profileData.height);

  // eslint-disable-next-line no-console
  console.log(`📝 Filling weight: ${profileData.weight}`);
  await profilePage.fillWeight(profileData.weight);

  // eslint-disable-next-line no-console
  console.log(`📝 Selecting gender: ${profileData.gender}`);
  await profilePage.selectGender(profileData.gender);

  // Submit form (zapisz profil podstawowy)
  // eslint-disable-next-line no-console
  console.log("✅ Submitting profile form...");
  await profilePage.submitForm();

  // Czekaj na potwierdzenie zapisu (page reload lub network idle)
  // eslint-disable-next-line no-console
  console.log("⏳ Waiting for profile to save...");
  await page.waitForLoadState("networkidle");

  // Daj chwilę na zapisanie w bazie
  await page.waitForTimeout(1000);

  // Ustaw threshold jeśli podany (TERAZ, PO zapisaniu profilu)
  if (profileData.threshold) {
    // eslint-disable-next-line no-console
    console.log(`📝 Setting threshold: ${profileData.threshold}`);
    await profilePage.setThreshold(profileData.threshold);
    // setThreshold już zapisuje w modalu, nie trzeba saveThreshold
  }

  // eslint-disable-next-line no-console
  console.log("✅ Profile setup complete!");
}
