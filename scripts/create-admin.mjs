// Creates the owner account: Technical Support + admin.
// Usage: npm run create-admin -- --email you@company.com --name "Your Name" --password "at-least-10-chars"
// is_admin can't be set through the API (a trigger blocks it), so the script prints the SQL to run once in the SQL editor.

import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";
import process from "node:process";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    password: { type: "string" },
  },
});

const { email, name, password } = values;
if (!email || !name || !password || password.length < 10) {
  console.error('Usage: npm run create-admin -- --email you@company.com --name "Your Name" --password "min 10 chars"');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role: "support_agent", full_name: name },
});

if (error) {
  console.error(`Could not create ${email}: ${error.message}`);
  process.exit(1);
}

// Supabase writes app_metadata after the insert trigger runs, so set the role explicitly.
const { error: profileError } = await supabase
  .from("profiles")
  .update({ role: "support_agent", full_name: name })
  .eq("id", data.user.id);
if (profileError) {
  console.error(`Created the login but couldn't set the role: ${profileError.message}`);
  process.exit(1);
}

// Supabase writes app_metadata after the insert trigger runs, so set the role explicitly.
const { error: profileError } = await supabase
  .from("profiles")
  .update({ role: "support_agent", full_name: name })
  .eq("id", data.user.id);
if (profileError) {
  console.error(`Created the login but couldn't set the role: ${profileError.message}`);
  process.exit(1);
}

console.log(`Created ${email} (${data.user.id}) as Technical Support.`);
console.log("Last step — run this once in the Supabase SQL editor to make the account admin:");
console.log(`  update public.profiles set is_admin = true where id = '${data.user.id}';`);
