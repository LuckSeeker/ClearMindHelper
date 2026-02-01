#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef */
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

console.log("🚀 Creating test user...");
console.log(`📧 Email: ${testEmail}`);
console.log(`🔒 Password: ${testPassword}`);

(async () => {
  try {
    // Create user with admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email
    });

    if (error) {
      console.error("❌ Error creating user:", error.message);
      process.exit(1);
    }

    if (!data.user) {
      console.error("❌ User creation failed - no user returned");
      process.exit(1);
    }

    console.log("✅ User created successfully!");
    console.log(`👤 User ID: ${data.user.id}`);

    // Update .env.test
    const envPath = path.join(process.cwd(), ".env.test");
    let envContent = fs.readFileSync(envPath, "utf-8");

    // Replace old values
    envContent = envContent.replace(/E2E_USERNAME=.*/, `E2E_USERNAME=${testEmail}`);
    envContent = envContent.replace(/E2E_PASSWORD=.*/, `E2E_PASSWORD=${testPassword}`);
    envContent = envContent.replace(/E2E_USERNAME_ID=.*/, `E2E_USERNAME_ID=${data.user.id}`);

    fs.writeFileSync(envPath, envContent);

    console.log("✅ Updated .env.test with new credentials:");
    console.log(`   E2E_USERNAME=${testEmail}`);
    console.log(`   E2E_PASSWORD=${testPassword}`);
    console.log(`   E2E_USERNAME_ID=${data.user.id}`);

    console.log("\n🎉 Test user created and .env.test updated!");
    console.log("You can now run: npm run test:e2e");
  } catch (err) {
    console.error("❌ Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
