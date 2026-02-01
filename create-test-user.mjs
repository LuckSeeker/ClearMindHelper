#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef, no-console */
/**
 * Script do stworzenia testowego użytkownika w Supabase
 * Używa Supabase Admin API
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Wczytaj zmienne z .env.test
dotenv.config({ path: ".env.test" });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing SUPABASE_SERVICE_KEY in environment variables. Cannot create test user.");
  console.error("Please set SUPABASE_SERVICE_KEY in your .env.local or manually create test user.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const testEmail = process.env.E2E_USERNAME || `test-${Date.now()}@example.com`;
const testPassword = process.env.E2E_PASSWORD || "TestPassword123!";

(async () => {
  try {
    // Create user with admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email
    });

    if (error) {
      process.exit(1);
    }

    if (!data.user) {
      process.exit(1);
    }

    // Update .env.test
    const envPath = path.join(process.cwd(), ".env.test");
    let envContent = fs.readFileSync(envPath, "utf-8");

    // Replace old values
    envContent = envContent.replace(/E2E_USERNAME=.*/, `E2E_USERNAME=${testEmail}`);
    envContent = envContent.replace(/E2E_PASSWORD=.*/, `E2E_PASSWORD=${testPassword}`);
    envContent = envContent.replace(/E2E_USERNAME_ID=.*/, `E2E_USERNAME_ID=${data.user.id}`);

    fs.writeFileSync(envPath, envContent);
  } catch {
    process.exit(1);
  }
})();
