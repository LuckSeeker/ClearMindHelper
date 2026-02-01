import type { Page, Locator } from "@playwright/test";

/**
 * Page Object Model dla strony profilu
 * Enkapsuluje selektory i akcje na stronie /profile
 */
export class ProfilePage {
  readonly page: Page;

  // Selektory
  private readonly profileForm: Locator;
  private readonly heightInput: Locator;
  private readonly weightInput: Locator;
  private readonly genderSelect: Locator;
  private readonly submitButton: Locator;
  private readonly thresholdCard: Locator;
  private readonly thresholdChangeButton: Locator;
  private readonly thresholdValue: Locator;
  private readonly successAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.profileForm = page.locator('[data-testid="profile-form"]');
    this.heightInput = page.locator('[data-testid="height-input"]');
    this.weightInput = page.locator('[data-testid="weight-input"]');
    this.genderSelect = page.locator('[data-testid="gender-select"]');
    this.submitButton = this.profileForm.locator('button[type="submit"]');
    this.thresholdCard = page.locator('[data-testid="threshold-card"]');
    this.thresholdChangeButton = page.locator('[data-testid="threshold-change-btn"]');
    this.thresholdValue = page.locator('[data-testid="threshold-value"]');
    this.successAlert = page.locator('[role="alert"]').filter({ hasText: /zapisany|zaaktualizowany/i });
  }

  async goto() {
    await this.page.goto("/profile");
    await this.page.waitForLoadState("networkidle");
  }

  async fillHeight(height: number) {
    await this.heightInput.fill(height.toString());
  }

  async fillWeight(weight: number) {
    await this.weightInput.fill(weight.toString());
  }

  async selectGender(gender: "M" | "F") {
    await this.genderSelect.selectOption(gender);
  }

  async submitForm() {
    await this.submitButton.click();
  }

  async waitForProfileSaved() {
    await this.successAlert.waitFor({ state: "visible", timeout: 5000 });
  }

  async setThreshold(bac: number) {
    // Kliknij przycisk "Zmień próg" aby otworzyć modal
    const thresholdChangeBtn = this.page.locator('[data-testid="threshold-change-btn"]');
    await thresholdChangeBtn.click();

    // Czekaj na modal
    await this.page.waitForSelector("#threshold_bac", { state: "visible", timeout: 5000 });

    // Wypełnij input
    await this.page.fill("#threshold_bac", bac.toString());

    // Zaznacz checkbox potwierdzenia
    await this.page.check("#confirm");

    // Kliknij przycisk submit w modalu
    await this.page.click('button[type="submit"]:has-text("Zmień próg")');

    // Czekaj aż modal się zamknie
    await this.page.waitForSelector("#threshold_bac", { state: "hidden", timeout: 5000 });
  }

  async saveThreshold() {
    const saveButton = this.page.locator('[data-testid="threshold-save-btn"]').first();
    if (await saveButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await saveButton.click();
    }
    await this.waitForProfileSaved();
  }

  async getDisplayedThreshold(): Promise<number | null> {
    const thresholdText = await this.thresholdValue.textContent();
    if (!thresholdText) return null;
    const match = thresholdText.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  }

  async getDisplayedHeight(): Promise<number | null> {
    const value = await this.heightInput.inputValue();
    return value ? parseInt(value) : null;
  }

  async getDisplayedWeight(): Promise<number | null> {
    const value = await this.weightInput.inputValue();
    return value ? parseFloat(value) : null;
  }
}
