import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";

const TEST_USER = {
  email: process.env.E2E_USERNAME || "e2etest@gmail.com",
  password: process.env.E2E_PASSWORD || "E2ETestPassword123!",
};

/**
 * Czyści wszystkie dane testowego użytkownika z bazy danych
 * Usuwa: parties, drinks, alerts, threshold_history, profiles
 */
export async function cleanupTestUserData() {
  const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || "https://icgvxbjclrqimbkqlcex.supabase.co";
  const supabaseAnonKey = process.env.PUBLIC_SUPABASE_KEY || "sb_publishable_qKrdiVYpq0zG_wR_dlaZpA_F_T-eF_6";

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

  // eslint-disable-next-line no-console
  console.log("🧹 Cleaning up test user data...");

  // Zaloguj się aby uzyskać user_id
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_USER.email,
    password: TEST_USER.password,
  });

  if (authError || !authData.user) {
    // eslint-disable-next-line no-console
    console.error("❌ Failed to authenticate for cleanup:", authError?.message);
    return;
  }

  const userId = authData.user.id;
  // eslint-disable-next-line no-console
  console.log(`🔑 Authenticated as user: ${userId}`);

  try {
    // 1. Usuń alerts (muszą być pierwsze bo mają FK do parties)
    const { error: alertsError } = await supabase.from("alerts").delete().eq("user_id", userId);

    if (alertsError) {
      // eslint-disable-next-line no-console
      console.warn("⚠️ Error deleting alerts:", alertsError.message);
    } else {
      // eslint-disable-next-line no-console
      console.log("✓ Deleted alerts");
    }

    // 2. Usuń drinks (muszą być przed parties bo mają FK)
    const { error: drinksError } = await supabase.from("drinks").delete().eq("user_id", userId);

    if (drinksError) {
      // eslint-disable-next-line no-console
      console.warn("⚠️ Error deleting drinks:", drinksError.message);
    } else {
      // eslint-disable-next-line no-console
      console.log("✓ Deleted drinks");
    }

    // 3. Usuń parties
    const { error: partiesError } = await supabase.from("parties").delete().eq("user_id", userId);

    if (partiesError) {
      // eslint-disable-next-line no-console
      console.warn("⚠️ Error deleting parties:", partiesError.message);
    } else {
      // eslint-disable-next-line no-console
      console.log("✓ Deleted parties");
    }

    // 4. Usuń threshold_history
    const { error: thresholdError } = await supabase.from("userthresholds").delete().eq("user_id", userId);

    if (thresholdError) {
      // eslint-disable-next-line no-console
      console.warn("⚠️ Error deleting threshold_history:", thresholdError.message);
    } else {
      // eslint-disable-next-line no-console
      console.log("✓ Deleted threshold_history");
    }

    // 5. Usuń profile
    const { error: profileError } = await supabase.from("userprofiles").delete().eq("user_id", userId);

    if (profileError) {
      // eslint-disable-next-line no-console
      console.warn("⚠️ Error deleting profile:", profileError.message);
    } else {
      // eslint-disable-next-line no-console
      console.log("✓ Deleted profile");
    }

    // eslint-disable-next-line no-console
    console.log("✅ Cleanup completed successfully!");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("❌ Unexpected error during cleanup:", error);
  } finally {
    // Wyloguj się
    await supabase.auth.signOut();
  }
}
