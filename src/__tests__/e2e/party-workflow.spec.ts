import { test, expect, setupUserProfile } from "./fixtures/index";
import { PartyPage } from "./pages/party.po";

/**
 * Test 2: Party workflow - dodawanie i edycja napojów
 *
 * Scenariusz:
 * - Setup: Profil z wzrostem/wagą/płcią
 * - Użytkownik przechodzi do /party
 * - Rozpoczyna party (kliknięcie Start Party)
 * - Dodaje napój (np. piwo 500ml, 5% ABV)
 * - Edytuje napój (zmienia objętość)
 * - Sprawdzamy czy BAC się zmienił
 */
test.describe("Party Workflow - Adding & Editing Drinks", () => {
  const profileData = {
    height: 180,
    weight: 75,
    gender: "M" as const,
    threshold: 0.1,
  };

  test.beforeEach(async ({ page }) => {
    // Przed każdym testem stwórz profil
    // Zakładamy że użytkownik jest zalogowany (auth bypass czy mockowanie)
    await setupUserProfile(page, profileData);
  });

  test("should start a party session", async ({ page }) => {
    const partyPage = new PartyPage(page);

    await page.goto("/party");

    // Kliknij Start Party
    await partyPage.startParty();

    // Czekaj aż party się rozpocznie
    await partyPage.waitForPartyStarted();

    // Sprawdź czy Close Party button jest widoczny
    const closeBtn = page.locator('[data-testid="close-party-btn"]');
    await expect(closeBtn).toBeVisible();
  });

  test("should add a drink and update BAC", async ({ page }) => {
    const partyPage = new PartyPage(page);

    await page.goto("/party");
    await partyPage.startParty();
    await partyPage.waitForPartyStarted();

    // Pobierz BAC przed dodaniem napoju
    const bacBefore = await partyPage.getCurrentBAC();

    // Dodaj napój (piwo 500ml, 5% ABV)
    await partyPage.addDrink({
      volume: 500,
      abv: 5,
    });

    // Czekaj aż BAC się zmieni (powinien wzrosnąć)
    await page.waitForTimeout(2000); // API timeout

    const bacAfter = await partyPage.getCurrentBAC();

    // BAC powinien wzrosnąć
    expect(bacAfter).toBeGreaterThan(bacBefore ?? 0);
  });
});
