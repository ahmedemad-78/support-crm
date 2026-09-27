#!/usr/bin/env bash
# Boot Docker, the local Supabase stack, .env.local, and the Next.js dev server.
# Local admin email is dev-admin@example.com. The password is generated once and
# stored in /home/ubuntu/.support-crm-dev-admin-password (not committed).
set -euo pipefail

export SUPABASE_TELEMETRY_DISABLED=1

cd /workspace

if ! sudo docker info >/dev/null 2>&1; then
  sudo mkdir -p /etc/docker
  if [ ! -s /etc/docker/daemon.json ]; then
    printf '%s\n' '{"storage-driver":"fuse-overlayfs","iptables":true,"ip6tables":false}' | sudo tee /etc/docker/daemon.json >/dev/null
  fi
  sudo update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null
  sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy >/dev/null
  sudo setsid dockerd --host=unix:///var/run/docker.sock >/tmp/dockerd.log 2>&1 < /dev/null &
  ready=0
  for _ in $(seq 1 60); do
    if sudo docker info >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  if [ "$ready" -ne 1 ]; then
    echo "Docker daemon did not become ready. See /tmp/dockerd.log" >&2
    exit 1
  fi
fi

sudo chmod 666 /var/run/docker.sock

if ! supabase status >/dev/null 2>&1; then
  echo "Starting local Supabase…"
  supabase start
fi

status_env="$(supabase status -o env)"
value_of() {
  printf '%s\n' "$status_env" | sed -n "s/^$1=//p" | tr -d '"'
}

api_url="$(value_of API_URL)"
publishable_key="$(value_of PUBLISHABLE_KEY)"
secret_key="$(value_of SECRET_KEY)"

if [ -z "$api_url" ] || [ -z "$publishable_key" ] || [ -z "$secret_key" ]; then
  echo "supabase status did not return API_URL, PUBLISHABLE_KEY, and SECRET_KEY" >&2
  exit 1
fi

cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=${api_url}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable_key}
SUPABASE_SECRET_KEY=${secret_key}
EOF

password_file="/home/ubuntu/.support-crm-dev-admin-password"
if [ ! -s "$password_file" ]; then
  openssl rand -base64 18 | tr -d '\n' > "$password_file"
  chmod 600 "$password_file"
fi

NEXT_PUBLIC_SUPABASE_URL="$api_url" \
SUPABASE_SECRET_KEY="$secret_key" \
DEV_ADMIN_PASSWORD_FILE="$password_file" \
node --input-type=module <<'JS'
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const email = "dev-admin@example.com";
const password = readFileSync(process.env.DEV_ADMIN_PASSWORD_FILE, "utf8").trim();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
if (listed.error) throw listed.error;
let user = listed.data.users.find((candidate) => candidate.email === email);

if (!user) {
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "support_agent", full_name: "Dev Admin" },
  });
  if (created.error) throw created.error;
  user = created.data.user;
} else {
  const updated = await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    app_metadata: { ...(user.app_metadata ?? {}), role: "support_agent", full_name: "Dev Admin" },
  });
  if (updated.error) throw updated.error;
}

const profile = await supabase
  .from("profiles")
  .update({ role: "support_agent", full_name: "Dev Admin" })
  .eq("id", user.id);
if (profile.error) throw profile.error;

const container = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" })
  .split("\n")
  .find((name) => name.startsWith("supabase_db_"));
if (!container) throw new Error("Local Supabase database container is not running");

execFileSync(
  "docker",
  ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
    `update public.profiles set is_admin = true where id = '${user.id}';`],
  { stdio: "inherit" },
);

console.log(`Local admin ${email} is ready.`);
JS

if curl -sf -o /dev/null http://127.0.0.1:3000/login; then
  echo "Next.js is already listening on port 3000."
  while curl -sf -o /dev/null http://127.0.0.1:3000/login; do
    sleep 30
  done
  exit 1
fi

echo "Starting Next.js on http://127.0.0.1:3000"
exec npm run dev
