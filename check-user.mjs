#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Wczytaj zmienne z .env.test
dotenv.config({ path: ".env.test" });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || "https://icgvxbjclrqimbkqlcex.supabase.co";
const supabaseAnonKey = process.env.PUBLIC_SUPABASE_KEY || "sb_publishable_qKrdiVYpq0zG_wR_dlaZpA_F_T-eF_6";

const email = process.env.E2E_USERNAME || "e2etest@gmail.com";
const password = process.env.E2E_PASSWORD || "E2ETestPassword123!";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log(`\nAttempting to sign in with: ${email}`);
  console.log(`Using Supabase URL: ${supabaseUrl}\n`);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("❌ Login failed:");
    console.error("   Error code:", error.status);
    console.error("   Error message:", error.message);
    console.error("   Error name:", error.name);

    if (error.message.includes("Email not confirmed")) {
      console.error("\n⚠️  EMAIL NOT CONFIRMED!");
      console.error("   You need to confirm the email in Supabase dashboard");
      console.error("   Or disable email confirmation in Auth settings");
    }
  } else {
    console.log("✅ Login successful!");
    console.log("   User ID:", data.user?.id);
    console.log("   Email:", data.user?.email);
    console.log("   Email confirmed:", data.user?.email_confirmed_at ? "YES ✓" : "NO ✗");
    console.log("   Created at:", data.user?.created_at);
  }
}

main();
