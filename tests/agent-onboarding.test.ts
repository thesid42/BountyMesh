import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { endpointUrl, isPublicAddress, encryptCredential, decryptCredential, parseAgentDeliverable } from "../src/lib/agent-connector";
import { PATCH } from "../src/app/api/agents/[id]/route";
import { POST as sessionPost } from "../src/app/api/owners/session/route";

test("external connectors reject private networks and insecure URLs", () => {
  for (const ip of ["127.0.0.1","10.1.2.3","172.16.0.1","192.168.1.1","169.254.169.254","100.64.0.1","0.0.0.0","::1","::ffff:127.0.0.1","fc00::1","fe80::1","2001:db8::1","2002:7f00:1::"]) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["8.8.8.8","1.1.1.1","2606:4700:4700::1111","2001:4860:4860::8888"]) assert.equal(isPublicAddress(ip), true, ip);
  for (const url of ["http://agent.example/tasks","https://localhost/tasks","https://10.0.0.1/tasks","https://[::1]/tasks","https://user:pass@agent.example/tasks","https://agent.example:444/tasks","https://agent.example/tasks?secret=x"]) assert.throws(() => endpointUrl(url));
  assert.equal(endpointUrl("https://agent.example/tasks").hostname, "agent.example");
});
test("connection encryption authenticates ciphertext and binds it to the agent", () => {
  const old = process.env.AGENT_SECRET_KEY; process.env.AGENT_SECRET_KEY = "a".repeat(64);
  try {
    const id = randomUUID(), token = "unique-connector-secret-12345", encrypted = encryptCredential(token, id);
    assert.ok(!encrypted.includes(token)); assert.equal(decryptCredential(encrypted, id), token);
    assert.throws(() => decryptCredential(encrypted, randomUUID()));
    const parts = encrypted.split("."); parts[2] = Buffer.alloc(16).toString("base64url"); assert.throws(() => decryptCredential(parts.join("."), id));
  } finally { if (old === undefined) delete process.env.AGENT_SECRET_KEY; else process.env.AGENT_SECRET_KEY = old; }
});
test("external deliverables reject executable formats and oversized content", () => {
  const valid = { summary: "A valid actual response", content: "Useful bounded report. ".repeat(6), kind: "markdown" };
  assert.equal(parseAgentDeliverable(valid).kind, "markdown");
  assert.throws(() => parseAgentDeliverable({ ...valid, kind: "javascript" }));
  assert.throws(() => parseAgentDeliverable({ ...valid, content: "x".repeat(6001) }));
});
test("owner mutations reject cross-origin and missing sessions before storage", async () => {
  const id = randomUUID(), context = { params: Promise.resolve({ id }) };
  const missing = await PATCH(new Request("https://guild.example/api/agents/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "activate" }) }), context);
  assert.equal(missing.status, 401);
  const cross = await sessionPost(new Request("https://guild.example/api/owners/session", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: JSON.stringify({ action: "login" }) }));
  assert.equal(cross.status, 403);
});
