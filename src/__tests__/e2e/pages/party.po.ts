import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model dla strony party
 * Enkapsuluje selektory i akcje na stronie /party
 */
export class PartyPage {
  readonly page: Page;

  // Selektory
  private readonly startPartyButton: Locator;
  private readonly partyHeader: Locator;
  private readonly bacIndicator: Locator;
  private readonly addDrinkButton: Locator;
  private readonly drinksTable: Locator;
  private readonly closePartyButton: Locator;
  private readonly alertsPanel: Locator;

  // Modal selektory
  private readonly drinkModal: Locator;
  private readonly drinkVolumeInput: Locator;
  private readonly drinkAbvInput: Locator;
  private readonly drinkTimeInput: Locator;
  private readonly drinkSubmitButton: Locator;
  private readonly drinkModalCloseButton: Locator;
  private readonly alertModalCloseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.startPartyButton = page.locator('[data-testid="start-party-btn"]');
    this.partyHeader = page.locator('[data-testid="party-header"]');
    this.bacIndicator = page.locator('[data-testid="bac-indicator"]');
    this.addDrinkButton = page.locator('[data-testid="add-drink-btn"]');
    this.drinksTable = page.locator('[data-testid="drinks-table"]');
    this.closePartyButton = page.locator('[data-testid="close-party-btn"]');
    this.alertsPanel = page.locator('[data-testid="alerts-panel"]');

    // Modal
    this.drinkModal = page.locator('[data-testid="drink-modal"]');
    this.drinkVolumeInput = page.locator('input[name="volume_ml"]');
    this.drinkAbvInput = page.locator('input[name="abv_percent"]');
    this.drinkTimeInput = page.locator('input[type="datetime-local"]');
    this.drinkSubmitButton = this.drinkModal.locator('button[type="submit"]');
    this.drinkModalCloseButton = this.drinkModal.locator('[data-testid="modal-close-btn"]');

    // Alert modal close button
    this.alertModalCloseButton = page.locator('[data-testid="alert-modal-close"]');
  }

  async goto() {
    await this.page.goto("/party");
    await this.page.waitForLoadState("networkidle");
  }

  async startParty() {
    // Wait for button to be rendered and visible
    await this.startPartyButton.waitFor({ state: "visible", timeout: 2000 });

    // Give React more time to fully attach event listeners after hydration
    // This is critical for Astro client:load components
    await this.page.waitForTimeout(500);

    // Wait for POST request to /api/parties
    const responsePromise = this.page.waitForResponse(
      (response) => {
        return response.url().includes("/api/parties") && response.request().method() === "POST";
      },
      { timeout: 5000 }
    );

    // Dispatch browser events to trigger React's synthetic event system
    // This is the ONLY approach that works reliably with React + Astro hydration
    await this.page.evaluate(() => {
      const btn = document.querySelector('[data-testid="start-party-btn"]') as HTMLButtonElement | null;
      if (btn) {
        // Dispatch all three events in sequence - this is required for React
        btn.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            view: window,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
          })
        );

        btn.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          })
        );

        btn.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            cancelable: true,
            view: window,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
          })
        );
      }
    });

    try {
      const response = await responsePromise;
      if (!response.ok()) {
        throw new Error(`API error: ${response.status()}`);
      }
    } catch (e) {
      throw new Error(`Failed to start party: ${e}`);
    }

    // Wait for network to settle
    await this.page.waitForLoadState("networkidle");
  }

  async waitForPartyStarted() {
    // Party header powinien być widoczny
    await this.partyHeader.waitFor({ state: "visible", timeout: 2000 });
    // Start button znika, pojawia się Close party
    await this.closePartyButton.waitFor({ state: "visible", timeout: 2000 });
  }

  async openAddDrinkModal() {
    await this.addDrinkButton.waitFor({ state: "visible", timeout: 2000 });
    await this.addDrinkButton.click();
    await this.drinkModal.waitFor({ state: "visible", timeout: 2000 });
  }

  async closeAddDrinkModal() {
    await this.drinkModalCloseButton.click();
    await this.drinkModal.waitFor({ state: "hidden", timeout: 2000 });
  }

  async addDrink(drink: { volume: number; abv: number; time?: string }) {
    await this.openAddDrinkModal();

    // Wpisz dane napoju
    await this.drinkVolumeInput.fill(drink.volume.toString());
    await this.drinkAbvInput.fill(drink.abv.toString());

    // Opcjonalnie ustaw czas
    if (drink.time) {
      await this.drinkTimeInput.fill(drink.time);
    }

    // Wyślij formularz
    await this.drinkSubmitButton.click();

    // Czekaj aż modal się zamknie
    await this.drinkModal.waitFor({ state: "hidden", timeout: 2000 });

    // Czekaj aż napój pojawi się w tabeli
    await this.page.waitForTimeout(500); // Give API time to process

    // Zamknij AlertModal jeśli się pojawił (np. threshold exceeded)
    const alertCloseBtn = this.alertModalCloseButton;
    const isAlertVisible = await alertCloseBtn.isVisible({ timeout: 1000 }).catch(() => false);
    if (isAlertVisible) {
      await alertCloseBtn.click();
      await this.page.waitForTimeout(300);
    }
  }

  async editDrink(drinkIndex: number, newData: { volume?: number; abv?: number }) {
    // Zamknij AlertModal jeśli się pojawił przed kliknięciem edit button
    const alertCloseBtn = this.alertModalCloseButton;
    const isAlertVisible = await alertCloseBtn.isVisible({ timeout: 1000 }).catch(() => false);
    if (isAlertVisible) {
      await alertCloseBtn.click();
      await this.page.waitForTimeout(300);
    }

    // Kliknij edit button dla danego napoju (n-ty rząd)
    const editButton = this.drinksTable
      .locator("button")
      .filter({ hasText: /edytuj|edit/i })
      .nth(drinkIndex);
    await editButton.waitFor({ state: "visible", timeout: 2000 });
    await editButton.click();

    // Czekaj na modal
    await this.drinkModal.waitFor({ state: "visible", timeout: 2000 });

    // Zmień wartości
    if (newData.volume !== undefined) {
      await this.drinkVolumeInput.fill(newData.volume.toString());
      await this.drinkVolumeInput.blur();
    }
    if (newData.abv !== undefined) {
      await this.drinkAbvInput.fill(newData.abv.toString());
      await this.drinkAbvInput.blur();
    }

    // Zapisz
    await this.drinkSubmitButton.waitFor({ state: "visible", timeout: 2000 });
    await this.drinkSubmitButton.click();

    // Czekaj na AlertModal jeśli się pojawił po edycji (np. threshold exceeded)
    // Timeout musi być długi bo AlertModal może pojawiać się z opóźnieniem
    const isAlertVisibleAfterEdit = await alertCloseBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (isAlertVisibleAfterEdit) {
      await alertCloseBtn.click();
      await this.page.waitForTimeout(500);
    }

    await this.drinkModal.waitFor({ state: "hidden", timeout: 3000 });
  }

  async getCurrentBAC(): Promise<number | null> {
    try {
      const bacIndicator = await this.bacIndicator.isVisible({ timeout: 5000 });
      if (!bacIndicator) {
        return null;
      }
      const bacText = await this.bacIndicator.locator("[data-testid='bac-value']").textContent({ timeout: 5000 });
      if (!bacText) return null;
      const match = bacText.match(/[\d.]+/);
      return match ? parseFloat(match[0]) : null;
    } catch (error) {
      await this.page.screenshot({ path: `debug-bac-${Date.now()}.png` });
      throw error;
    }
  }

  async getThresholdStatus(): Promise<"safe" | "approaching" | "exceeded" | null> {
    const statusClass = await this.bacIndicator.getAttribute("class");
    if (!statusClass) return null;
    if (statusClass.includes("exceeded")) return "exceeded";
    if (statusClass.includes("approaching")) return "approaching";
    return "safe";
  }

  async waitForThresholdApproaching() {
    // Czekaj aż status zmieni się na "approaching"
    await this.page.waitForFunction(
      async () => {
        const bacIndicator = await this.page.locator('[data-testid="bac-indicator"]').getAttribute("class");
        return bacIndicator?.includes("approaching");
      },
      { timeout: 15000 }
    );
  }

  async waitForThresholdExceeded() {
    // Czekaj aż status zmieni się na "exceeded"
    await this.page.waitForFunction(
      async () => {
        const bacIndicator = await this.page.locator('[data-testid="bac-indicator"]').getAttribute("class");
        return bacIndicator?.includes("exceeded");
      },
      { timeout: 15000 }
    );
  }

  async getAlerts(): Promise<string[]> {
    // Pobierz wszystkie alerty z panelu
    const alertElements = await this.alertsPanel.locator("[data-testid='alert-item']").all();
    const alerts: string[] = [];

    for (const alert of alertElements) {
      const text = await alert.textContent();
      if (text) alerts.push(text.trim());
    }

    return alerts;
  }

  async waitForAlert(pattern: RegExp, timeout = 10000) {
    // Czekaj aż pojawi się alert pasujący do pattern
    await this.page.waitForFunction(
      async () => {
        const alerts = await this.getAlerts();
        return alerts.some((alert) => pattern.test(alert));
      },
      { timeout }
    );
  }

  async closeParty() {
    await this.closePartyButton.click();
  }

  async waitForPartyClosing() {
    // Po kliknięciu Close Party pojawia się modal blackout
    const blackoutModal = this.page.locator('[data-testid="blackout-modal"]');
    await blackoutModal.waitFor({ state: "visible", timeout: 5000 });
  }

  async markBlackout(blackout: boolean) {
    if (blackout) {
      const blackoutButton = this.page.locator('[data-testid="blackout-yes-btn"]');
      await blackoutButton.click();
    } else {
      const noBlackoutButton = this.page.locator('[data-testid="blackout-no-btn"]');
      await noBlackoutButton.click();
    }
  }

  async waitForPartyClosedConfirmation() {
    // Po zamknięciu party, czekaj na potwierdzenie
    const successMessage = this.page.locator('[data-testid="party-closed-message"]');
    await successMessage.waitFor({ state: "visible", timeout: 5000 });
  }

  async getPartyStats(): Promise<{
    drinkCount: number;
    maxBAC: number | null;
  }> {
    const drinkCount = await this.drinksTable.locator("tbody tr").count();
    const maxBacText = await this.page.locator('[data-testid="max-bac-value"]').textContent();
    const maxBAC = maxBacText ? parseFloat(maxBacText.match(/[\d.]+/)?.[0] || "0") : null;

    return { drinkCount, maxBAC };
  }
}
