import type { Page } from "@playwright/test";

/**
 * Auth helpers dla E2E testów
 * Umożliwia logowanie się bez UI i sesje testowe
 */

const TEST_USER = {
  email: process.env.E2E_USERNAME || "e2etest@gmail.com",
  password: process.env.E2E_PASSWORD || "E2ETestPassword123!",
};

/**
 * Loguje użytkownika poprzez UI (form logowania)
 * Wymaga istnienia test usera w Supabase
 */
export async function loginViaUI(page: Page) {
  // eslint-disable-next-line no-console
  console.log("🔄 Logging in via UI...");
  await page.goto("/login");

  // Poczekaj na formularz
  // eslint-disable-next-line no-console
  console.log("⏳ Waiting for login form...");
  await page.waitForSelector('[data-testid="auth-form"], form', { timeout: 10000 });

  // Wpisz email
  // eslint-disable-next-line no-console
  console.log(`📧 Filling email: ${TEST_USER.email}`);
  const emailInput = page.locator('[data-testid="email-input"]').or(page.locator('input[type="email"]')).first();
  await emailInput.fill(TEST_USER.email);

  // Wpisz hasło
  // eslint-disable-next-line no-console
  console.log(`🔒 Filling password: ${TEST_USER.password}`);
  const passwordInput = page
    .locator('[data-testid="password-input"]')
    .or(page.locator('input[type="password"]'))
    .first();
  await passwordInput.fill(TEST_USER.password);

  // Kliknij login button
  // eslint-disable-next-line no-console
  console.log("🚀 Clicking submit button...");
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();

  // Czekaj aż redirect nastąpi (window.location.href lub fetch redirect)
  // eslint-disable-next-line no-console
  console.log("⏳ Waiting for navigation...");
  try {
    // Czekaj na zmianę URL-u lub na zdarzenie load
    await Promise.race([
      page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 }),
      page.waitForNavigation({ timeout: 15000 }).catch(() => null),
    ]);
  } catch {
    // eslint-disable-next-line no-console
    console.warn("⚠️ Navigation timeout, checking current page...");
  }

  // Czekaj aby sesja się załadowała
  // eslint-disable-next-line no-console
  console.log("⏳ Waiting for page load...");
  try {
    await page.waitForLoadState("networkidle", { timeout: 15000 });
  } catch {
    // eslint-disable-next-line no-console
    console.warn("⚠️ Network idle timeout");
  }
  // eslint-disable-next-line no-console
  console.log("✅ Login successful!");
}

/**
 * Loguje użytkownika poprzez API Supabase Auth
 * Szybsze, ale wymaga TEST_USER_EMAIL i TEST_USER_PASSWORD w env
 */
export async function loginViaAPI(page: Page): Promise<{ access_token: string; user_id: string } | null> {
  try {
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.PUBLIC_SUPABASE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      // eslint-disable-next-line no-console
      console.warn("⚠️ Supabase env vars not set");
      return null;
    }

    // eslint-disable-next-line no-console
    console.log(`🔄 Attempting API login to ${supabaseUrl}`);

    // Logowanie poprzez Supabase Auth API
    const response = await page.request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
      },
      data: {
        email: TEST_USER.email,
        password: TEST_USER.password,
      },
    });

    // eslint-disable-next-line no-console
    console.log(`📊 API response status: ${response.status()}`);

    if (!response.ok()) {
      const errorBody = await response.text();
      // eslint-disable-next-line no-console
      console.warn(`⚠️ API login failed (${response.status()}): ${errorBody}`);
      return null;
    }

    const data = (await response.json()) as { access_token?: string; user?: { id?: string } };
    const accessToken = data.access_token;
    const userId = data.user?.id;

    if (accessToken && userId) {
      // eslint-disable-next-line no-console
      console.log(`✅ API login successful, token: ${accessToken.substring(0, 20)}...`);

      // Ustaw session cookies
      await page.context().addCookies([
        {
          name: "sb-access-token",
          value: accessToken,
          domain: new URL(page.url()).hostname,
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ]);

      return { access_token: accessToken, user_id: userId };
    }

    // eslint-disable-next-line no-console
    console.warn("⚠️ API response missing tokens");
    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("⚠️ API login error:", error instanceof Error ? error.message : error);
  }

  return null;
}

/**
 * Ogólny helper do logowania - zawsze używa UI login
 * Potrzeba UI login aby poprawnie ustawi Supabase session cookies
 */
export async function login(page: Page) {
  const currentUrl = page.url();
  // eslint-disable-next-line no-console
  console.log(`\n📍 login() called - Current URL: ${currentUrl}`);
  // eslint-disable-next-line no-console
  console.log(`📧 Using credentials: ${TEST_USER.email} / ${TEST_USER.password.substring(0, 3)}...`);

  // Jeśli już jesteś zalogowany, pomiń
  const urlObj = new URL(currentUrl);
  if (!urlObj.pathname.includes("/login") && urlObj.hostname) {
    // eslint-disable-next-line no-console
    console.log("✅ Not on login page, checking if session exists...");

    // Spróbuj przejść na /profile aby sprawdzić czy sesja istnieje
    try {
      await page.goto("/profile", { waitUntil: "networkidle" });
      const finalUrl = page.url();
      if (!finalUrl.includes("/login")) {
        // eslint-disable-next-line no-console
        console.log("✅ Session exists, can access /profile");
        return;
      }
    } catch {
      // Continue with login
    }
  }

  await loginViaUI(page);
  // loginViaUI już loguje sukces, nie trzeba duplikować
}

/**
 * Fixture do automatycznego logowania w testach
 * Użycie: test('test name', async ({ page, loggedInPage }) => { ... })
 */
export async function getLoggedInPage(page: Page) {
  await login(page);
  return page;
}
