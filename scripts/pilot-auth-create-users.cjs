const { createClient } = require("@supabase/supabase-js");
const { randomInt } = require("node:crypto");
const { writeFile, chmod } = require("node:fs/promises");

const apply = process.argv.includes("--apply");
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OUT = process.env.PILOT_AUTH_CREDENTIALS_OUT || "pilot-auth-credentials.json";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are required");
}

const targets = [
  { key: "manager", email: "hemapriyankapv@gmail.com", name: "Hema Priyanka", pilotRole: "manager" },
  { key: "mr", email: "mandatisreenath@gmail.com", name: "Vinod", pilotRole: "mr" },
];

const client = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generatePassword(length = 20) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*()_+-=";
  const pool = upper + lower + digits + symbols;
  const chars = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)],
  ];
  while (chars.length < length) chars.push(pool[randomInt(pool.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function findUserByEmail(email) {
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => String(u.email || "").toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  throw new Error("Auth user scan exceeded 100 pages");
}

const preflight = {};
for (const target of targets) {
  const existing = await findUserByEmail(target.email);
  preflight[target.key] = existing
    ? { email: target.email, exists: true, userId: existing.id, confirmed: Boolean(existing.email_confirmed_at) }
    : { email: target.email, exists: false };
}

console.log(JSON.stringify({ status: apply ? "PREFLIGHT_COMPLETE" : "PREFLIGHT_ONLY", users: preflight }, null, 2));
if (!apply) process.exit(0);

const existingTargets = Object.values(preflight).filter((u) => u.exists);
if (existingTargets.length) {
  throw new Error("Refusing to mutate: one or more target Auth users already exist. Review preflight output first.");
}

const created = [];
try {
  const credentials = {};
  for (const target of targets) {
    const password = generatePassword(20);
    const { data, error } = await client.auth.admin.createUser({
      email: target.email,
      password,
      email_confirm: true,
      user_metadata: { name: target.name, pilotRole: target.pilotRole, source: "cipla-pilot" },
    });
    if (error) throw error;
    if (!data.user?.id) throw new Error("Supabase returned no user id for " + target.email);
    created.push(data.user.id);
    credentials[target.key] = {
      email: target.email,
      userId: data.user.id,
      temporaryPassword: password,
      emailConfirmed: true,
    };
  }

  await writeFile(OUT, JSON.stringify({ createdAt: new Date().toISOString(), users: credentials }, null, 2), { mode: 0o600 });
  await chmod(OUT, 0o600).catch(() => undefined);

  console.log(JSON.stringify({
    status: "AUTH_USERS_CREATED",
    users: Object.fromEntries(Object.entries(credentials).map(([k, v]) => [k, { email: v.email, userId: v.userId }])),
    credentialsFile: OUT,
  }, null, 2));
} catch (error) {
  for (const userId of created.reverse()) {
    await client.auth.admin.deleteUser(userId).catch(() => undefined);
  }
  throw error;
}
