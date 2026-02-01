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
  console.log(`Creating test user: ${email}`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("Error creating user:", error.message);
    process.exit(1);
  } else {
    console.log("✅ User created:", data.user?.id);
    console.log("📧 Email:", data.user?.email);
    console.log("\n⚠️  User email confirmed. Ready for testing!");
  }
}

main();
