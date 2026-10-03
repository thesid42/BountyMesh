import assert from "node:assert/strict";
import test from "node:test";
import { getConfig } from "../src/lib/config";

test("app sessions require online providers and cannot enable offline demos", async (t) => {
  const keys = ["NODE_ENV", "BOUNTYMESH_MODE", "BOUNTYMESH_TEST_FIXTURES", "OPERATOR_TOKEN", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_CONNECTED_ACCOUNT_ID"];
  const previous = keys.map((key) => process.env[key]);
  keys.forEach((key) => { delete process.env[key]; });
  t.after(() => keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; }));
  function configure(values: Record<string, string>) {
    Object.entries(values).forEach(([key, value]) => { process.env[key] = value; });
  }
  await t.test("missing configuration disables work without substituting a local demo", () => {
    const config = getConfig();
    assert.equal(config.mode, "live");
    assert.equal(config.storage, "supabase");
    assert.equal(config.payments, "stripe");
    assert.equal(config.ready, false);
    assert.ok(config.missing.includes("OPERATOR_TOKEN"));
    assert.ok(config.missing.includes("GEMINI_API_KEY"));
  });
  await t.test("legacy demo flags cannot change development or production app behavior", () => {
    for (const nodeEnv of ["development", "production"]) {
      configure({ NODE_ENV: nodeEnv, BOUNTYMESH_MODE: "demo", BOUNTYMESH_TEST_FIXTURES: "local" });
      assert.equal(getConfig().mode, "live");
      assert.equal(getConfig().storage, "supabase");
      assert.equal(getConfig().ready, false);
    }
  });
  await t.test("local adapters are available only to explicitly isolated unit fixtures", () => {
    configure({ NODE_ENV: "test", BOUNTYMESH_MODE: "demo", BOUNTYMESH_TEST_FIXTURES: "local" });
    assert.equal(getConfig().storage, "local");
    delete process.env.BOUNTYMESH_TEST_FIXTURES;
    assert.equal(getConfig().mode, "live");
  });
});
