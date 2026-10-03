import type { AppConfig } from "./contracts";

const env = (key: string) => process.env[key]?.trim() ?? "";

export function getConfig(): AppConfig {
  // Local adapters are restricted to explicitly isolated unit-test fixtures.
  // Every development and production app session uses the online integrations.
  const localTestFixture = process.env.NODE_ENV === "test"
    && env("BOUNTYMESH_TEST_FIXTURES") === "local"
    && env("BOUNTYMESH_MODE") === "demo";
  const mode = localTestFixture ? "demo" : "live";
  const supabaseReady = Boolean(env("NEXT_PUBLIC_SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
  const stripeKey = env("STRIPE_SECRET_KEY");
  const stripeReady = /^sk_test_|^rk_test_/.test(stripeKey) && Boolean(env("STRIPE_CONNECTED_ACCOUNT_ID"));
  const providersReady = Boolean(env("ANTHROPIC_API_KEY") && env("GEMINI_API_KEY"));
  const missing: string[] = [];
  if (!supabaseReady) missing.push("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY");
  if (!providersReady) missing.push("ANTHROPIC_API_KEY", "GEMINI_API_KEY");
  if (!stripeReady) missing.push("STRIPE_SECRET_KEY (test mode)", "STRIPE_CONNECTED_ACCOUNT_ID");
  if (mode === "live" && !env("OPERATOR_TOKEN")) missing.push("OPERATOR_TOKEN");
  return {
    mode,
    storage: mode === "live" ? "supabase" : "local",
    payments: mode === "live" ? "stripe" : "demo",
    ready: mode === "demo" || (supabaseReady && providersReady && stripeReady && Boolean(env("OPERATOR_TOKEN"))),
    missing: mode === "demo" ? [] : missing,
    orchestratorModel: env("ANTHROPIC_MODEL") || "claude-sonnet-5",
    workerModel: env("GEMINI_MODEL") || "gemini-3.8-flash",
  };
}

export function getEnv(name: string): string { return env(name); }
